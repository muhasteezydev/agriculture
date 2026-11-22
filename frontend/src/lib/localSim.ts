import {
  ActuatorState,
  AppSnapshot,
  CVResult,
  ForecastPoint,
  FrostPrediction,
  HistoryPoint,
  SampleMeta,
  ScenarioMeta,
  SensorReading,
  TelegramMessage,
} from "../types";

export const LOCAL_SCENARIOS: (ScenarioMeta & {
  sim_hour: number;
  air_temp_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  pressure_trend_hpa_h: number;
  base_cooling_c_h: number;
  radiative_leaf_drop_c: number;
  soil_moisture_pct: number;
})[] = [
  {
    id: "chuy_april_frost",
    name_ru: "Апрельский заморозок — Чуйская долина",
    name_kg: "Апрель үшүгү — Чүй өрөөнү",
    desc_ru: "Резкое ночное похолодание с +6.8°C до −2.8°C к рассвету при ясном небе",
    desc_kg: "Ачык түндө температура +6.8°Cден таңга маал −2.8°Cге кескин түшөт",
    sim_hour: 21.0,
    air_temp_c: 6.8,
    humidity_pct: 64.0,
    pressure_hpa: 1022.0,
    pressure_trend_hpa_h: 0.9,
    base_cooling_c_h: -1.45,
    radiative_leaf_drop_c: 2.3,
    soil_moisture_pct: 52.0,
  },
  {
    id: "issykkul_radiative",
    name_ru: "Ясная ночь — Иссык-Куль (радиационный холод)",
    name_kg: "Ачык түн — Ысык-Көл (радиациялык суук)",
    desc_ru: "Воздух +3.4°C, но листья остывают на 3.2°C ниже воздуха",
    desc_kg: "Аба +3.4°C, бирок жалбырактар абадан 3.2°C муздак",
    sim_hour: 23.5,
    air_temp_c: 3.4,
    humidity_pct: 56.0,
    pressure_hpa: 1026.5,
    pressure_trend_hpa_h: 1.2,
    base_cooling_c_h: -1.15,
    radiative_leaf_drop_c: 3.2,
    soil_moisture_pct: 48.0,
  },
  {
    id: "greenhouse_fungal",
    name_ru: "Теплица: влажность 91% (риск фитофторы)",
    name_kg: "Күнөскана: нымдуулук 91% (фитофтора коркунучу)",
    desc_ru: "Конденсат на листьях при +16.2°C — риск грибковой вспышки",
    desc_kg: "Жабык күнөсканада +16.2°C жана конденсат — козу карын коркунучу",
    sim_hour: 6.5,
    air_temp_c: 16.2,
    humidity_pct: 91.5,
    pressure_hpa: 1011.0,
    pressure_trend_hpa_h: -0.4,
    base_cooling_c_h: -0.1,
    radiative_leaf_drop_c: 0.6,
    soil_moisture_pct: 78.0,
  },
  {
    id: "bishkek_live",
    name_ru: "Живая погода — Бишкек (Open-Meteo API)",
    name_kg: "Чыныгы аба ырайы — Бишкек (Open-Meteo)",
    desc_ru: "Текущие показания погоды в Бишкеке + физика теплицы",
    desc_kg: "Бишкектин учурдагы аба ырайы + күнөскана физикасы",
    sim_hour: 14.0,
    air_temp_c: 12.0,
    humidity_pct: 58.0,
    pressure_hpa: 1016.0,
    pressure_trend_hpa_h: 0.1,
    base_cooling_c_h: -0.25,
    radiative_leaf_drop_c: 0.9,
    soil_moisture_pct: 55.0,
  },
];

function computeDewPoint(tempC: number, rhPct: number): number {
  const rh = Math.max(1, Math.min(100, rhPct));
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return Math.round(Math.min(tempC, (b * gamma) / (a - gamma)) * 100) / 100;
}

function sigmoid(x: number): number {
  if (x < -30) return 0;
  if (x > 30) return 1;
  return 1 / (1 + Math.exp(-x));
}

function fmtHour(h: number): string {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor(((((h % 1) + 1) % 1) * 60));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderSampleLeaf(id: string, annotated = false): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = 160;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  if (id === "sticky_trap_pests") {
    ctx.fillStyle = "#EAB308";
    ctx.fillRect(0, 0, 240, 160);
    ctx.fillStyle = "#1F1D1A";
    const bugs: [number, number][] = [[64, 52], [118, 86], [164, 48], [140, 114], [88, 108]];
    for (const [bx, by] of bugs) {
      ctx.beginPath();
      ctx.ellipse(bx, by, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (annotated) {
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(48, 34, 136, 98);
    }
    return c.toDataURL("image/png");
  }

  ctx.fillStyle = "#162418";
  ctx.fillRect(0, 0, 240, 160);
  // Leaf silhouette
  ctx.fillStyle = "#2F7D3E";
  ctx.beginPath();
  ctx.ellipse(120, 82, 74, 46, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4DA85C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(52, 92);
  ctx.lineTo(188, 72);
  ctx.stroke();

  if (id === "late_blight") {
    ctx.fillStyle = "#4A2E1B";
    ctx.beginPath();
    ctx.ellipse(98, 76, 22, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(148, 92, 18, 13, -0.3, 0, Math.PI * 2);
    ctx.fill();
    if (annotated) {
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(72, 56, 54, 40);
      ctx.strokeRect(126, 74, 44, 34);
    }
  } else if (id === "powdery_mildew") {
    ctx.fillStyle = "rgba(240, 246, 238, 0.85)";
    ctx.beginPath();
    ctx.ellipse(115, 72, 26, 15, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(152, 86, 16, 11, -0.2, 0, Math.PI * 2);
    ctx.fill();
    if (annotated) {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(86, 53, 86, 48);
    }
  } else if (id === "scab_rust") {
    ctx.fillStyle = "#C26A1F";
    ctx.beginPath();
    ctx.ellipse(106, 86, 16, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(144, 70, 14, 11, -0.2, 0, Math.PI * 2);
    ctx.fill();
    if (annotated) {
      ctx.strokeStyle = "#F97316";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(86, 56, 76, 46);
    }
  }
  return c.toDataURL("image/png");
}

const CV_PRESETS: Record<string, Omit<CVResult, "annotated_image" | "inference_ms" | "source" | "pest_count" | "model_name">> = {
  healthy: {
    disease_id: "healthy",
    severity: "safe",
    name_ru: "Здоровое растение",
    name_kg: "Дени сак өсүмдүк",
    crop_hint_ru: "Листовая пластина без признаков патологии",
    crop_hint_kg: "Жалбыракта оорунун белгилери жок",
    advice_ru: "Обработка не требуется. Продолжайте плановый мониторинг.",
    advice_kg: "Дарылоо талап кылынбайт. Пландалган байкоону улантыңыз.",
    confidence_pct: 96,
    affected_area_pct: 0.4,
    lesion_count: 0,
    affected_sector: null,
    color: "#10B981",
  },
  late_blight: {
    disease_id: "late_blight",
    severity: "critical",
    name_ru: "Фитофтороз (ранняя стадия)",
    name_kg: "Фитофтороз (баштапкы стадия)",
    crop_hint_ru: "Томат — тёмные некротические очаги",
    crop_hint_kg: "Помидор — кара некроздук тактар",
    advice_ru: "Включите вентиляцию для снижения влажности ниже 75%, удалите поражённые листья и проведите точечную обработку биофунгицидом.",
    advice_kg: "Нымдуулукту 75%дан төмөндөтүү үчүн желдетүүнү күйгүзүңүз, жабыркаган жалбырактарды алыңыз жана биофунгицид чачыңыз.",
    confidence_pct: 95,
    affected_area_pct: 24.6,
    lesion_count: 2,
    affected_sector: "Сектор B (Ряд 2)",
    color: "#EF4444",
  },
  powdery_mildew: {
    disease_id: "powdery_mildew",
    severity: "warning",
    name_ru: "Мучнистая роса (грибок)",
    name_kg: "Ун шүүдүрүмү (козу карын)",
    crop_hint_ru: "Томат / Огурец — белый мучнистый налёт",
    crop_hint_kg: "Помидор / Бадыраң — ак ун сымал өңөр",
    advice_ru: "Проветрите теплицу, снизьте ночной перепад температур и проведите локальную обработку биопрепаратом.",
    advice_kg: "Күнөскананы желдетип, жабыркаган жерлерге гана биопрепарат чачыңыз.",
    confidence_pct: 94,
    affected_area_pct: 18.2,
    lesion_count: 2,
    affected_sector: "Сектор A (Ряд 1)",
    color: "#F59E0B",
  },
  scab_rust: {
    disease_id: "scab_rust",
    severity: "warning",
    name_ru: "Пятнистость / Ржавчина листа",
    name_kg: "Жалбырак тагы / Дат оорусу",
    crop_hint_ru: "Клубника — буро-оранжевые пятна и хлороз",
    crop_hint_kg: "Кулпунай — күрөң-сары тактар жана хлороз",
    advice_ru: "Исключите дождевание по листу днём и обработайте очаг фунгицидом.",
    advice_kg: "Күндүз жалбыракка суу чачууну токтотуп, очокту фунгицид менен иштетиңиз.",
    confidence_pct: 93,
    affected_area_pct: 14.8,
    lesion_count: 2,
    affected_sector: "Сектор C (Ряд 3)",
    color: "#F97316",
  },
  sticky_trap_pests: {
    disease_id: "sticky_trap_pests",
    severity: "critical",
    name_ru: "Вредители на ловушке (Тля / Белокрылка)",
    name_kg: "Тузактагы зыянкечтер (Бит / Ак канат)",
    crop_hint_ru: "Клубника — превышен порог численности на ловушке",
    crop_hint_kg: "Кулпунай — тузактагы зыянкечтердин чеги ашты",
    advice_ru: "Выявлено скопление вредителей на клеевой ловушке. Рекомендуется точечная биообработка очага.",
    advice_kg: "Тузакта зыянкечтер көбөйдү. Очокко точечный биопрепарат чачуу сунушталат.",
    confidence_pct: 97,
    affected_area_pct: 11.5,
    lesion_count: 5,
    affected_sector: "Сектор D (Ловушка #2)",
    color: "#E11D48",
  },
};

export class LocalSimEngine {
  scenarioId = "chuy_april_frost";
  simHour = 21.0;
  airTempC = 6.8;
  humidityPct = 64.0;
  pressureHpa = 1022.0;
  pressureTrend = 0.9;
  baseCooling = -1.45;
  radiativeDrop = 2.3;
  soilMoisture = 52.0;
  timeScale = 0.08;
  offlineMode = false;
  actuatorLeafBoost = 0.0;
  actuators: ActuatorState = {
    sprinkler_on: false,
    heater_on: false,
    vent_open: false,
    auto_mode: true,
    failsafe_active: false,
    last_trigger_reason: "Микроклимат в норме — дежурный мониторинг",
    last_trigger_reason_kg: "Микроклимат нормада — мониторинг режими",
  };
  history: HistoryPoint[] = [];
  latestCv: CVResult | null = null;
  lastCvScanTs = 0;
  messages: TelegramMessage[] = [
    {
      id: 1,
      ts: nowHHMM(),
      sender: "bot",
      severity: "safe",
      title_ru: "🌱 AgroGuard Edge запущен (автономный режим)",
      title_kg: "🌱 AgroGuard Edge ишке кирди (автономдуу режим)",
      text_ru: "Контроллер теплицы активен. Автозащита от заморозков и мониторинг болезней включены.",
      text_kg: "Күнөскана контроллери активдүү. Үшүктөн автокоргоо жана ооруларды көзөмөлдөө күйүк.",
      image_b64: null,
      delivered_real_telegram: false,
      buttons: [
        { id: "sprinkler_toggle", label_ru: "💧 Полив", label_kg: "💧 Сугаруу" },
        { id: "heater_toggle", label_ru: "🔥 Обогрев", label_kg: "🔥 Жылытуу" },
      ],
    },
  ];
  private nextMsgId = 2;
  private lastFrostAlert = false;

  constructor() {
    this.seedHistory();
    this.evaluateAndAct(true);
  }

  getSamples(): SampleMeta[] {
    return [
      { id: "healthy", file: "healthy.png", name_ru: "Здоровый лист", name_kg: "Дени сак жалбырак", thumbnail: renderSampleLeaf("healthy") },
      { id: "late_blight", file: "late_blight.png", name_ru: "Фитофтороз (томат)", name_kg: "Фитофтороз (помидор)", thumbnail: renderSampleLeaf("late_blight") },
      { id: "powdery_mildew", file: "powdery_mildew.png", name_ru: "Мучнистая роса", name_kg: "Ун шүүдүрүмү", thumbnail: renderSampleLeaf("powdery_mildew") },
      { id: "scab_rust", file: "scab_rust.png", name_ru: "Пятнистость / Ржавчина", name_kg: "Жалбырак тагы / Дат", thumbnail: renderSampleLeaf("scab_rust") },
      { id: "sticky_trap_pests", file: "sticky_trap_pests.png", name_ru: "Жёлтая ловушка (тля)", name_kg: "Сары тузак (бит)", thumbnail: renderSampleLeaf("sticky_trap_pests") },
    ];
  }

  private seedHistory() {
    this.history = [];
    for (let i = 11; i >= 0; i--) {
      const h = (this.simHour - i * 0.25 + 24) % 24;
      const tAir = Math.round((this.airTempC - this.baseCooling * (i * 0.25)) * 100) / 100;
      const isNight = h >= 19.0 || h <= 6.5;
      const tLeaf = Math.round((tAir - (isNight ? this.radiativeDrop : 0.3)) * 100) / 100;
      this.history.push({
        label: fmtHour(h),
        hour: Math.round(h * 100) / 100,
        air_temp_c: tAir,
        leaf_temp_c: tLeaf,
        dew_point_c: computeDewPoint(tAir, this.humidityPct),
        humidity_pct: Math.round(this.humidityPct * 10) / 10,
      });
    }
  }

  private getUnprotectedLeaf(): number {
    const isNight = this.simHour >= 19.0 || this.simHour <= 6.5;
    return Math.round((this.airTempC - (isNight ? this.radiativeDrop : 0.3)) * 100) / 100;
  }

  private getCurrentLeaf(): number {
    let leaf = this.getUnprotectedLeaf() + this.actuatorLeafBoost;
    if (this.actuators.sprinkler_on && leaf < 0.25) {
      leaf = 0.25 + (leaf - 0.25) * 0.15;
    }
    return Math.round(leaf * 100) / 100;
  }

  private predict(ambientLeaf: number, actualLeaf: number, coolingRate: number): FrostPrediction {
    const dewPoint = computeDewPoint(this.airTempC, this.humidityPct);
    const leafDelta = ambientLeaf - this.airTempC;
    const radFactor = Math.max(0, this.pressureTrend) * 0.35 + Math.max(0, -leafDelta - 0.8) * 0.25;
    const forecast: ForecastPoint[] = [];
    let curAir = this.airTempC;
    let minLeaf = ambientLeaf;
    let minAir = this.airTempC;
    let hoursToFrost: number | null = null;

    for (let h = 1; h <= 6; h++) {
      const fh = (this.simHour + h) % 24;
      let drift: number;
      if (fh >= 7 && fh <= 15) {
        drift = 0.75 * Math.sin(((fh - 7) / 8) * Math.PI);
      } else if (fh > 15 && fh < 19) {
        drift = -0.35 * ((fh - 15) / 4);
      } else {
        drift = -0.55 - radFactor * 0.45;
      }
      const decay = Math.exp(-0.28 * h);
      const stepRate = coolingRate * decay + drift * (1 - decay);
      let nextAir = curAir + stepRate;
      if (nextAir < dewPoint && this.humidityPct > 75) {
        nextAir = dewPoint + (nextAir - dewPoint) * 0.72;
      }
      curAir = nextAir;
      const isNight = fh >= 19 || fh <= 6.5;
      const extraDrop = Math.abs(Math.min(0, leafDelta)) * (isNight ? 1.05 : 0.4);
      const predAir = Math.round(curAir * 100) / 100;
      const predLeaf = Math.round((curAir - extraDrop) * 100) / 100;
      const fDew = Math.round(Math.min(predAir, dewPoint) * 100) / 100;
      if (predLeaf < minLeaf) minLeaf = predLeaf;
      if (predAir < minAir) minAir = predAir;
      if (hoursToFrost === null && predLeaf <= 0.5) hoursToFrost = h;
      forecast.push({
        offset_h: h,
        label: `+${h}ч (${String(Math.floor(fh)).padStart(2, "0")}:00)`,
        hour: Math.round(fh * 10) / 10,
        pred_air_c: predAir,
        pred_leaf_c: predLeaf,
        dew_point_c: fDew,
      });
    }

    const logit =
      1.55 * (1.6 - minLeaf) +
      0.45 * Math.max(0, -coolingRate) +
      0.35 * Math.max(0, 2.0 - dewPoint) +
      0.25 * Math.max(0, this.pressureTrend);
    let risk = Math.round(sigmoid(logit) * 100);
    if (ambientLeaf <= 0.5) {
      risk = Math.max(risk, 96);
      hoursToFrost = 0;
    }

    const dewSpread = Math.abs(this.airTempC - dewPoint);
    const condRisk = Math.max(0, 1 - dewSpread / 3.5);
    const tempSuit = this.airTempC >= 10 && this.airTempC <= 26 ? 1.0 : 0.35;
    const fungal = Math.round(
      Math.min(100, Math.max(0, ((Math.max(0, this.humidityPct - 62) / 38) * 65 + condRisk * 35) * tempSuit))
    );

    const level: FrostPrediction["frost_level"] =
      risk >= 75 || ambientLeaf <= 1.5 ? "critical" : risk >= 45 ? "warning" : "safe";
    const failsafe = (ambientLeaf <= 1.5 && coolingRate < -0.15) || ambientLeaf <= 0.8;

    return {
      dew_point_c: dewPoint,
      leaf_air_delta_c: Math.round((actualLeaf - this.airTempC) * 100) / 100,
      frost_risk_pct: risk,
      frost_level: level,
      min_predicted_leaf_c: Math.round(minLeaf * 100) / 100,
      min_predicted_air_c: Math.round(minAir * 100) / 100,
      hours_to_frost: hoursToFrost,
      fungal_risk_pct: fungal,
      failsafe_triggered: failsafe,
      recommended_actions: {
        sprinkler: risk >= 72 || failsafe,
        heater: risk >= 62 || ambientLeaf <= 2.2,
        vent: fungal >= 72 && !(risk >= 62 || ambientLeaf <= 2.2) && this.airTempC > 8,
      },
      forecast_6h: forecast,
      inference_ms: 0.1,
      model_name: "FrostGuard-Physics-Edge (Browser)",
    };
  }

  private evaluateAndAct(initial = false) {
    const isNight = this.simHour >= 19 || this.simHour <= 6.2;
    const cooling = isNight ? this.baseCooling : 0.8;
    const pred = this.predict(this.getUnprotectedLeaf(), this.getCurrentLeaf(), cooling);

    if (this.actuators.auto_mode || pred.failsafe_triggered) {
      const rec = pred.recommended_actions;
      const newSpr = rec.sprinkler || (this.actuators.sprinkler_on && pred.frost_risk_pct >= 45);
      const newHeat = rec.heater || (this.actuators.heater_on && pred.frost_risk_pct >= 45);
      const newVent = rec.vent && !newHeat;

      if (pred.failsafe_triggered) {
        this.actuators.last_trigger_reason = `Аварийная защита: лист ${this.getCurrentLeaf().toFixed(1)}°C — полив и обогрев включены`;
        this.actuators.last_trigger_reason_kg = `Авариялык коргоо: жалбырак ${this.getCurrentLeaf().toFixed(1)}°C — сугаруу жана жылытуу күйүк`;
      } else if (newSpr || newHeat) {
        const activeRu = [newSpr ? "полив" : "", newHeat ? "обогрев" : ""].filter(Boolean).join(" и ");
        const activeKg = [newSpr ? "сугаруу" : "", newHeat ? "жылытуу" : ""].filter(Boolean).join(" жана ");
        this.actuators.last_trigger_reason = `Защита работает: включён ${activeRu} (риск ${pred.frost_risk_pct}%, без защиты ${pred.min_predicted_leaf_c.toFixed(1)}°C)`;
        this.actuators.last_trigger_reason_kg = `Коргоо иштөөдө: ${activeKg} күйүк (коркунуч ${pred.frost_risk_pct}%, коргоосуз ${pred.min_predicted_leaf_c.toFixed(1)}°C)`;
      } else if (newVent) {
        this.actuators.last_trigger_reason = `Защита от грибка: открыты окна (влажность ${this.humidityPct.toFixed(0)}%)`;
        this.actuators.last_trigger_reason_kg = `Козу карындан коргоо: терезелер ачык (нымдуулук ${this.humidityPct.toFixed(0)}%)`;
      } else {
        this.actuators.last_trigger_reason = "Микроклимат в норме — дежурный мониторинг";
        this.actuators.last_trigger_reason_kg = "Микроклимат нормада — мониторинг режими";
      }

      this.actuators.sprinkler_on = newSpr;
      this.actuators.heater_on = newHeat;
      this.actuators.vent_open = newVent;
      this.actuators.failsafe_active = pred.failsafe_triggered;

      const isAlert = (newSpr || newHeat) && pred.frost_risk_pct >= 65;
      if (isAlert && !this.lastFrostAlert && !initial) {
        this.lastFrostAlert = true;
        this.messages.push({
          id: this.nextMsgId++,
          ts: nowHHMM(),
          sender: "bot",
          severity: "critical",
          title_ru: `❄️ Угроза заморозка (${pred.frost_risk_pct}%)`,
          title_kg: `❄️ Үшүк коркунучу (${pred.frost_risk_pct}%)`,
          text_ru: `Прогноз минимума за 6 ч: ${pred.min_predicted_leaf_c.toFixed(1)}°C. Включены полив и обогрев.`,
          text_kg: `6 сааттагы минимум: ${pred.min_predicted_leaf_c.toFixed(1)}°C. Сугаруу жана жылытуу күйүк.`,
          image_b64: null,
          delivered_real_telegram: false,
          buttons: [
            { id: "sprinkler_toggle", label_ru: "💧 Полив", label_kg: "💧 Сугаруу" },
            { id: "heater_toggle", label_ru: "🔥 Обогрев", label_kg: "🔥 Жылытуу" },
          ],
        });
      } else if (!isAlert) {
        this.lastFrostAlert = false;
      }
    }
  }

  step() {
    if (this.timeScale > 0) {
      const simStep = 0.35 * this.timeScale;
      this.simHour = (this.simHour + simStep) % 24;
      const isNight = this.simHour >= 19 || this.simHour <= 6.2;
      const ambientRate = isNight ? this.baseCooling : 1.35;
      let boost = 0;
      if (this.actuators.heater_on && this.airTempC < 4.2) {
        boost += 2.2 * Math.max(0, Math.min(1, (4.2 - this.airTempC) / 2.2));
      }
      if (this.actuators.sprinkler_on) {
        if (this.airTempC < 2.8) boost += 0.9;
        this.humidityPct = Math.min(96, this.humidityPct + 2.0 * simStep);
      }
      if (this.actuators.vent_open) {
        this.humidityPct = Math.max(48, this.humidityPct - 12.0 * simStep);
      }
      this.airTempC = Math.max(-8.5, Math.min(34, this.airTempC + (ambientRate + boost) * simStep));
      if (this.simHour >= 7.3 && this.simHour <= 8.2 && (this.scenarioId === "chuy_april_frost" || this.scenarioId === "issykkul_radiative")) {
        this.timeScale = 0.08;
      }
    }

    const targetBoost = (this.actuators.sprinkler_on ? 1.6 : 0) + (this.actuators.heater_on ? 2.4 : 0);
    this.actuatorLeafBoost += (targetBoost - this.actuatorLeafBoost) * 0.35;

    this.evaluateAndAct();

    const pt: HistoryPoint = {
      label: fmtHour(this.simHour),
      hour: Math.round(this.simHour * 100) / 100,
      air_temp_c: Math.round(this.airTempC * 100) / 100,
      leaf_temp_c: this.getCurrentLeaf(),
      dew_point_c: computeDewPoint(this.airTempC, this.humidityPct),
      humidity_pct: Math.round(this.humidityPct * 10) / 10,
    };
    if (this.timeScale > 0 || this.history.length === 0) {
      this.history.push(pt);
    } else {
      this.history[this.history.length - 1] = pt;
    }
    if (this.history.length > 28) this.history = this.history.slice(-28);
  }

  async loadScenario(scenarioId: string, fastForward = false) {
    const sc = LOCAL_SCENARIOS.find((s) => s.id === scenarioId) ?? LOCAL_SCENARIOS[0];
    this.scenarioId = sc.id;
    this.simHour = sc.sim_hour;
    this.airTempC = sc.air_temp_c;
    this.humidityPct = sc.humidity_pct;
    this.pressureHpa = sc.pressure_hpa;
    this.pressureTrend = sc.pressure_trend_hpa_h;
    this.baseCooling = sc.base_cooling_c_h;
    this.radiativeDrop = sc.radiative_leaf_drop_c;
    this.soilMoisture = sc.soil_moisture_pct;
    this.timeScale = fastForward ? 1.0 : 0.08;
    this.actuators.auto_mode = true;
    this.actuatorLeafBoost = 0;

    if (scenarioId === "bishkek_live") {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=42.8746&longitude=74.5698&current=temperature_2m,relative_humidity_2m,surface_pressure&timezone=Asia%2FBishkek"
        );
        const data = await res.json();
        if (data?.current?.temperature_2m !== undefined) {
          this.airTempC = Number(data.current.temperature_2m);
          this.humidityPct = Number(data.current.relative_humidity_2m ?? this.humidityPct);
          this.pressureHpa = Number(data.current.surface_pressure ?? this.pressureHpa);
          const now = new Date();
          this.simHour = now.getHours() + now.getMinutes() / 60;
        }
      } catch {
        // fallback to default Bishkek values
      }
    }

    this.seedHistory();
    this.evaluateAndAct();
  }

  setParams(params: Record<string, unknown>) {
    let hourChanged = false;
    if (typeof params.air_temp_c === "number") this.airTempC = params.air_temp_c;
    if (typeof params.humidity_pct === "number") this.humidityPct = params.humidity_pct;
    if (typeof params.sim_hour === "number") {
      hourChanged = Math.abs(params.sim_hour - this.simHour) > 0.05;
      this.simHour = params.sim_hour % 24;
    }
    if (typeof params.time_scale === "number") this.timeScale = params.time_scale;
    if (typeof params.offline_edge_mode === "boolean") this.offlineMode = params.offline_edge_mode;
    if (hourChanged) this.seedHistory();
    this.evaluateAndAct();
  }

  setActuators(params: Record<string, unknown>) {
    if (typeof params.auto_mode === "boolean") {
      this.actuators.auto_mode = params.auto_mode;
    } else {
      this.actuators.auto_mode = false;
      if (typeof params.sprinkler_on === "boolean") this.actuators.sprinkler_on = params.sprinkler_on;
      if (typeof params.heater_on === "boolean") this.actuators.heater_on = params.heater_on;
      if (typeof params.vent_open === "boolean") this.actuators.vent_open = params.vent_open;
      this.actuators.last_trigger_reason = "Ручное управление оператором";
      this.actuators.last_trigger_reason_kg = "Оператор тарабынан кол менен башкаруу";
    }
    this.evaluateAndAct();
  }

  analyzeSample(sampleId: string, uploadedBase64?: string) {
    const key = CV_PRESETS[sampleId] ? sampleId : "late_blight";
    const meta = CV_PRESETS[key];
    this.latestCv = {
      ...meta,
      pest_count: key === "sticky_trap_pests" ? 5 : 0,
      model_name: "AgroGuard-HSV-Edge (Browser)",
      annotated_image: uploadedBase64 || renderSampleLeaf(key, true),
      inference_ms: Math.round((24 + Math.random() * 18) * 10) / 10,
      source: uploadedBase64 ? "upload" : `sample:${key}`,
    };
    this.lastCvScanTs = Date.now() / 1000;
    this.messages.push({
      id: this.nextMsgId++,
      ts: nowHHMM(),
      sender: "bot",
      severity: meta.severity,
      title_ru: `🌿 ${meta.name_ru} (${meta.confidence_pct}%)`,
      title_kg: `🌿 ${meta.name_kg} (${meta.confidence_pct}%)`,
      text_ru: meta.advice_ru,
      text_kg: meta.advice_kg,
      image_b64: this.latestCv.annotated_image,
      buttons: [],
      delivered_real_telegram: false,
    });
  }

  telegramAction(cmd: string) {
    if (cmd === "sprinkler_toggle") {
      this.setActuators({ sprinkler_on: !this.actuators.sprinkler_on });
      this.messages.push({
        id: this.nextMsgId++,
        ts: nowHHMM(),
        sender: "farmer",
        severity: "info",
        title_ru: "",
        title_kg: "",
        text_ru: `💧 Полив: ${this.actuators.sprinkler_on ? "ВКЛ" : "ВЫКЛ"}`,
        text_kg: `💧 Сугаруу: ${this.actuators.sprinkler_on ? "КҮЙҮК" : "ӨЧҮК"}`,
        image_b64: null,
        buttons: [],
        delivered_real_telegram: false,
      });
    } else if (cmd === "heater_toggle") {
      this.setActuators({ heater_on: !this.actuators.heater_on });
      this.messages.push({
        id: this.nextMsgId++,
        ts: nowHHMM(),
        sender: "farmer",
        severity: "info",
        title_ru: "",
        title_kg: "",
        text_ru: `🔥 Обогрев: ${this.actuators.heater_on ? "ВКЛ" : "ВЫКЛ"}`,
        text_kg: `🔥 Жылытуу: ${this.actuators.heater_on ? "КҮЙҮК" : "ӨЧҮК"}`,
        image_b64: null,
        buttons: [],
        delivered_real_telegram: false,
      });
    } else if (cmd === "auto_on") {
      this.setActuators({ auto_mode: true });
      this.messages.push({
        id: this.nextMsgId++,
        ts: nowHHMM(),
        sender: "farmer",
        severity: "info",
        title_ru: "",
        title_kg: "",
        text_ru: "🤖 Автозащита включена",
        text_kg: "🤖 Автокоргоо күйгүзүлдү",
        image_b64: null,
        buttons: [],
        delivered_real_telegram: false,
      });
    }
  }

  getSnapshot(): AppSnapshot {
    const isNight = this.simHour >= 19 || this.simHour <= 6.2;
    const cooling = isNight ? this.baseCooling : 0.8;
    const actualLeaf = this.getCurrentLeaf();
    const pred = this.predict(this.getUnprotectedLeaf(), actualLeaf, cooling);
    const sensors: SensorReading = {
      timestamp: nowHHMM(),
      sim_hour: Math.round(this.simHour * 100) / 100,
      air_temp_c: Math.round(this.airTempC * 100) / 100,
      leaf_temp_c: actualLeaf,
      humidity_pct: Math.round(this.humidityPct * 10) / 10,
      pressure_hpa: Math.round(this.pressureHpa * 10) / 10,
      pressure_trend_hpa_h: this.pressureTrend,
      cooling_rate_c_h: cooling,
      dew_point_c: pred.dew_point_c,
      soil_moisture_pct: this.soilMoisture,
      solar_lux: isNight ? 8 : 34000,
      scenario: this.scenarioId,
      driver_name: "BrowserTwinEngine (Vercel Standalone)",
    };

    return {
      sensors,
      prediction: pred,
      actuators: { ...this.actuators },
      time_scale: this.timeScale,
      offline_edge_mode: this.offlineMode,
      history: [...this.history],
      latest_cv: this.latestCv,
      last_cv_scan_ts: this.lastCvScanTs,
      telegram_messages: [...this.messages],
      real_telegram_connected: false,
      events: [],
    };
  }
}
