"""
Hardware Abstraction Layer (HAL) interfaces for AgroGuard Edge.

During the $0 hackathon MVP, VirtualTwinDriver implements these interfaces to drive
the 3D Digital Twin. For hardware deployment (Raspberry Pi Zero 2W / ESP32-S3),
swap in RaspberryPiDriver / ESP32Driver without changing any AI or backend logic.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class SensorReading:
    timestamp: str
    sim_hour: float            # 0.0 .. 24.0 (simulated local clock)
    air_temp_c: float          # SHT41 air temperature (°C)
    leaf_temp_c: float         # MLX90614 IR leaf surface temperature (°C)
    humidity_pct: float        # SHT41 relative humidity (%)
    pressure_hpa: float        # BME280 barometric pressure (hPa)
    pressure_trend_hpa_h: float  # dP/dt (hPa/hour, positive = clearing sky)
    cooling_rate_c_h: float    # dT/dt (°C/hour)
    dew_point_c: float         # Computed via Magnus formula (°C)
    soil_moisture_pct: float   # Capacitive soil sensor (%)
    solar_lux: float           # Light intensity (lux)
    scenario: str
    driver_name: str = "VirtualTwinDriver (HAL v1)"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ActuatorState:
    sprinkler_on: bool = False    # Channel 1: 12V anti-frost micro-sprinkler valve
    heater_on: bool = False       # Channel 2: IR greenhouse heater relay
    vent_open: bool = False       # Roof ventilation flaps (fungal humidity control)
    auto_mode: bool = True        # Autonomous Edge-AI decision loop
    failsafe_active: bool = False # Hardware-level failsafe override
    last_trigger_reason: str = "Нормальный режим мониторинга"
    last_trigger_reason_kg: str = "Кадимки мониторинг режими"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SensorProvider(ABC):
    @abstractmethod
    def read_sensors(self) -> SensorReading:
        """Return latest sensor telemetry packet."""
        raise NotImplementedError


class ActuatorController(ABC):
    @abstractmethod
    def get_state(self) -> ActuatorState:
        """Return current relay/actuator state."""
        raise NotImplementedError

    @abstractmethod
    def apply_actuators(
        self,
        sprinkler_on: bool,
        heater_on: bool,
        vent_open: bool,
        reason_ru: str,
        reason_kg: str,
        failsafe: bool = False,
    ) -> ActuatorState:
        """Physically or virtually switch actuator relays."""
        raise NotImplementedError
