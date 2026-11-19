import React from "react";
import { FrostPrediction, HistoryPoint, Lang } from "../types";

interface Props {
  history: HistoryPoint[];
  prediction: FrostPrediction;
  lang: Lang;
}

export const ForecastChart: React.FC<Props> = ({ history, prediction, lang }) => {
  const recent = history.slice(-10);
  const forecast = prediction.forecast_6h;

  // Combined series: past readings + 6-hour ML forecast
  const combined = [
    ...recent.map((p) => ({
      label: p.label,
      air: p.air_temp_c,
      leaf: p.leaf_temp_c,
      dew: p.dew_point_c,
      isForecast: false,
    })),
    ...forecast.map((f) => ({
      label: `+${f.offset_h}ч`,
      air: f.pred_air_c,
      leaf: f.pred_leaf_c,
      dew: f.dew_point_c,
      isForecast: true,
    })),
  ];

  const W = 740;
  const H = 178;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allVals = combined.flatMap((c) => [c.air, c.leaf, c.dew, 0]);
  const rawMin = Math.min(...allVals, -3);
  const rawMax = Math.max(...allVals, 10);
  const yMin = Math.floor(rawMin - 1.5);
  const yMax = Math.ceil(rawMax + 1.5);
  const span = Math.max(1, yMax - yMin);

  const xOf = (idx: number) =>
    padL + (combined.length <= 1 ? 0 : (idx / (combined.length - 1)) * plotW);
  const yOf = (val: number) => padT + ((yMax - val) / span) * plotH;

  const buildPath = (
    points: { idx: number; val: number }[]
  ): string => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.idx).toFixed(1)} ${yOf(p.val).toFixed(1)}`)
      .join(" ");
  };

  const splitIdx = Math.max(0, recent.length - 1);
  const nowX = xOf(splitIdx);
  const zeroY = yOf(0);

  const pastAir = buildPath(combined.slice(0, splitIdx + 1).map((c, i) => ({ idx: i, val: c.air })));
  const pastLeaf = buildPath(combined.slice(0, splitIdx + 1).map((c, i) => ({ idx: i, val: c.leaf })));
  const pastDew = buildPath(combined.slice(0, splitIdx + 1).map((c, i) => ({ idx: i, val: c.dew })));

  const futAir = buildPath(combined.slice(splitIdx).map((c, i) => ({ idx: splitIdx + i, val: c.air })));
  const futLeaf = buildPath(combined.slice(splitIdx).map((c, i) => ({ idx: splitIdx + i, val: c.leaf })));

  // Y grid ticks (4-5 clean ticks)
  const step = span > 18 ? 6 : span > 10 ? 4 : 2;
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    ticks.push(v);
  }
  if (!ticks.includes(0) && 0 >= yMin && 0 <= yMax) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-3.5 backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {lang === "ru"
              ? "Телеметрия & Edge-ML прогноз заморозков на 6 часов"
              : "Телеметрия & 6 сааттык үшүк болжолу (Edge-ML)"}
          </h3>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {prediction.inference_ms.toFixed(2)} ms
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-sky-400" />
            {lang === "ru" ? "Воздух" : "Аба"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-emerald-400" />
            {lang === "ru" ? "Лист (ИК)" : "Жалбырак (ИК)"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-violet-400 opacity-80" />
            {lang === "ru" ? "Точка росы" : "Шүүдүрүм"}
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="h-0.5 w-3.5 border-t border-dashed border-rose-400" />
            0°C
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-[158px] w-full overflow-visible">
        <defs>
          <linearGradient id="frostZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="forecastBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Forecast background band */}
        <rect
          x={nowX}
          y={padT}
          width={Math.max(0, W - padR - nowX)}
          height={plotH}
          fill="url(#forecastBg)"
          rx={4}
        />

        {/* Sub-zero freeze danger zone */}
        {zeroY < padT + plotH && (
          <rect
            x={padL}
            y={Math.max(padT, zeroY)}
            width={plotW}
            height={Math.max(0, padT + plotH - Math.max(padT, zeroY))}
            fill="url(#frostZone)"
          />
        )}

        {/* Horizontal grid lines */}
        {ticks.map((v) => {
          const y = yOf(v);
          const isZero = v === 0;
          return (
            <g key={v}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={isZero ? "#FB7185" : "#1E293B"}
                strokeWidth={isZero ? 1.3 : 1}
                strokeDasharray={isZero ? "5 4" : undefined}
              />
              <text
                x={padL - 7}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill={isZero ? "#FB7185" : "#64748B"}
                fontWeight={isZero ? "700" : "500"}
              >
                {v}°
              </text>
            </g>
          );
        })}

        {/* Vertical NOW divider */}
        <line
          x1={nowX}
          y1={padT}
          x2={nowX}
          y2={padT + plotH}
          stroke="#475569"
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
        <text
          x={nowX + 5}
          y={padT + 11}
          fontSize="9.5"
          fontWeight="700"
          fill="#94A3B8"
        >
          {lang === "ru" ? "ПРОГНОЗ +6Ч →" : "БОЛЖОЛ +6С →"}
        </text>

        {/* Past curves */}
        <path d={pastDew} fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeOpacity="0.65" />
        <path d={pastAir} fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
        <path d={pastLeaf} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />

        {/* Forecast dashed curves */}
        <path d={futAir} fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="5 4" strokeOpacity="0.85" />
        <path
          d={futLeaf}
          fill="none"
          stroke={prediction.frost_level === "critical" ? "#FB7185" : "#34D399"}
          strokeWidth="2.6"
          strokeDasharray="6 4"
        />

        {/* Forecast endpoint dots */}
        {combined.slice(splitIdx + 1).map((c, idx) => {
          const i = splitIdx + 1 + idx;
          const isFreeze = c.leaf <= 0.5;
          return (
            <circle
              key={i}
              cx={xOf(i)}
              cy={yOf(c.leaf)}
              r={isFreeze ? 3.5 : 2.5}
              fill={isFreeze ? "#FB7185" : "#34D399"}
              stroke="#0F172A"
              strokeWidth={1.2}
            />
          );
        })}

        {/* Current live pulse dot */}
        {combined[splitIdx] && (
          <circle
            cx={nowX}
            cy={yOf(combined[splitIdx].leaf)}
            r={4.2}
            fill="#10B981"
            stroke="#ECFDF5"
            strokeWidth={1.6}
          />
        )}

        {/* X axis labels */}
        {combined.map((c, i) => {
          const show =
            i === 0 ||
            i === splitIdx ||
            i === combined.length - 1 ||
            (c.isForecast && (i - splitIdx) % 2 === 0) ||
            (!c.isForecast && i % 3 === 0);
          if (!show) return null;
          return (
            <text
              key={i}
              x={xOf(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize="9.5"
              fill={c.isForecast ? "#93C5FD" : "#64748B"}
              fontWeight={i === splitIdx ? "700" : "500"}
            >
              {c.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
