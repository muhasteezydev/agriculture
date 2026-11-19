export type Lang = "ru" | "kg";

export interface SensorReading {
  timestamp: string;
  sim_hour: number;
  air_temp_c: number;
  leaf_temp_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  pressure_trend_hpa_h: number;
  cooling_rate_c_h: number;
  dew_point_c: number;
  soil_moisture_pct: number;
  solar_lux: number;
  scenario: string;
  driver_name: string;
}

export interface ForecastPoint {
  offset_h: number;
  label: string;
  hour: number;
  pred_air_c: number;
  pred_leaf_c: number;
  dew_point_c: number;
}

export interface FrostPrediction {
  dew_point_c: number;
  leaf_air_delta_c: number;
  frost_risk_pct: number;
  frost_level: "safe" | "warning" | "critical";
  min_predicted_leaf_c: number;
  min_predicted_air_c: number;
  hours_to_frost: number | null;
  fungal_risk_pct: number;
  failsafe_triggered: boolean;
  recommended_actions: {
    sprinkler: boolean;
    heater: boolean;
    vent: boolean;
  };
  forecast_6h: ForecastPoint[];
  inference_ms: number;
  model_name: string;
}

export interface ActuatorState {
  sprinkler_on: boolean;
  heater_on: boolean;
  vent_open: boolean;
  auto_mode: boolean;
  failsafe_active: boolean;
  last_trigger_reason: string;
  last_trigger_reason_kg: string;
}

export interface HistoryPoint {
  label: string;
  hour: number;
  air_temp_c: number;
  leaf_temp_c: number;
  dew_point_c: number;
  humidity_pct: number;
}

export interface CVResult {
  disease_id: string;
  severity: "safe" | "warning" | "critical";
  name_ru: string;
  name_kg: string;
  crop_hint_ru: string;
  crop_hint_kg: string;
  advice_ru: string;
  advice_kg: string;
  color: string;
  affected_sector: string | null;
  confidence_pct: number;
  affected_area_pct: number;
  lesion_count: number;
  pest_count: number;
  annotated_image: string;
  inference_ms: number;
  model_name: string;
  source: string;
}

export interface TelegramButton {
  id: string;
  label_ru: string;
  label_kg: string;
}

export interface TelegramMessage {
  id: number;
  ts: string;
  sender: "bot" | "farmer";
  severity: string;
  title_ru: string;
  title_kg: string;
  text_ru: string;
  text_kg: string;
  image_b64: string | null;
  buttons: TelegramButton[];
  delivered_real_telegram: boolean;
}

export interface EventItem {
  id: number;
  ts: string;
  event_type: string;
  severity: string;
  title_ru: string;
  title_kg: string;
  body_ru: string;
  body_kg: string;
}

export interface AppSnapshot {
  sensors: SensorReading;
  prediction: FrostPrediction;
  actuators: ActuatorState;
  time_scale: number;
  offline_edge_mode: boolean;
  history: HistoryPoint[];
  latest_cv: CVResult | null;
  last_cv_scan_ts: number;
  telegram_messages: TelegramMessage[];
  real_telegram_connected: boolean;
  events: EventItem[];
}

export interface ScenarioMeta {
  id: string;
  name_ru: string;
  name_kg: string;
  desc_ru: string;
  desc_kg: string;
}

export interface SampleMeta {
  id: string;
  file: string;
  name_ru: string;
  name_kg: string;
  thumbnail: string;
}
