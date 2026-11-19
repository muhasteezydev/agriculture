"""
Virtual Digital Twin Driver implementing SensorProvider + ActuatorController (HAL).

Simulates realistic Kyrgyzstan agricultural microclimates (Chuy Valley spring frost,
Issyk-Kul radiative freeze, high-humidity greenhouse fungal risk, and live Open-Meteo
weather in Bishkek), including physical thermal feedback when micro-sprinklers,
IR heaters, or ventilation flaps turn ON.
"""

import json
import math
import random
import threading
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Any, List

from backend.hal.interfaces import SensorProvider, ActuatorController, SensorReading, ActuatorState
from backend.ai.frost_predict import compute_dew_point


SCENARIOS: Dict[str, Dict[str, Any]] = {
    "chuy_april_frost": {
        "id": "chuy_april_frost",
        "name_ru": "Апрельский заморозок — Чуйская долина",
        "name_kg": "Апрель үшүгү — Чүй өрөөнү",
        "desc_ru": "Резкое ночное похолодание с +8.5°C до −3.2°C к рассвету при ясном небе",
        "desc_kg": "Ачык түндө температура +8.5°Cден таңга маал −3.2°Cге кескин түшөт",
        "sim_hour": 21.0,
        "air_temp_c": 6.8,
        "humidity_pct": 64.0,
        "pressure_hpa": 1022.0,
        "pressure_trend_hpa_h": 0.9,
        "base_cooling_c_h": -1.45,
        "radiative_leaf_drop_c": 2.3,
        "soil_moisture_pct": 52.0,
    },
    "issykkul_radiative": {
        "id": "issykkul_radiative",
        "name_ru": "Ясная ночь — Иссык-Куль (радиационный холод)",
        "name_kg": "Ачык түн — Ысык-Көл (радиациялык суук)",
        "desc_ru": "Воздух +2.8°C, но листья абрикоса/яблони остывают до −0.8°C ниже воздуха!",
        "desc_kg": "Аба +2.8°C, бирок өрүк/алма жалбырактары абадан 3.5°C муздак!",
        "sim_hour": 23.5,
        "air_temp_c": 3.4,
        "humidity_pct": 56.0,
        "pressure_hpa": 1026.5,
        "pressure_trend_hpa_h": 1.2,
        "base_cooling_c_h": -1.15,
        "radiative_leaf_drop_c": 3.2,
        "soil_moisture_pct": 48.0,
    },
    "greenhouse_fungal": {
        "id": "greenhouse_fungal",
        "name_ru": "Теплица: влажность 91% (риск фитофторы)",
        "name_kg": "Күнөскана: нымдуулук 91% (фитофтора коркунучу)",
        "desc_ru": "Конденсат на листьях в закрытой теплице при +16°C — идеальная среда для грибка",
        "desc_kg": "Жабык күнөсканада +16°C жана шүүдүрүм — козу карын үчүн коркунучтуу чөйрө",
        "sim_hour": 6.5,
        "air_temp_c": 16.2,
        "humidity_pct": 91.5,
        "pressure_hpa": 1011.0,
        "pressure_trend_hpa_h": -0.4,
        "base_cooling_c_h": -0.1,
        "radiative_leaf_drop_c": 0.6,
        "soil_moisture_pct": 78.0,
    },
    "bishkek_live": {
        "id": "bishkek_live",
        "name_ru": "Живая погода — Бишкек (Open-Meteo API)",
        "name_kg": "Чыныгы аба ырайы — Бишкек (Open-Meteo)",
        "desc_ru": "Реальные текущие показания погоды в Бишкеке + локальная физика теплицы",
        "desc_kg": "Бишкектин учурдагы реалдуу аба ырайы + күнөскананын физикасы",
        "sim_hour": 14.0,
        "air_temp_c": 12.0,
        "humidity_pct": 58.0,
        "pressure_hpa": 1016.0,
        "pressure_trend_hpa_h": 0.1,
        "base_cooling_c_h": -0.25,
        "radiative_leaf_drop_c": 0.9,
        "soil_moisture_pct": 55.0,
    },
}


class VirtualTwinDriver(SensorProvider, ActuatorController):
    def __init__(self):
        self._lock = threading.Lock()
        self.scenario_id = "chuy_april_frost"
        self.sim_hour = 21.0
        self.air_temp_c = 6.8
        self.humidity_pct = 64.0
        self.pressure_hpa = 1022.0
        self.pressure_trend_hpa_h = 0.9
        self.base_cooling_c_h = -1.45
        self.radiative_leaf_drop_c = 2.3
        self.soil_moisture_pct = 52.0

        # Time-machine mode (1 = real-time slow drift, 120 = 6 hours in ~15-20s for pitch demo)
        self.time_scale = 0.0  # 0 = paused steady manual/live, >0 = fast-forward active
        self.live_weather_source = "simulated"
        self.actuators = ActuatorState()
        self.history: List[Dict[str, Any]] = []
        self._seed_initial_history()

    def _seed_initial_history(self) -> None:
        """Populate 12 historical points so charts look rich immediately on page load."""
        self.history = []
        for i in range(11, -1, -1):
            h = (self.sim_hour - i * 0.25) % 24.0
            t_air = round(self.air_temp_c - self.base_cooling_c_h * (i * 0.25), 2)
            t_leaf = round(t_air - self._compute_leaf_drop(h, self.actuators.sprinkler_on, self.actuators.heater_on), 2)
            dp = compute_dew_point(t_air, self.humidity_pct)
            self.history.append({
                "label": f"{int(h):02d}:{int((h % 1) * 60):02d}",
                "hour": round(h, 2),
                "air_temp_c": t_air,
                "leaf_temp_c": t_leaf,
                "dew_point_c": dp,
                "humidity_pct": round(self.humidity_pct, 1),
            })

    def _compute_leaf_drop(self, hour: float, sprinkler_on: bool, heater_on: bool) -> float:
        is_night = hour >= 19.0 or hour <= 6.5
        drop = self.radiative_leaf_drop_c if is_night else 0.3
        # Physical effect of anti-frost actuators:
        # Micro-sprinkler releases latent heat of crystallization holding leaf >= +0.2°C
        # IR heater warms leaf surface directly by +3.2°C
        if sprinkler_on:
            drop -= 1.6
        if heater_on:
            drop -= 2.4
        return drop

    def _compute_solar_lux(self, hour: float) -> float:
        if 6.0 <= hour <= 19.5:
            phase = (hour - 6.0) / 13.5 * math.pi
            return round(max(50.0, math.sin(phase) * 48000.0), 0)
        return 8.0

    def load_scenario(self, scenario_id: str, auto_fast_forward: bool = False) -> Dict[str, Any]:
        if scenario_id not in SCENARIOS:
            scenario_id = "chuy_april_frost"
        sc = SCENARIOS[scenario_id]

        live_note = "simulated"
        air_t = sc["air_temp_c"]
        rh = sc["humidity_pct"]
        pres = sc["pressure_hpa"]
        sim_h = sc["sim_hour"]

        if scenario_id == "bishkek_live":
            try:
                url = (
                    "https://api.open-meteo.com/v1/forecast"
                    "?latitude=42.8746&longitude=74.5698"
                    "&current=temperature_2m,relative_humidity_2m,surface_pressure"
                    "&timezone=Asia%2FBishkek"
                )
                req = urllib.request.Request(url, headers={"User-Agent": "AgroGuardEdge/1.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                    cur = payload.get("current", {})
                    if "temperature_2m" in cur:
                        air_t = float(cur["temperature_2m"])
                        rh = float(cur.get("relative_humidity_2m", rh))
                        pres = float(cur.get("surface_pressure", pres))
                        now_local = datetime.now()
                        sim_h = now_local.hour + now_local.minute / 60.0
                        live_note = "Open-Meteo Live (Бишкек)"
            except Exception:
                live_note = "Open-Meteo Offline Fallback (Бишкек)"

        with self._lock:
            self.scenario_id = scenario_id
            self.sim_hour = sim_h
            self.air_temp_c = air_t
            self.humidity_pct = rh
            self.pressure_hpa = pres
            self.pressure_trend_hpa_h = sc["pressure_trend_hpa_h"]
            self.base_cooling_c_h = sc["base_cooling_c_h"]
            self.radiative_leaf_drop_c = sc["radiative_leaf_drop_c"]
            self.soil_moisture_pct = sc["soil_moisture_pct"]
            self.live_weather_source = live_note
            self.time_scale = 1.0 if auto_fast_forward else 0.0
            self.actuators = ActuatorState(auto_mode=True)
            self._seed_initial_history()

        return self.read_sensors().to_dict()

    def set_manual_params(self, params: Dict[str, Any]) -> None:
        with self._lock:
            if "air_temp_c" in params:
                self.air_temp_c = max(-12.0, min(42.0, float(params["air_temp_c"])))
            if "humidity_pct" in params:
                self.humidity_pct = max(15.0, min(99.0, float(params["humidity_pct"])))
            if "pressure_hpa" in params:
                self.pressure_hpa = max(980.0, min(1045.0, float(params["pressure_hpa"])))
            if "sim_hour" in params:
                self.sim_hour = float(params["sim_hour"]) % 24.0
            if "cooling_rate_c_h" in params:
                self.base_cooling_c_h = max(-3.0, min(3.0, float(params["cooling_rate_c_h"])))
            if "time_scale" in params:
                self.time_scale = max(0.0, min(2.0, float(params["time_scale"])))

    def step_simulation(self, dt_seconds: float = 1.0) -> None:
        """Advance virtual greenhouse physics by one tick."""
        with self._lock:
            if self.time_scale > 0:
                # 1.0 time_scale -> ~0.35 simulated hours per real second (~6h in 17 seconds!)
                sim_hours_step = 0.35 * self.time_scale * dt_seconds
                self.sim_hour = (self.sim_hour + sim_hours_step) % 24.0

                is_night = self.sim_hour >= 19.0 or self.sim_hour <= 6.2
                ambient_rate = self.base_cooling_c_h if is_night else +1.35

                # Physical thermal effect of running greenhouse actuators!
                thermal_boost = 0.0
                if self.actuators.heater_on:
                    thermal_boost += 2.1  # IR heater offsets radiative freeze
                if self.actuators.sprinkler_on:
                    thermal_boost += 0.9  # Latent heat stabilizes greenhouse air near >0°C
                    self.humidity_pct = min(96.0, self.humidity_pct + 2.0 * sim_hours_step)
                    self.soil_moisture_pct = min(92.0, self.soil_moisture_pct + 3.0 * sim_hours_step)
                if self.actuators.vent_open:
                    self.humidity_pct = max(48.0, self.humidity_pct - 12.0 * sim_hours_step)

                net_rate = ambient_rate + thermal_boost
                self.air_temp_c = max(-8.5, min(34.0, self.air_temp_c + net_rate * sim_hours_step))
                # Stop fast-forward gracefully after dawn (~07:30)
                if 7.3 <= self.sim_hour <= 8.2 and self.scenario_id in ("chuy_april_frost", "issykkul_radiative"):
                    self.time_scale = 0.0
            else:
                # Tiny realistic sensor micro-jitter when steady
                self.air_temp_c = round(self.air_temp_c + random.uniform(-0.03, 0.03), 2)
                if self.actuators.vent_open and self.humidity_pct > 58.0:
                    self.humidity_pct = round(max(55.0, self.humidity_pct - 0.6), 1)
                if self.actuators.heater_on and self.air_temp_c < 4.5:
                    self.air_temp_c = round(self.air_temp_c + 0.14, 2)

            # Record point in telemetry ring-buffer
            leaf_t = self._calc_current_leaf_temp()
            dp = compute_dew_point(self.air_temp_c, self.humidity_pct)
            self.history.append({
                "label": f"{int(self.sim_hour):02d}:{int((self.sim_hour % 1) * 60):02d}",
                "hour": round(self.sim_hour, 2),
                "air_temp_c": round(self.air_temp_c, 2),
                "leaf_temp_c": round(leaf_t, 2),
                "dew_point_c": dp,
                "humidity_pct": round(self.humidity_pct, 1),
            })
            if len(self.history) > 28:
                self.history = self.history[-28:]

    def _calc_current_leaf_temp(self) -> float:
        drop = self._compute_leaf_drop(self.sim_hour, self.actuators.sprinkler_on, self.actuators.heater_on)
        leaf = self.air_temp_c - drop
        # Physics of anti-frost micro-sprinkling: ice film crystallization buffers leaf surface around +0.2°C!
        if self.actuators.sprinkler_on and leaf < 0.25:
            leaf = 0.25 + (leaf - 0.25) * 0.15
        return round(leaf, 2)

    def read_sensors(self) -> SensorReading:
        with self._lock:
            leaf_t = self._calc_current_leaf_temp()
            dp = compute_dew_point(self.air_temp_c, self.humidity_pct)
            is_night = self.sim_hour >= 19.0 or self.sim_hour <= 6.2
            eff_cooling = self.base_cooling_c_h if is_night else +0.8
            if self.actuators.heater_on:
                eff_cooling += 1.6
            if self.actuators.sprinkler_on:
                eff_cooling += 0.6

            return SensorReading(
                timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S"),
                sim_hour=round(self.sim_hour, 2),
                air_temp_c=round(self.air_temp_c, 2),
                leaf_temp_c=leaf_t,
                humidity_pct=round(self.humidity_pct, 1),
                pressure_hpa=round(self.pressure_hpa, 1),
                pressure_trend_hpa_h=round(self.pressure_trend_hpa_h, 2),
                cooling_rate_c_h=round(eff_cooling, 2),
                dew_point_c=dp,
                soil_moisture_pct=round(self.soil_moisture_pct, 1),
                solar_lux=self._compute_solar_lux(self.sim_hour),
                scenario=self.scenario_id,
                driver_name=f"VirtualTwinDriver ({self.live_weather_source})",
            )

    def get_state(self) -> ActuatorState:
        with self._lock:
            return ActuatorState(**self.actuators.to_dict())

    def set_auto_mode(self, auto_mode: bool) -> ActuatorState:
        with self._lock:
            self.actuators.auto_mode = auto_mode
            if auto_mode:
                self.actuators.last_trigger_reason = "Включён автономный режим Edge-AI"
                self.actuators.last_trigger_reason_kg = "Автономдуу Edge-AI режими күйгүзүлдү"
            else:
                self.actuators.last_trigger_reason = "Ручное управление оператором"
                self.actuators.last_trigger_reason_kg = "Оператор тарабынан кол менен башкаруу"
            return ActuatorState(**self.actuators.to_dict())

    def apply_actuators(
        self,
        sprinkler_on: bool,
        heater_on: bool,
        vent_open: bool,
        reason_ru: str,
        reason_kg: str,
        failsafe: bool = False,
    ) -> ActuatorState:
        with self._lock:
            self.actuators.sprinkler_on = sprinkler_on
            self.actuators.heater_on = heater_on
            self.actuators.vent_open = vent_open
            self.actuators.failsafe_active = failsafe
            self.actuators.last_trigger_reason = reason_ru
            self.actuators.last_trigger_reason_kg = reason_kg
            return ActuatorState(**self.actuators.to_dict())

    def get_history(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.history)
