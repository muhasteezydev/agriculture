"""
Zero-dependency Telegram Bot Gateway + In-App Live Mirror for AgroGuard Edge.

- If TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are provided,
  sends REAL Telegram alerts with inline keyboard buttons and polls button presses.
- Always mirrors every alert into an in-memory feed exposed to the web UI so judges
  can test the exact Telegram Bot UX (RU/KG) right inside the dashboard with $0 setup!
"""

import json
import os
import threading
import time
import urllib.request
from datetime import datetime
from typing import Callable, Dict, Any, List, Optional


class TelegramMirrorBot:
    def __init__(self, on_command_callback: Callable[[str], None]):
        self.token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
        self.real_bot_enabled = bool(self.token and self.chat_id)
        self.on_command = on_command_callback
        self._lock = threading.Lock()
        self._messages: List[Dict[str, Any]] = []
        self._msg_seq = 1
        self._last_update_id = 0

        # Welcome system message in mirror feed
        self.push_alert(
            severity="info",
            title_ru="AgroGuard Bot подключён",
            title_kg="AgroGuard Bot туташты",
            text_ru="Мониторинг теплицы №1 (Чуйская обл.) активен. Авто-защита от заморозков и Edge-CV включены.",
            text_kg="№1 күнөскана (Чүй обл.) мониторинги активдүү. Үшүктөн авто-коргоо жана Edge-CV иштеп жатат.",
            send_external=False,
        )

        if self.real_bot_enabled:
            t = threading.Thread(target=self._poll_loop, daemon=True)
            t.start()

    def push_alert(
        self,
        severity: str,
        title_ru: str,
        title_kg: str,
        text_ru: str,
        text_kg: str,
        image_b64: Optional[str] = None,
        buttons: Optional[List[Dict[str, str]]] = None,
        send_external: bool = True,
    ) -> Dict[str, Any]:
        ts = datetime.now().strftime("%H:%M:%S")
        default_buttons = buttons if buttons is not None else [
            {"id": "sprinkler_toggle", "label_ru": "💧 Полив", "label_kg": "💧 Сугаруу"},
            {"id": "heater_toggle", "label_ru": "🔥 Обогрев", "label_kg": "🔥 Жылытуу"},
            {"id": "auto_on", "label_ru": "🤖 Авто-AI", "label_kg": "🤖 Авто-AI"},
        ]

        with self._lock:
            msg = {
                "id": self._msg_seq,
                "ts": ts,
                "sender": "bot",
                "severity": severity,
                "title_ru": title_ru,
                "title_kg": title_kg,
                "text_ru": text_ru,
                "text_kg": text_kg,
                "image_b64": image_b64,
                "buttons": default_buttons,
                "delivered_real_telegram": False,
            }
            self._msg_seq += 1
            self._messages.append(msg)
            if len(self._messages) > 30:
                self._messages = self._messages[-30:]

        if send_external and self.real_bot_enabled:
            threading.Thread(target=self._send_real_telegram, args=(msg,), daemon=True).start()

        return msg

    def push_user_action(self, label_ru: str, label_kg: str) -> Dict[str, Any]:
        ts = datetime.now().strftime("%H:%M:%S")
        with self._lock:
            msg = {
                "id": self._msg_seq,
                "ts": ts,
                "sender": "farmer",
                "severity": "info",
                "title_ru": "",
                "title_kg": "",
                "text_ru": label_ru,
                "text_kg": label_kg,
                "image_b64": None,
                "buttons": [],
                "delivered_real_telegram": False,
            }
            self._msg_seq += 1
            self._messages.append(msg)
            if len(self._messages) > 30:
                self._messages = self._messages[-30:]
        return msg

    def get_messages(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._messages)

    def _send_real_telegram(self, msg: Dict[str, Any]) -> None:
        try:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload = {
                "chat_id": self.chat_id,
                "text": f"🌱 *{msg['title_ru']}*\n{msg['text_ru']}",
                "parse_mode": "Markdown",
                "reply_markup": {
                    "inline_keyboard": [
                        [{"text": b["label_ru"], "callback_data": b["id"]} for b in msg["buttons"]]
                    ]
                },
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5):
                msg["delivered_real_telegram"] = True
        except Exception:
            pass

    def _poll_loop(self) -> None:
        while True:
            try:
                url = f"https://api.telegram.org/bot{self.token}/getUpdates?timeout=15&offset={self._last_update_id + 1}"
                with urllib.request.urlopen(url, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    for upd in data.get("result", []):
                        self._last_update_id = upd["update_id"]
                        cb = upd.get("callback_query")
                        if cb and cb.get("data"):
                            self.on_command(cb["data"])
            except Exception:
                time.sleep(4)
