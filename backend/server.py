#!/usr/bin/env python3
"""
AgroGuard Edge — Local Backend Server (Pure Python 3 Stdlib + Pillow, Zero pip deps).

Provides:
  - GET  /api/health          Health & hardware driver info
  - GET  /api/state           Full snapshot: sensors, 6h frost prediction, actuators, history, latest CV, Telegram feed
  - GET  /api/stream          Real-time SSE stream (updates every 1s)
  - GET  /api/scenarios       List of Kyrgyzstan climate presets
  - POST /api/scenario        Switch scenario / start 6h time-machine
  - POST /api/sensors         Manual slider overrides (T, RH, pressure, hour, time_scale)
  - POST /api/actuators       Manual relay toggle or Auto-AI mode switch
  - GET  /api/samples         List of 5 built-in sample leaf/trap images
  - POST /api/cv/analyze      Run local Edge-CV on uploaded base64 photo or built-in sample
  - POST /api/telegram/action Trigger Telegram inline button callback directly
"""

import base64
import json
import mimetypes
import os
import queue
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# Ensure repository root is in sys.path so `backend.*` imports always resolve
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.hal.virtual_driver import VirtualTwinDriver, SCENARIOS
from backend.ai.frost_predict import FrostPredictor
from backend.ai.disease_cv import analyze_leaf_image
from backend.bot.telegram_bot import TelegramMirrorBot
from backend.storage.local_db import LocalEdgeDB
from backend.generate_samples import generate_all_samples, SAMPLES_DIR

PORT = int(os.environ.get("PORT", "8000"))
FRONTEND_DIST = os.path.join(REPO_ROOT, "frontend", "dist")

SAMPLES_META = [
    {"id": "healthy", "file": "healthy.png", "name_ru": "Здоровый лист", "name_kg": "Дени сак жалбырак"},
    {"id": "late_blight", "file": "late_blight.png", "name_ru": "Фитофтороз (томат)", "name_kg": "Фитофтороз (помидор)"},
    {"id": "powdery_mildew", "file": "powdery_mildew.png", "name_ru": "Мучнистая роса", "name_kg": "Ун шүүдүрүмү"},
    {"id": "scab_rust", "file": "scab_rust.png", "name_ru": "Парша / Ржавчина", "name_kg": "Парша / Дат"},
    {"id": "sticky_trap_pests", "file": "sticky_trap_pests.png", "name_ru": "Жёлтая ловушка (тля)", "name_kg": "Сары тузак (бит)"},
]


class AgroGuardController:
    """Central Edge-AI orchestrator running the autonomous Sense -> Predict -> Act loop."""

    def __init__(self):
        generate_all_samples()
        self.driver = VirtualTwinDriver()
        self.frost_ai = FrostPredictor()
        self.db = LocalEdgeDB()
        self.bot = TelegramMirrorBot(on_command_callback=self.handle_telegram_command)

        self._lock = threading.Lock()
        self._sse_clients: list[queue.Queue] = []
        self.offline_edge_mode = False
        self.latest_cv: dict | None = None
        self.last_cv_scan_ts = 0.0
        self._last_frost_alert_state = False
        self._last_fungal_alert_state = False

        # Run initial evaluation and kick off 1 Hz autonomous loop
        self._evaluate_and_act(initial=True)
        threading.Thread(target=self._background_loop, daemon=True).start()

    def _background_loop(self) -> None:
        while True:
            time.sleep(1.0)
            self.driver.step_simulation(dt_seconds=1.0)
            self._evaluate_and_act()
            self._broadcast_state()

    def _evaluate_and_act(self, initial: bool = False) -> None:
        sensors = self.driver.read_sensors()
        pred = self.frost_ai.predict(
            air_temp_c=sensors.air_temp_c,
            leaf_temp_c=sensors.leaf_temp_c,
            humidity_pct=sensors.humidity_pct,
            pressure_hpa=sensors.pressure_hpa,
            pressure_trend_hpa_h=sensors.pressure_trend_hpa_h,
            cooling_rate_c_h=sensors.cooling_rate_c_h,
            sim_hour=sensors.sim_hour,
        )
        act = self.driver.get_state()

        # Autonomous Edge-AI decision + Hardware Fail-Safe
        if act.auto_mode or pred["failsafe_triggered"]:
            rec = pred["recommended_actions"]
            new_sprinkler = rec["sprinkler"]
            new_heater = rec["heater"]
            new_vent = rec["vent"]

            if pred["failsafe_triggered"]:
                reason_ru = f"FAIL-SAFE: лист {sensors.leaf_temp_c:.1f}°C — принудительная защита!"
                reason_kg = f"FAIL-SAFE: жалбырак {sensors.leaf_temp_c:.1f}°C — шашылыш коргоо!"
            elif new_sprinkler or new_heater:
                reason_ru = f"Edge-AI: риск заморозка {pred['frost_risk_pct']}% (прогноз {pred['min_predicted_leaf_c']}°C)"
                reason_kg = f"Edge-AI: үшүк коркунучу {pred['frost_risk_pct']}% (болжол {pred['min_predicted_leaf_c']}°C)"
            elif new_vent:
                reason_ru = f"Edge-AI: влажность {sensors.humidity_pct:.0f}% — проветривание от грибка"
                reason_kg = f"Edge-AI: нымдуулук {sensors.humidity_pct:.0f}% — козу карындан желдетүү"
            else:
                reason_ru = "Микроклимат в норме — режим дежурного мониторинга"
                reason_kg = "Микроклимат нормада — мониторинг режими"

            changed = (
                new_sprinkler != act.sprinkler_on
                or new_heater != act.heater_on
                or new_vent != act.vent_open
                or pred["failsafe_triggered"] != act.failsafe_active
            )
            self.driver.apply_actuators(
                sprinkler_on=new_sprinkler,
                heater_on=new_heater,
                vent_open=new_vent,
                reason_ru=reason_ru,
                reason_kg=reason_kg,
                failsafe=pred["failsafe_triggered"],
            )

            # Emit Telegram + DB alerts on state transition into critical frost
            is_frost_alert = (new_sprinkler or new_heater) and pred["frost_risk_pct"] >= 65
            if is_frost_alert and not self._last_frost_alert_state and not initial:
                self._last_frost_alert_state = True
                self.db.log_event(
                    "frost_protection",
                    "critical",
                    "Автозащита от заморозка включена",
                    "Үшүктөн авто-коргоо күйгүзүлдү",
                    f"Лист: {sensors.leaf_temp_c:.1f}°C, прогноз на 6ч: {pred['min_predicted_leaf_c']}°C (риск {pred['frost_risk_pct']}%). Запущены реле полива и обогрева.",
                    f"Жалбырак: {sensors.leaf_temp_c:.1f}°C, 6 сааттык болжол: {pred['min_predicted_leaf_c']}°C (коркунуч {pred['frost_risk_pct']}%). Сугаруу жана жылытуу күйгүзүлдү.",
                )
                self.bot.push_alert(
                    severity="critical",
                    title_ru=f"❄️ Угроза заморозка ({pred['frost_risk_pct']}%)",
                    title_kg=f"❄️ Үшүк коркунучу ({pred['frost_risk_pct']}%)",
                    text_ru=(
                        f"Температура листа: {sensors.leaf_temp_c:.1f}°C (воздух {sensors.air_temp_c:.1f}°C, точка росы {pred['dew_point_c']:.1f}°C).\n"
                        f"Прогноз минимума за 6 ч: {pred['min_predicted_leaf_c']}°C.\n"
                        f"⚡ Реле включены: {'💧 Микродождевание ' if new_sprinkler else ''}{'🔥 ИК-обогрев' if new_heater else ''}"
                    ),
                    text_kg=(
                        f"Жалбырак темп.: {sensors.leaf_temp_c:.1f}°C (аба {sensors.air_temp_c:.1f}°C, шүүдүрүм {pred['dew_point_c']:.1f}°C).\n"
                        f"6 сааттык минимум болжолу: {pred['min_predicted_leaf_c']}°C.\n"
                        f"⚡ Реле күйгүзүлдү: {'💧 Микросугаруу ' if new_sprinkler else ''}{'🔥 ИК-жылытуу' if new_heater else ''}"
                    ),
                )
            elif not is_frost_alert:
                self._last_frost_alert_state = False

            if new_vent and not self._last_fungal_alert_state and not initial:
                self._last_fungal_alert_state = True
                self.bot.push_alert(
                    severity="warning",
                    title_ru=f"🍄 Высокий риск грибка ({pred['fungal_risk_pct']}%)",
                    title_kg=f"🍄 Козу карын коркунучу ({pred['fungal_risk_pct']}%)",
                    text_ru=f"Влажность {sensors.humidity_pct:.0f}% вплотную к точке росы. Открыты форточки вентиляции.",
                    text_kg=f"Нымдуулук {sensors.humidity_pct:.0f}% шүүдүрүм чекитине жакын. Желдетүү ачылды.",
                )
            elif not new_vent:
                self._last_fungal_alert_state = False

            if changed and not initial:
                self.db.log_event(
                    "relay_switch",
                    "info",
                    "Переключение реле",
                    "Реле которулду",
                    reason_ru,
                    reason_kg,
                )

    def handle_telegram_command(self, cmd: str) -> None:
        act = self.driver.get_state()
        if cmd == "sprinkler_toggle":
            self.driver.set_auto_mode(False)
            new_val = not act.sprinkler_on
            self.driver.apply_actuators(
                sprinkler_on=new_val,
                heater_on=act.heater_on,
                vent_open=act.vent_open,
                reason_ru="Команда из Telegram: полив " + ("ВКЛ" if new_val else "ВЫКЛ"),
                reason_kg="Telegram буйругу: сугаруу " + ("КҮЙДҮ" if new_val else "ӨЧТҮ"),
            )
            self.bot.push_user_action(
                "💧 Микродождевание: " + ("ВКЛЮЧЕНО" if new_val else "ВЫКЛЮЧЕНО"),
                "💧 Микросугаруу: " + ("КҮЙГҮЗҮЛДҮ" if new_val else "ӨЧҮРҮЛДҮ"),
            )
        elif cmd == "heater_toggle":
            self.driver.set_auto_mode(False)
            new_val = not act.heater_on
            self.driver.apply_actuators(
                sprinkler_on=act.sprinkler_on,
                heater_on=new_val,
                vent_open=act.vent_open,
                reason_ru="Команда из Telegram: обогрев " + ("ВКЛ" if new_val else "ВЫКЛ"),
                reason_kg="Telegram буйругу: жылытуу " + ("КҮЙДҮ" if new_val else "ӨЧТҮ"),
            )
            self.bot.push_user_action(
                "🔥 ИК-обогрев: " + ("ВКЛЮЧЁН" if new_val else "ВЫКЛЮЧЕН"),
                "🔥 ИК-жылытуу: " + ("КҮЙГҮЗҮЛДҮ" if new_val else "ӨЧҮРҮЛДҮ"),
            )
        elif cmd == "vent_toggle":
            self.driver.set_auto_mode(False)
            new_val = not act.vent_open
            self.driver.apply_actuators(
                sprinkler_on=act.sprinkler_on,
                heater_on=act.heater_on,
                vent_open=new_val,
                reason_ru="Команда из Telegram: вентиляция " + ("ОТКРЫТА" if new_val else "ЗАКРЫТА"),
                reason_kg="Telegram буйругу: желдетүү " + ("АЧЫЛДЫ" if new_val else "ЖАБЫЛДЫ"),
            )
            self.bot.push_user_action(
                "🌀 Вентиляция: " + ("ОТКРЫТА" if new_val else "ЗАКРЫТА"),
                "🌀 Желдетүү: " + ("АЧЫЛДЫ" if new_val else "ЖАБЫЛДЫ"),
            )
        elif cmd == "auto_on":
            self.driver.set_auto_mode(True)
            self.bot.push_user_action("🤖 Автономный режим Edge-AI включён", "🤖 Автономдуу Edge-AI күйгүзүлдү")
            self._evaluate_and_act()
        self._broadcast_state()

    def run_cv_scan(self, image_bytes: bytes, source_label: str) -> dict:
        result = analyze_leaf_image(image_bytes, source_label=source_label)
        with self._lock:
            self.latest_cv = result
            self.last_cv_scan_ts = time.time()

        self.db.log_event(
            "cv_scan",
            result["severity"],
            f"Edge-CV: {result['name_ru']}",
            f"Edge-CV: {result['name_kg']}",
            f"Уверенность {result['confidence_pct']}% • Поражение {result['affected_area_pct']}% • {result['inference_ms']} мс",
            f"Ишенимдүүлүк {result['confidence_pct']}% • Жабыркоо {result['affected_area_pct']}% • {result['inference_ms']} мс",
        )

        if result["disease_id"] != "healthy":
            self.bot.push_alert(
                severity=result["severity"],
                title_ru=f"🌿 Edge-CV: {result['name_ru']} ({result['confidence_pct']}%)",
                title_kg=f"🌿 Edge-CV: {result['name_kg']} ({result['confidence_pct']}%)",
                text_ru=f"Локация: {result['affected_sector']} • Поражение: {result['affected_area_pct']}%\nРекомендация: {result['advice_ru']}",
                text_kg=f"Орун: {result['affected_sector']} • Жабыркоо: {result['affected_area_pct']}%\nСунуш: {result['advice_kg']}",
                image_b64=result["annotated_image"],
                buttons=[
                    {"id": "vent_toggle", "label_ru": "🌀 Проветрить", "label_kg": "🌀 Желдетүү"},
                    {"id": "auto_on", "label_ru": "🤖 Авто-AI", "label_kg": "🤖 Авто-AI"},
                ],
            )
        else:
            self.bot.push_alert(
                severity="safe",
                title_ru=f"✅ Edge-CV: {result['name_ru']} ({result['confidence_pct']}%)",
                title_kg=f"✅ Edge-CV: {result['name_kg']} ({result['confidence_pct']}%)",
                text_ru=f"Сканирование завершено за {result['inference_ms']} мс. Признаков болезней и вредителей не обнаружено.",
                text_kg=f"Сканерлөө {result['inference_ms']} мс ичинде бүттү. Оорунун белгилери табылган жок.",
                image_b64=result["annotated_image"],
            )

        self._broadcast_state()
        return result

    def get_snapshot(self) -> dict:
        sensors = self.driver.read_sensors()
        pred = self.frost_ai.predict(
            air_temp_c=sensors.air_temp_c,
            leaf_temp_c=sensors.leaf_temp_c,
            humidity_pct=sensors.humidity_pct,
            pressure_hpa=sensors.pressure_hpa,
            pressure_trend_hpa_h=sensors.pressure_trend_hpa_h,
            cooling_rate_c_h=sensors.cooling_rate_c_h,
            sim_hour=sensors.sim_hour,
        )
        return {
            "sensors": sensors.to_dict(),
            "prediction": pred,
            "actuators": self.driver.get_state().to_dict(),
            "time_scale": self.driver.time_scale,
            "offline_edge_mode": self.offline_edge_mode,
            "history": self.driver.get_history(),
            "latest_cv": self.latest_cv,
            "last_cv_scan_ts": self.last_cv_scan_ts,
            "telegram_messages": self.bot.get_messages(),
            "real_telegram_connected": self.bot.real_bot_enabled,
            "events": self.db.get_recent_events(14),
        }

    def subscribe_sse(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=4)
        with self._lock:
            self._sse_clients.append(q)
        return q

    def unsubscribe_sse(self, q: queue.Queue) -> None:
        with self._lock:
            if q in self._sse_clients:
                self._sse_clients.remove(q)

    def _broadcast_state(self) -> None:
        payload = json.dumps(self.get_snapshot(), ensure_ascii=False)
        with self._lock:
            dead = []
            for q in self._sse_clients:
                try:
                    if q.full():
                        q.get_nowait()
                    q.put_nowait(payload)
                except Exception:
                    dead.append(q)
            for d in dead:
                self._sse_clients.remove(d)


CONTROLLER = AgroGuardController()


class AgroGuardHTTPHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Quiet clean access logging
        pass

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, obj: dict | list, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._send_json({"status": "ok", "service": "AgroGuard Edge Twin", "hal": "VirtualTwinDriver"})
            return

        if path == "/api/state":
            self._send_json(CONTROLLER.get_snapshot())
            return

        if path == "/api/scenarios":
            self._send_json(list(SCENARIOS.values()))
            return

        if path == "/api/samples":
            items = []
            for s in SAMPLES_META:
                fp = os.path.join(SAMPLES_DIR, s["file"])
                b64 = ""
                if os.path.exists(fp):
                    with open(fp, "rb") as f:
                        b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
                items.append({**s, "thumbnail": b64})
            self._send_json(items)
            return

        if path == "/api/stream":
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            q = CONTROLLER.subscribe_sse()
            try:
                # Immediately push initial snapshot
                init_data = json.dumps(CONTROLLER.get_snapshot(), ensure_ascii=False)
                self.wfile.write(f"data: {init_data}\n\n".encode("utf-8"))
                self.wfile.flush()
                while True:
                    try:
                        msg = q.get(timeout=15)
                        self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                CONTROLLER.unsubscribe_sse(q)
            return

        # Serve built frontend static files if present
        if os.path.isdir(FRONTEND_DIST):
            rel = path.lstrip("/") or "index.html"
            target = os.path.normpath(os.path.join(FRONTEND_DIST, rel))
            if not target.startswith(FRONTEND_DIST) or not os.path.isfile(target):
                target = os.path.join(FRONTEND_DIST, "index.html")
            if os.path.isfile(target):
                ctype, _ = mimetypes.guess_type(target)
                with open(target, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype or "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        self._send_json({"error": "Not found"}, status=404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._read_json_body()
        except Exception as e:
            self._send_json({"error": f"Invalid JSON: {e}"}, status=400)
            return

        if path == "/api/scenario":
            sc_id = body.get("scenario_id", "chuy_april_frost")
            fast = bool(body.get("fast_forward", False))
            CONTROLLER.driver.load_scenario(sc_id, auto_fast_forward=fast)
            CONTROLLER._last_frost_alert_state = False
            CONTROLLER._last_fungal_alert_state = False
            CONTROLLER._evaluate_and_act()
            CONTROLLER._broadcast_state()
            self._send_json(CONTROLLER.get_snapshot())
            return

        if path == "/api/sensors":
            if "offline_edge_mode" in body:
                CONTROLLER.offline_edge_mode = bool(body["offline_edge_mode"])
            CONTROLLER.driver.set_manual_params(body)
            CONTROLLER._evaluate_and_act()
            CONTROLLER._broadcast_state()
            self._send_json(CONTROLLER.get_snapshot())
            return

        if path == "/api/actuators":
            if "auto_mode" in body:
                CONTROLLER.driver.set_auto_mode(bool(body["auto_mode"]))
            if any(k in body for k in ("sprinkler_on", "heater_on", "vent_open")):
                act = CONTROLLER.driver.get_state()
                CONTROLLER.driver.set_auto_mode(False)
                CONTROLLER.driver.apply_actuators(
                    sprinkler_on=bool(body.get("sprinkler_on", act.sprinkler_on)),
                    heater_on=bool(body.get("heater_on", act.heater_on)),
                    vent_open=bool(body.get("vent_open", act.vent_open)),
                    reason_ru="Ручное переключение на панели управления",
                    reason_kg="Башкаруу панелинен кол менен которуу",
                )
            CONTROLLER._evaluate_and_act()
            CONTROLLER._broadcast_state()
            self._send_json(CONTROLLER.get_snapshot())
            return

        if path == "/api/cv/analyze":
            sample_id = body.get("sample_id")
            img_b64 = body.get("image_base64")
            if sample_id:
                meta = next((s for s in SAMPLES_META if s["id"] == sample_id), None)
                if not meta:
                    self._send_json({"error": "Unknown sample_id"}, status=404)
                    return
                with open(os.path.join(SAMPLES_DIR, meta["file"]), "rb") as f:
                    raw_bytes = f.read()
                res = CONTROLLER.run_cv_scan(raw_bytes, source_label=f"sample:{sample_id}")
                self._send_json(res)
                return
            elif img_b64:
                if "," in img_b64:
                    img_b64 = img_b64.split(",", 1)[1]
                raw_bytes = base64.b64decode(img_b64)
                res = CONTROLLER.run_cv_scan(raw_bytes, source_label=body.get("source", "webcam/upload"))
                self._send_json(res)
                return
            else:
                self._send_json({"error": "Provide sample_id or image_base64"}, status=400)
                return

        if path == "/api/telegram/action":
            cmd = body.get("command", "")
            CONTROLLER.handle_telegram_command(cmd)
            self._send_json(CONTROLLER.get_snapshot())
            return

        self._send_json({"error": "Not found"}, status=404)


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AgroGuardHTTPHandler)
    print(f"AgroGuard Edge Digital Twin Backend running on http://localhost:{PORT}")
    print(f"HAL Driver: VirtualTwinDriver | Telegram External: {'ON' if CONTROLLER.bot.real_bot_enabled else 'MIRROR MODE ($0)'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down AgroGuard Edge Backend...")
        server.shutdown()


if __name__ == "__main__":
    main()
