import React, { useEffect, useState } from "react";
import {
  Sprout,
  Play,
  Pause,
  WifiOff,
  Wifi,
  Droplets,
  Flame,
  Wind,
  Sliders,
  ScanSearch,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Globe,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { Greenhouse3D } from "./components/Greenhouse3D";
import { ForecastChart } from "./components/ForecastChart";
import { DiseaseScanner } from "./components/DiseaseScanner";
import { TelegramPanel } from "./components/TelegramPanel";
import { AppSnapshot, Lang, SampleMeta, ScenarioMeta } from "./types";

type TabId = "climate" | "cv" | "telegram";

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [samples, setSamples] = useState<SampleMeta[]>([]);
  const [lang, setLang] = useState<Lang>("ru");
  const [activeTab, setActiveTab] = useState<TabId>("climate");
  const [simOpen, setSimOpen] = useState(false);
  const [connError, setConnError] = useState(false);

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => {});

    fetch("/api/samples")
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => {});

    fetch("/api/state")
      .then((r) => r.json())
      .then((data) => {
        setSnapshot(data);
        setConnError(false);
      })
      .catch(() => setConnError(true));

    const es = new EventSource("/api/stream");
    es.onmessage = (ev) => {
      try {
        const parsed: AppSnapshot = JSON.parse(ev.data);
        setSnapshot(parsed);
        setConnError(false);
      } catch {
        // ignore keepalive parse
      }
    };
    es.onerror = () => {
      setConnError(true);
    };

    return () => es.close();
  }, []);

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data && data.sensors) {
      setSnapshot(data);
    }
    return data;
  };

  const handleScenario = (scenarioId: string, fastForward = false) => {
    postJson("/api/scenario", { scenario_id: scenarioId, fast_forward: fastForward });
  };

  const handleTimeMachineToggle = () => {
    if (!snapshot) return;
    const nextScale = snapshot.time_scale > 0 ? 0 : 1.0;
    postJson("/api/sensors", { time_scale: nextScale });
  };

  const handlePitchDemoRun = () => {
    postJson("/api/scenario", { scenario_id: "chuy_april_frost", fast_forward: true });
  };

  const handleSliderChange = (key: string, value: number) => {
    postJson("/api/sensors", { [key]: value });
  };

  const handleOfflineToggle = () => {
    if (!snapshot) return;
    postJson("/api/sensors", { offline_edge_mode: !snapshot.offline_edge_mode });
  };

  const handleActuatorToggle = (key: "sprinkler_on" | "heater_on" | "vent_open") => {
    if (!snapshot) return;
    postJson("/api/actuators", { [key]: !snapshot.actuators[key] });
  };

  const handleAutoModeToggle = () => {
    if (!snapshot) return;
    postJson("/api/actuators", { auto_mode: !snapshot.actuators.auto_mode });
  };

  const handleScanSample = async (sampleId: string) => {
    await postJson("/api/cv/analyze", { sample_id: sampleId });
  };

  const handleScanImage = async (base64: string, source: string) => {
    await postJson("/api/cv/analyze", { image_base64: base64, source });
  };

  const handleTelegramAction = (command: string) => {
    postJson("/api/telegram/action", { command });
  };

  if (!snapshot) {
    return (
      <div className="agro-backdrop flex min-h-screen flex-col items-center justify-center px-4 text-white">
        <div className="liquid-glass flex flex-col items-center rounded-[22px] px-8 py-7">
          <Sprout className="mb-3 h-8 w-8 text-[#B5F043]" />
          <p className="text-sm font-medium">
            {connError
              ? "Нет связи с сервером AgroGuard Edge (python3 backend/server.py)"
              : "Подключение к умной теплице AgroGuard Edge..."}
          </p>
        </div>
      </div>
    );
  }

  const { sensors, prediction, actuators, time_scale, offline_edge_mode, latest_cv } = snapshot;
  const leafCritical = sensors.leaf_temp_c <= 1.5;
  const latestTgCritical =
    snapshot.telegram_messages.length > 0 &&
    snapshot.telegram_messages[snapshot.telegram_messages.length - 1].severity === "critical";

  const tomatoInfected =
    latest_cv &&
    (latest_cv.disease_id === "powdery_mildew" || latest_cv.disease_id === "late_blight");
  const strawberryInfected =
    latest_cv &&
    (latest_cv.disease_id === "scab_rust" || latest_cv.disease_id === "sticky_trap_pests");

  return (
    <div className="agro-backdrop flex min-h-screen flex-col text-white">
      {/* Floating Editorial Liquid Glass Top Bar */}
      <header className="mx-auto flex w-full max-w-[1540px] flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2 lg:px-6">
        {/* Left Crisp White Brand Pill (matching reference) */}
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-[#142014] shadow-lg">
          <Sprout className="h-4 w-4 text-[#2E6F2B]" />
          <span className="text-xs font-bold tracking-wide uppercase">AgroGuard Edge</span>
        </div>

        {/* Center Clean White Headline */}
        <h1 className="hidden text-center text-lg font-medium tracking-tight text-white drop-shadow-sm xl:block">
          {lang === "ru"
            ? "Защита теплицы от заморозков и болезней"
            : "Күнөскананы үшүктөн жана оорулардан коргоо"}
        </h1>

        {/* Right Controls: Scenario Select + Primary Demo Pill + Language */}
        <div className="flex flex-wrap items-center gap-2">
          {scenarios.length > 0 && (
            <label className="flex items-center">
              <span className="sr-only">
                {lang === "ru" ? "Погодный сценарий" : "Аба ырайы сценарийи"}
              </span>
              <select
                value={sensors.scenario}
                onChange={(e) => handleScenario(e.target.value, false)}
                className="liquid-pill cursor-pointer rounded-2xl px-3.5 py-2 text-xs font-medium text-white [&>option]:bg-[#182619] [&>option]:text-white"
              >
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {lang === "ru" ? sc.name_ru : sc.name_kg}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={handlePitchDemoRun}
            className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-[#142014] shadow-lg transition-all hover:bg-[#B5F043]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {lang === "ru" ? "Симуляция заморозка" : "Үшүк симуляциясы"}
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === "ru" ? "kg" : "ru")}
            className="liquid-pill flex items-center gap-1.5 rounded-2xl px-3 py-2 font-mono-num text-xs font-medium text-white"
          >
            <Globe className="h-3.5 w-3.5 text-white/75" />
            {lang === "ru" ? "RU" : "KG"}
          </button>
        </div>
      </header>

      {/* 3-Column Bento Liquid Glass Workspace (Left Telemetry | Center 3D + Chart | Right Controls) */}
      <main className="mx-auto grid w-full max-w-[1540px] flex-1 grid-cols-1 gap-4 px-4 pt-2 pb-5 lg:grid-cols-12 lg:px-6">
        {/* LEFT COLUMN (3 cols): Reference-style Large Light-Weight Metrics Glass Panel */}
        <section className="flex flex-col gap-4 lg:col-span-3">
          <div className="liquid-glass flex flex-1 flex-col rounded-[22px] p-5">
            <div className="border-b border-white/15 pb-3 text-sm font-medium text-white/90">
              {lang === "ru" ? "Показатели теплицы" : "Күнөскана көрсөткүчтөрү"}
            </div>

            <div className="flex flex-1 flex-col justify-between divide-y divide-white/12">
              {/* Air Temp */}
              <div className="py-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-num text-4xl font-light tracking-tight text-white">
                    {sensors.air_temp_c > 0 ? "+" : ""}
                    {sensors.air_temp_c.toFixed(1)}°
                  </span>
                  <span className="text-xs text-white/60">
                    {lang === "ru" ? "влажн." : "нымд."} {sensors.humidity_pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/70">
                  {lang === "ru" ? "Воздух в теплице" : "Күнөскана абасы"}
                </div>
              </div>

              {/* Leaf Temp */}
              <div className="py-4">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-num text-4xl font-light tracking-tight ${
                      leafCritical ? "text-[#FF6B6B]" : "text-[#B5F043]"
                    }`}
                  >
                    {sensors.leaf_temp_c > 0 ? "+" : ""}
                    {sensors.leaf_temp_c.toFixed(1)}°
                  </span>
                  <span className="text-xs text-white/60">
                    {prediction.leaf_air_delta_c >= 0 ? "+" : ""}
                    {prediction.leaf_air_delta_c.toFixed(1)}°
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/70">
                  {lang === "ru" ? "Температура листа" : "Жалбырак температурасы"}
                </div>
              </div>

              {/* Dew Point */}
              <div className="py-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-num text-4xl font-light tracking-tight text-white">
                    {prediction.dew_point_c > 0 ? "+" : ""}
                    {prediction.dew_point_c.toFixed(1)}°
                  </span>
                  <span className="text-xs text-white/60">
                    {sensors.cooling_rate_c_h >= 0 ? "+" : ""}
                    {sensors.cooling_rate_c_h.toFixed(1)}°/ч
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/70">
                  {lang === "ru" ? "Точка росы" : "Шүүдүрүм чекити"}
                </div>
              </div>

              {/* Frost Risk 6h */}
              <div className="pt-4">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-num text-4xl font-light tracking-tight ${
                      prediction.frost_level === "critical"
                        ? "text-[#FF6B6B]"
                        : prediction.frost_level === "warning"
                        ? "text-[#FBBF24]"
                        : "text-[#B5F043]"
                    }`}
                  >
                    {prediction.frost_risk_pct}%
                  </span>
                  <span className="text-xs text-white/60">
                    {lang === "ru" ? "мин." : "мин."}{" "}
                    {prediction.min_predicted_leaf_c > 0 ? "+" : ""}
                    {prediction.min_predicted_leaf_c.toFixed(1)}°C
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/70">
                  {lang === "ru" ? "Риск заморозка за 6ч" : "6 саатта үшүк коркунучу"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CENTER COLUMN (6 cols): Hero 3D Greenhouse + 6h Forecast Glass Chart */}
        <section className="flex flex-col gap-4 lg:col-span-6">
          <Greenhouse3D
            sensors={sensors}
            prediction={prediction}
            actuators={actuators}
            latestCv={latest_cv}
            lastCvScanTs={snapshot.last_cv_scan_ts}
            lang={lang}
          />
          <ForecastChart history={snapshot.history} prediction={prediction} lang={lang} />
        </section>

        {/* RIGHT COLUMN (3 cols): Liquid Glass Control & Diagnostics Panel */}
        <aside className="liquid-glass flex flex-col rounded-[22px] p-4 lg:col-span-3">
          {/* Glass Segmented Tabs */}
          <nav
            aria-label={lang === "ru" ? "Разделы управления" : "Башкаруу бөлүмдөрү"}
            className="grid grid-cols-3 gap-1 rounded-2xl border border-white/15 bg-black/20 p-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab("climate")}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition-all ${
                activeTab === "climate"
                  ? "bg-white text-[#142014] shadow-sm"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              {lang === "ru" ? "Климат" : "Климат"}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cv")}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition-all ${
                activeTab === "cv"
                  ? "bg-white text-[#142014] shadow-sm"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              {lang === "ru" ? "Болезни" : "Оорулар"}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("telegram")}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition-all ${
                activeTab === "telegram"
                  ? "bg-white text-[#142014] shadow-sm"
                  : "text-white/75 hover:text-white"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Bot
              {snapshot.telegram_messages.length > 0 && (
                <span
                  className={`font-mono-num rounded-full px-1.5 text-[10px] font-semibold ${
                    latestTgCritical
                      ? "bg-[#FF6B6B] text-[#142014]"
                      : activeTab === "telegram"
                      ? "bg-[#142014]/15 text-[#142014]"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {snapshot.telegram_messages.length}
                </span>
              )}
            </button>
          </nav>

          {/* Tab Body */}
          <div className="mt-4 flex-1">
            {activeTab === "climate" && (
              <div className="flex flex-col gap-4">
                {/* Auto Protection Status */}
                <div
                  className={`rounded-2xl border p-3.5 ${
                    prediction.frost_level === "critical"
                      ? "border-[#FF6B6B]/50 bg-[#FF6B6B]/18"
                      : prediction.frost_level === "warning"
                      ? "border-[#FBBF24]/45 bg-[#FBBF24]/15"
                      : "border-white/20 bg-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                      {prediction.frost_level === "critical" ? (
                        <ShieldAlert className="h-4 w-4 text-[#FF6B6B]" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-[#B5F043]" />
                      )}
                      <span>{lang === "ru" ? "Автозащита" : "Автокоргоо"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoModeToggle}
                      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-all ${
                        actuators.auto_mode
                          ? "bg-[#B5F043] text-[#142014]"
                          : "border border-white/25 bg-white/10 text-white"
                      }`}
                    >
                      {actuators.auto_mode
                        ? lang === "ru"
                          ? "АВТО"
                          : "АВТО"
                        : lang === "ru"
                        ? "РУЧНОЙ"
                        : "КОЛ"}
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-white/90">
                    {lang === "ru"
                      ? actuators.last_trigger_reason
                      : actuators.last_trigger_reason_kg}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between border-t border-white/12 pt-2 text-[11px] text-white/65">
                    <span>
                      {lang === "ru" ? "Риск грибка:" : "Козу карын:"}{" "}
                      <strong className="text-white">{prediction.fungal_risk_pct}%</strong>
                    </span>
                    <span>
                      {offline_edge_mode
                        ? lang === "ru"
                          ? "Офлайн"
                          : "Офлайн"
                        : lang === "ru"
                        ? "Онлайн"
                        : "Онлайн"}
                    </span>
                  </div>
                </div>

                {/* Greenhouse Relay Switches */}
                <div>
                  <h2 className="mb-2 text-xs font-medium text-white/75">
                    {lang === "ru" ? "Управление теплицей" : "Күнөскананы башкаруу"}
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleActuatorToggle("sprinkler_on")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                        actuators.sprinkler_on
                          ? "border-[#7DD3FC]/70 bg-[#7DD3FC]/25 text-white"
                          : "border-white/15 bg-white/6 text-white/75 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      <Droplets className="h-4 w-4" />
                      <span>{lang === "ru" ? "Полив" : "Сугаруу"}</span>
                      <span className="font-mono-num text-[10px] opacity-80">
                        {actuators.sprinkler_on ? "ВКЛ" : "ВЫКЛ"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleActuatorToggle("heater_on")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                        actuators.heater_on
                          ? "border-[#FBBF24]/70 bg-[#FBBF24]/25 text-white"
                          : "border-white/15 bg-white/6 text-white/75 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      <Flame className="h-4 w-4" />
                      <span>{lang === "ru" ? "Обогрев" : "Жылытуу"}</span>
                      <span className="font-mono-num text-[10px] opacity-80">
                        {actuators.heater_on ? "ВКЛ" : "ВЫКЛ"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleActuatorToggle("vent_open")}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                        actuators.vent_open
                          ? "border-[#B5F043]/70 bg-[#B5F043]/22 text-white"
                          : "border-white/15 bg-white/6 text-white/75 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      <Wind className="h-4 w-4" />
                      <span>{lang === "ru" ? "Окна" : "Терезе"}</span>
                      <span className="font-mono-num text-[10px] opacity-80">
                        {actuators.vent_open ? "ОТКР" : "ЗАКР"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Crop Beds Health Strip */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xs font-medium text-white/75">
                      {lang === "ru" ? "Грядки в теплице" : "Күнөскана жөөктөрү"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cv")}
                      className="flex items-center gap-1 text-xs font-medium text-[#B5F043] hover:underline"
                    >
                      {lang === "ru" ? "Проверить" : "Текшерүү"}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`rounded-2xl border p-3 ${
                        tomatoInfected
                          ? "border-[#FF6B6B]/50 bg-[#FF6B6B]/18"
                          : "border-white/15 bg-white/6"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            tomatoInfected ? "bg-[#FF6B6B]" : "bg-[#B5F043]"
                          }`}
                        />
                        {lang === "ru" ? "Томаты" : "Помидор"}
                      </div>
                      <div
                        className={`mt-1 line-clamp-2 text-[11px] ${
                          tomatoInfected ? "text-[#FFD4D4]" : "text-white/70"
                        }`}
                      >
                        {tomatoInfected && latest_cv
                          ? lang === "ru"
                            ? latest_cv.name_ru
                            : latest_cv.name_kg
                          : lang === "ru"
                          ? "Здоровы"
                          : "Дени сак"}
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl border p-3 ${
                        strawberryInfected
                          ? "border-[#FF6B6B]/50 bg-[#FF6B6B]/18"
                          : "border-white/15 bg-white/6"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            strawberryInfected ? "bg-[#FF6B6B]" : "bg-[#B5F043]"
                          }`}
                        />
                        {lang === "ru" ? "Клубника" : "Кулпунай"}
                      </div>
                      <div
                        className={`mt-1 line-clamp-2 text-[11px] ${
                          strawberryInfected ? "text-[#FFD4D4]" : "text-white/70"
                        }`}
                      >
                        {strawberryInfected && latest_cv
                          ? lang === "ru"
                            ? latest_cv.name_ru
                            : latest_cv.name_kg
                          : lang === "ru"
                          ? "Здоровы"
                          : "Дени сак"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Manual Weather Controls */}
                <div className="border-t border-white/15 pt-3">
                  <button
                    type="button"
                    onClick={() => setSimOpen((v) => !v)}
                    aria-expanded={simOpen}
                    className="flex w-full items-center justify-between text-left text-xs font-medium text-white/75 transition-colors hover:text-white"
                  >
                    <span>
                      {lang === "ru"
                        ? "Ручная настройка погоды"
                        : "Аба ырайын кол менен жөндөө"}
                    </span>
                    {simOpen ? (
                      <ChevronUp className="h-4 w-4 text-white/60" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/60" />
                    )}
                  </button>

                  {simOpen && (
                    <div className="mt-3 space-y-3.5 rounded-2xl border border-white/15 bg-black/20 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleTimeMachineToggle}
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              time_scale > 0
                                ? "border-[#FBBF24]/60 bg-[#FBBF24]/20 text-[#FEF3C7]"
                                : "border-white/20 bg-white/10 text-white"
                            }`}
                          >
                            {time_scale > 0 ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {time_scale > 0
                              ? lang === "ru"
                                ? "Пауза"
                                : "Токтот"
                              : lang === "ru"
                              ? "Ускорить"
                              : "Тездет"}
                          </button>

                          <button
                            type="button"
                            onClick={handleOfflineToggle}
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              offline_edge_mode
                                ? "border-white bg-white text-[#142014]"
                                : "border-white/20 bg-white/10 text-white"
                            }`}
                          >
                            {offline_edge_mode ? (
                              <WifiOff className="h-3 w-3" />
                            ) : (
                              <Wifi className="h-3 w-3 text-[#B5F043]" />
                            )}
                            {offline_edge_mode ? "Офлайн" : "Онлайн"}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleScenario(sensors.scenario, false)}
                          className="flex items-center gap-1 text-xs font-medium text-[#B5F043] hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {lang === "ru" ? "Сброс" : "Баштапкы"}
                        </button>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-white/80">
                            {lang === "ru" ? "Температура воздуха" : "Абанын темп."}
                          </span>
                          <span className="font-mono-num text-[#7DD3FC]">
                            {sensors.air_temp_c.toFixed(1)}°C
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-6}
                          max={30}
                          step={0.5}
                          value={sensors.air_temp_c}
                          onChange={(e) => handleSliderChange("air_temp_c", parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-white/80">
                            {lang === "ru" ? "Влажность" : "Нымдуулук"}
                          </span>
                          <span className="font-mono-num text-[#B5F043]">
                            {sensors.humidity_pct.toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={25}
                          max={98}
                          step={1}
                          value={sensors.humidity_pct}
                          onChange={(e) => handleSliderChange("humidity_pct", parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-white/80">
                            {lang === "ru" ? "Время суток" : "Убакыт"}
                          </span>
                          <span className="font-mono-num text-[#FBBF24]">
                            {String(Math.floor(sensors.sim_hour)).padStart(2, "0")}:00
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={23.5}
                          step={0.5}
                          value={sensors.sim_hour}
                          onChange={(e) => handleSliderChange("sim_hour", parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "cv" && (
              <DiseaseScanner
                samples={samples}
                latestCv={latest_cv}
                lang={lang}
                onScanSample={handleScanSample}
                onScanImage={handleScanImage}
              />
            )}

            {activeTab === "telegram" && (
              <TelegramPanel
                messages={snapshot.telegram_messages}
                realConnected={snapshot.real_telegram_connected}
                lang={lang}
                onAction={handleTelegramAction}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
