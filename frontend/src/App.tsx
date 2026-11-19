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
  Cpu,
  Sliders,
  ScanSearch,
  MessageCircle,
  ShieldCheck,
  Clock,
  Globe,
  RotateCcw,
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
  const [connError, setConnError] = useState(false);

  // Load initial catalog & subscribe to real-time SSE stream
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070B14] text-slate-200">
        <Sprout className="mb-3 h-10 w-10 animate-pulse text-emerald-400" />
        <p className="text-sm font-semibold">
          {connError
            ? "Не удалось подключиться к backend (python3 backend/server.py)"
            : "Загрузка 3D Digital Twin теплицы AgroGuard Edge..."}
        </p>
      </div>
    );
  }

  const { sensors, prediction, actuators, time_scale, offline_edge_mode } = snapshot;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100">
      {/* Top Navigation & Pitch Control Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0A101F]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold tracking-tight text-white">
                  AgroGuard Edge <span className="text-emerald-400">3D Twin</span>
                </h1>
                <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 sm:inline">
                  Physical AI Hackathon • $0 MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {lang === "ru"
                  ? "3D Цифровой двойник теплицы • Edge-CV болезней + Прогноз заморозков 6ч"
                  : "Күнөскананын 3D Санарип Эгизи • Ооруларды Edge-CV + 6с Үшүк Болжолу"}
              </p>
            </div>
          </div>

          {/* Right Controls: 1-Click Pitch Demo, Time Machine, Offline Toggle, RU/KG */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePitchDemoRun}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {lang === "ru" ? "Демо заморозка (6ч за 15с)" : "Үшүк демосу (6с → 15сек)"}
            </button>

            <button
              onClick={handleTimeMachineToggle}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                time_scale > 0
                  ? "border-amber-400/70 bg-amber-500/15 text-amber-200"
                  : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500"
              }`}
            >
              {time_scale > 0 ? <Pause className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {time_scale > 0
                ? lang === "ru" ? "Пауза времени" : "Убакытты токтот"
                : lang === "ru" ? "Ускорить время" : "Убакытты тездет"}
            </button>

            <button
              onClick={handleOfflineToggle}
              title={
                lang === "ru"
                  ? "Показывает, что Edge AI и реле работают без интернета"
                  : "Edge AI жана реле интернетсиз иштээрин көрсөтөт"
              }
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                offline_edge_mode
                  ? "border-violet-400/70 bg-violet-500/20 text-violet-200"
                  : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500"
              }`}
            >
              {offline_edge_mode ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5 text-emerald-400" />}
              {offline_edge_mode ? "Offline Edge" : "Online"}
            </button>

            <button
              onClick={() => setLang(lang === "ru" ? "kg" : "ru")}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-emerald-500/50"
            >
              <Globe className="h-3.5 w-3.5 text-sky-400" />
              {lang === "ru" ? "RU" : "KG"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        {/* LEFT STAGE (8 cols): 3D Greenhouse + 6h Forecast Chart + Scenario Strip */}
        <section className="flex flex-col gap-3.5 lg:col-span-8">
          {/* Interactive 3D Greenhouse Model */}
          <Greenhouse3D
            sensors={sensors}
            prediction={prediction}
            actuators={actuators}
            latestCv={snapshot.latest_cv}
            lastCvScanTs={snapshot.last_cv_scan_ts}
            lang={lang}
          />

          {/* Kyrgyzstan Scenario Preset Strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scenarios.map((sc) => {
              const active = sensors.scenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleScenario(sc.id, false)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    active
                      ? "border-emerald-400/70 bg-emerald-500/12 shadow-md shadow-emerald-500/10"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                  }`}
                >
                  <div className="line-clamp-1 text-[11.5px] font-bold text-slate-100">
                    {lang === "ru" ? sc.name_ru : sc.name_kg}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                    {lang === "ru" ? sc.desc_ru : sc.desc_kg}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 6-Hour Forecast & Dew Point Chart */}
          <ForecastChart history={snapshot.history} prediction={prediction} lang={lang} />
        </section>

        {/* RIGHT MISSION-CONTROL PANEL (4 cols): 3 Tabs (Climate/Relays, Edge-CV, Telegram) */}
        <aside className="flex flex-col gap-3 lg:col-span-4">
          {/* Tab Switcher */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5">
            <button
              onClick={() => setActiveTab("climate")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                activeTab === "climate"
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              {lang === "ru" ? "Климат & Реле" : "Климат & Реле"}
            </button>
            <button
              onClick={() => setActiveTab("cv")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                activeTab === "cv"
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              {lang === "ru" ? "Edge-CV" : "Edge-CV"}
            </button>
            <button
              onClick={() => setActiveTab("telegram")}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                activeTab === "telegram"
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Telegram
              {snapshot.telegram_messages.length > 1 && (
                <span className="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[9.5px] font-extrabold text-white">
                  {snapshot.telegram_messages.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-4 backdrop-blur">
            {activeTab === "climate" && (
              <div className="flex flex-col gap-4">
                {/* Decision Engine Status Card */}
                <div
                  className={`rounded-xl border p-3 ${
                    prediction.frost_level === "critical"
                      ? "border-rose-500/60 bg-rose-500/10"
                      : prediction.frost_level === "warning"
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-emerald-500/40 bg-emerald-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      {lang === "ru" ? "Статус Edge-AI защиты" : "Edge-AI коргоо абалы"}
                    </span>
                    <button
                      onClick={handleAutoModeToggle}
                      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition ${
                        actuators.auto_mode
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-700 text-slate-200"
                      }`}
                    >
                      {actuators.auto_mode
                        ? lang === "ru" ? "АВТО: ВКЛ" : "АВТО: КҮЙҮК"
                        : lang === "ru" ? "РУЧНОЙ" : "КОЛ МЕНЕН"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-white">
                    {lang === "ru" ? actuators.last_trigger_reason : actuators.last_trigger_reason_kg}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10.5px] text-slate-300">
                    <span>
                      {lang === "ru" ? "Точка росы:" : "Шүүдүрүм:"} <b>{prediction.dew_point_c.toFixed(1)}°C</b>
                    </span>
                    <span>•</span>
                    <span>
                      {lang === "ru" ? "Риск грибка:" : "Козу карын:"} <b>{prediction.fungal_risk_pct}%</b>
                    </span>
                    <span>•</span>
                    <span>
                      dT/dt: <b>{sensors.cooling_rate_c_h.toFixed(2)}°/ч</b>
                    </span>
                  </div>
                </div>

                {/* Manual Relay Switches */}
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === "ru" ? "Физические реле (3D актуаторы)" : "Физикалык релелер (3D)"}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleActuatorToggle("sprinkler_on")}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                        actuators.sprinkler_on
                          ? "border-sky-400 bg-sky-500/20 text-sky-100 shadow-lg shadow-sky-500/15"
                          : "border-slate-700/80 bg-slate-800/50 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <Droplets className="h-5 w-5" />
                      <span>{lang === "ru" ? "Полив" : "Сугаруу"}</span>
                      <span className="text-[10px] opacity-80">
                        {actuators.sprinkler_on ? "ON" : "OFF"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleActuatorToggle("heater_on")}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                        actuators.heater_on
                          ? "border-orange-400 bg-orange-500/20 text-orange-100 shadow-lg shadow-orange-500/15"
                          : "border-slate-700/80 bg-slate-800/50 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <Flame className="h-5 w-5" />
                      <span>{lang === "ru" ? "Обогрев" : "Жылытуу"}</span>
                      <span className="text-[10px] opacity-80">
                        {actuators.heater_on ? "ON" : "OFF"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleActuatorToggle("vent_open")}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                        actuators.vent_open
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                          : "border-slate-700/80 bg-slate-800/50 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <Wind className="h-5 w-5" />
                      <span>{lang === "ru" ? "Форточки" : "Желдетүү"}</span>
                      <span className="text-[10px] opacity-80">
                        {actuators.vent_open ? "OPEN" : "CLOSED"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Interactive Climate Sliders (for Jury experimentation!) */}
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "ru" ? "Ручная симуляция среды" : "Чөйрөнү кол менен сыноо"}
                    </span>
                    <button
                      onClick={() => handleScenario(sensors.scenario, false)}
                      className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 hover:text-emerald-400"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {lang === "ru" ? "Сброс" : "Баштапкы"}
                    </button>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">
                        {lang === "ru" ? "Температура воздуха (SHT41)" : "Абанын температурасы"}
                      </span>
                      <span className="font-bold text-sky-300">{sensors.air_temp_c.toFixed(1)}°C</span>
                    </div>
                    <input
                      type="range"
                      min={-6}
                      max={30}
                      step={0.5}
                      value={sensors.air_temp_c}
                      onChange={(e) => handleSliderChange("air_temp_c", parseFloat(e.target.value))}
                      className="w-full cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">
                        {lang === "ru" ? "Влажность воздуха (RH)" : "Абанын нымдуулугу (RH)"}
                      </span>
                      <span className="font-bold text-emerald-300">{sensors.humidity_pct.toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={25}
                      max={98}
                      step={1}
                      value={sensors.humidity_pct}
                      onChange={(e) => handleSliderChange("humidity_pct", parseFloat(e.target.value))}
                      className="w-full cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">
                        {lang === "ru" ? "Время суток (3D небо и солнце)" : "Сутканын убактысы (3D)"}
                      </span>
                      <span className="font-bold text-amber-300">
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
                      className="w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Hardware Abstraction Layer (HAL) Readiness Badge */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-sky-300">
                    <Cpu className="h-4 w-4" />
                    HAL • Hardware-Ready Architecture
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {lang === "ru" ? (
                      <>
                        Активный драйвер: <span className="font-semibold text-slate-200">{sensors.driver_name}</span>.
                        Перенос на <b>RPi Zero 2W / ESP32-S3 + SHT41 + MLX90614</b> (BOM ~$35) без изменения AI-ядра.
                      </>
                    ) : (
                      <>
                        Активдүү драйвер: <span className="font-semibold text-slate-200">{sensors.driver_name}</span>.
                        <b>RPi Zero 2W / ESP32-S3 + SHT41 + MLX90614</b> (BOM ~$35) платасына AI өзгөртүүсүз көчүрүлөт.
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "cv" && (
              <DiseaseScanner
                samples={samples}
                latestCv={snapshot.latest_cv}
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
