import React, { useRef, useState } from "react";
import { Camera, Upload, ScanSearch, CheckCircle2, AlertTriangle, ShieldAlert, VideoOff, Sparkles } from "lucide-react";
import { CVResult, Lang, SampleMeta } from "../types";

interface Props {
  samples: SampleMeta[];
  latestCv: CVResult | null;
  lang: Lang;
  onScanSample: (sampleId: string) => Promise<void>;
  onScanImage: (base64: string, source: string) => Promise<void>;
}

export const DiseaseScanner: React.FC<Props> = ({
  samples,
  latestCv,
  lang,
  onScanSample,
  onScanImage,
}) => {
  const [scanning, setScanning] = useState(false);
  const [webcamOn, setWebcamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSampleClick = async (sampleId: string) => {
    setScanning(true);
    try {
      await onScanSample(sampleId);
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        setScanning(true);
        try {
          await onScanImage(reader.result, `upload:${file.name}`);
        } finally {
          setScanning(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleWebcam = async () => {
    setCamError(null);
    if (webcamOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setWebcamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 480, height: 360 },
      });
      streamRef.current = stream;
      setWebcamOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCamError(
        lang === "ru"
          ? "Веб-камера недоступна. Используйте загрузку фото или готовые образцы ниже."
          : "Веб-камера жеткиликтүү эмес. Төмөндөгү сүрөт жүктөөнү же үлгүлөрдү колдонуңуз."
      );
    }
  };

  const captureWebcamFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setScanning(true);
    try {
      await onScanImage(dataUrl, "webcam");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Action buttons: Webcam + Upload */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleWebcam}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            webcamOn
              ? "border-rose-500/60 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          }`}
        >
          {webcamOn ? <VideoOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {webcamOn
            ? lang === "ru" ? "Выкл. камеру" : "Камераны өчүр"
            : lang === "ru" ? "Веб-камера" : "Веб-камера"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {lang === "ru" ? "Загрузить фото" : "Сүрөт жүктөө"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {camError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
          {camError}
        </p>
      )}

      {/* Live Webcam Preview */}
      {webcamOn && (
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-black">
          <video ref={videoRef} muted playsInline className="h-40 w-full object-cover" />
          <button
            onClick={captureWebcamFrame}
            disabled={scanning}
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            {lang === "ru" ? "Сканировать лист" : "Жалбыракты сканерлөө"}
          </button>
        </div>
      )}

      {/* 1-Click Sample Leaves / Sticky Trap */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "ru" ? "Тестовые образцы (1 клик)" : "Сыноо үлгүлөрү (1 басуу)"}
          </span>
          <span className="text-[10px] text-emerald-400">Local Edge CV • $0 API</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {samples.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSampleClick(s.id)}
              disabled={scanning}
              title={lang === "ru" ? s.name_ru : s.name_kg}
              className={`group flex flex-col items-center overflow-hidden rounded-lg border p-1 transition ${
                latestCv?.source === `sample:${s.id}`
                  ? "border-emerald-400 bg-emerald-500/15"
                  : "border-slate-700/80 bg-slate-800/60 hover:border-slate-500"
              }`}
            >
              {s.thumbnail ? (
                <img
                  src={s.thumbnail}
                  alt={s.name_ru}
                  className="h-11 w-full rounded object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="h-11 w-full rounded bg-slate-700" />
              )}
              <span className="mt-1 line-clamp-1 w-full text-center text-[9.5px] font-medium text-slate-300">
                {(lang === "ru" ? s.name_ru : s.name_kg).split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Annotated Edge-CV Result */}
      {latestCv ? (
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-2.5">
          <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
            <img
              src={latestCv.annotated_image}
              alt={latestCv.name_ru}
              className="h-44 w-full object-contain"
            />
            <span className="absolute top-2 left-2 rounded-md bg-slate-950/85 px-2 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur">
              Edge: {latestCv.inference_ms} ms
            </span>
            <span
              className="absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: latestCv.color }}
            >
              {latestCv.confidence_pct}% conf
            </span>
          </div>

          <div className="mt-2.5 flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                {latestCv.severity === "safe" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : latestCv.severity === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                )}
                <h4 className="text-sm font-bold text-slate-100">
                  {lang === "ru" ? latestCv.name_ru : latestCv.name_kg}
                </h4>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {lang === "ru" ? latestCv.crop_hint_ru : latestCv.crop_hint_kg}
              </p>
            </div>
            {latestCv.affected_sector && (
              <span className="shrink-0 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                3D: {latestCv.affected_sector}
              </span>
            )}
          </div>

          {/* Metrics strip */}
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-slate-900 px-2 py-1.5">
              <div className="text-[10px] text-slate-400">
                {lang === "ru" ? "Поражение" : "Жабыркоо"}
              </div>
              <div className="text-xs font-bold text-slate-100">{latestCv.affected_area_pct}%</div>
            </div>
            <div className="rounded-lg bg-slate-900 px-2 py-1.5">
              <div className="text-[10px] text-slate-400">
                {lang === "ru" ? "Очаги (ROI)" : "Очоктор"}
              </div>
              <div className="text-xs font-bold text-slate-100">{latestCv.lesion_count}</div>
            </div>
            <div className="rounded-lg bg-slate-900 px-2 py-1.5">
              <div className="text-[10px] text-slate-400">
                {lang === "ru" ? "Инференс" : "Ылдамдык"}
              </div>
              <div className="text-xs font-bold text-emerald-400">{latestCv.inference_ms} мс</div>
            </div>
          </div>

          {/* Agronomist recommendation */}
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-[11.5px] leading-relaxed text-slate-200">
            <span className="font-bold text-emerald-400">
              {lang === "ru" ? "Рекомендация AI: " : "AI сунушу: "}
            </span>
            {lang === "ru" ? latestCv.advice_ru : latestCv.advice_kg}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-4 py-8 text-center">
          <Sparkles className="mb-2 h-7 w-7 text-emerald-400/70" />
          <p className="text-xs font-semibold text-slate-300">
            {lang === "ru"
              ? "Нажмите на любой образец выше или включите камеру"
              : "Жогорудагы үлгүнү басыңыз же камераны күйгүзүңүз"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {lang === "ru"
              ? "Камера на 3D-маяке AgroGuard проведёт сканирование и подсветит очаг в теплице"
              : "3D-маяктагы камера сканерлеп, күнөсканадагы очокту көрсөтөт"}
          </p>
        </div>
      )}
    </div>
  );
};
