import React, { useRef, useState } from "react";
import {
  Camera,
  Upload,
  ScanSearch,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  VideoOff,
  Leaf,
} from "lucide-react";
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
          ? "Веб-камера недоступна. Загрузите снимок или выберите образец ниже."
          : "Веб-камера жеткиликтүү эмес. Сүрөт жүктөңүз же үлгүнү тандаңыз."
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
    <div className="flex flex-col gap-3.5">
      {/* Capture Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={toggleWebcam}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            webcamOn
              ? "border border-[#FF6B6B]/50 bg-[#FF6B6B]/20 text-[#FFD4D4]"
              : "bg-white text-[#142014] hover:bg-white/90"
          }`}
        >
          {webcamOn ? <VideoOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
          {webcamOn
            ? lang === "ru"
              ? "Выкл. камеру"
              : "Камераны өчүр"
            : lang === "ru"
            ? "Веб-камера"
            : "Веб-камера"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="liquid-pill flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white transition-all disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
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
        <p className="rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/15 px-3 py-2 text-xs text-[#FEF3C7]">
          {camError}
        </p>
      )}

      {webcamOn && (
        <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-black">
          <video ref={videoRef} muted playsInline className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={captureWebcamFrame}
            disabled={scanning}
            className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#B5F043] px-3.5 py-1.5 text-xs font-semibold text-[#142014]"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            {lang === "ru" ? "Сканировать лист" : "Жалбыракты сканерлөө"}
          </button>
        </div>
      )}

      {/* Sample Leaf Strip */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-medium text-white/80">
            {lang === "ru" ? "Выберите фото листа" : "Жалбырак сүрөтүн тандаңыз"}
          </h3>
          <span className="text-[11px] text-white/50">
            {lang === "ru" ? "Без интернета" : "Интернетсиз"}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {samples.map((s) => {
            const selected = latestCv?.source === `sample:${s.id}`;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSampleClick(s.id)}
                disabled={scanning}
                title={lang === "ru" ? s.name_ru : s.name_kg}
                className={`flex flex-col items-center overflow-hidden rounded-xl border p-1 transition-all ${
                  selected
                    ? "border-[#B5F043] bg-[#B5F043]/20"
                    : "border-white/15 bg-white/5 hover:border-white/35 hover:bg-white/10"
                }`}
              >
                {s.thumbnail ? (
                  <img
                    src={s.thumbnail}
                    alt={lang === "ru" ? s.name_ru : s.name_kg}
                    className="h-10 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-full rounded-lg bg-white/10" />
                )}
                <span className="mt-1 line-clamp-1 w-full text-center text-[9.5px] text-white/85">
                  {(lang === "ru" ? s.name_ru : s.name_kg).split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Card */}
      {latestCv ? (
        <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/25">
          <div className="relative border-b border-white/15 bg-black/40">
            <img
              src={latestCv.annotated_image}
              alt={lang === "ru" ? latestCv.name_ru : latestCv.name_kg}
              className="h-36 w-full object-contain"
            />
            <span className="font-mono-num absolute top-2 left-2 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] text-white backdrop-blur-md">
              {latestCv.inference_ms} мс
            </span>
            <span
              className="font-mono-num absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#142014]"
              style={{
                backgroundColor:
                  latestCv.severity === "safe"
                    ? "#B5F043"
                    : latestCv.severity === "warning"
                    ? "#FBBF24"
                    : "#FF6B6B",
              }}
            >
              {latestCv.confidence_pct}%
            </span>
          </div>

          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {latestCv.severity === "safe" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#B5F043]" />
                ) : latestCv.severity === "warning" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#FBBF24]" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 text-[#FF6B6B]" />
                )}
                <h4 className="text-sm font-medium text-white">
                  {lang === "ru" ? latestCv.name_ru : latestCv.name_kg}
                </h4>
              </div>
              {latestCv.affected_sector && (
                <span className="shrink-0 rounded-full border border-[#FF6B6B]/40 bg-[#FF6B6B]/20 px-2 py-0.5 text-[10px] font-medium text-[#FFD4D4]">
                  {latestCv.affected_sector}
                </span>
              )}
            </div>

            <div className="mt-2.5 grid grid-cols-3 divide-x divide-white/15 rounded-xl border border-white/15 bg-white/5 text-center">
              <div className="py-1.5">
                <div className="text-[10px] text-white/55">
                  {lang === "ru" ? "Поражение" : "Жабыркоо"}
                </div>
                <div className="font-num text-xs font-medium text-white">
                  {latestCv.affected_area_pct}%
                </div>
              </div>
              <div className="py-1.5">
                <div className="text-[10px] text-white/55">
                  {lang === "ru" ? "Очаги" : "Очоктор"}
                </div>
                <div className="font-num text-xs font-medium text-white">
                  {latestCv.lesion_count}
                </div>
              </div>
              <div className="py-1.5">
                <div className="text-[10px] text-white/55">
                  {lang === "ru" ? "Скорость" : "Ылдамдык"}
                </div>
                <div className="font-num text-xs font-medium text-[#B5F043]">
                  {latestCv.inference_ms} мс
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-white/80">
              <span className="font-medium text-[#B5F043]">
                {lang === "ru" ? "Рекомендация: " : "Сунуш: "}
              </span>
              {lang === "ru" ? latestCv.advice_ru : latestCv.advice_kg}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/25 bg-white/5 px-4 py-8 text-center">
          <Leaf className="mb-2 h-6 w-6 text-[#B5F043]" />
          <p className="text-xs font-medium text-white">
            {lang === "ru"
              ? "Выберите фото листа выше или включите камеру"
              : "Жогорудагы сүрөттү тандаңыз же камераны күйгүзүңүз"}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {lang === "ru"
              ? "ИИ найдёт признаки болезни и подсветит грядку в 3D."
              : "ИИ оорунун белгилерин таап, 3D грядканы белгилейт."}
          </p>
        </div>
      )}
    </div>
  );
};
