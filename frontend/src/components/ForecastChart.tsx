import React, { useState } from "react";
import { FrostPrediction, HistoryPoint, Lang } from "../types";

interface Props {
  history: HistoryPoint[];
  prediction: FrostPrediction;
  lang: Lang;
}

export const ForecastChart: React.FC<Props> = ({ history, prediction, lang }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const recent = history.slice(-10);
  const forecast = prediction.forecast_6h;

  const combined = [
    ...recent.map((p) => ({
      label: p.label,
      air: p.air_temp_c,
      leaf: p.leaf_temp_c,
      dew: p.dew_point_c,
      isForecast: false,
    })),
    ...forecast.map((f) => ({
      label: `+${f.offset_h}${lang === "ru" ? "ч" : "с"}`,
      air: f.pred_air_c,
      leaf: f.pred_leaf_c,
      dew: f.dew_point_c,
      isForecast: true,
    })),
  ];

  const W = 740;
  const H = 176;
  const padL = 40;
  const padR = 14;
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

  const buildPath = (points: { idx: number; val: number }[]): string => {
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
  const futDew = buildPath(combined.slice(splitIdx).map((c, i) => ({ idx: splitIdx + i, val: c.dew })));

  const step = span > 18 ? 6 : span > 10 ? 4 : 2;
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    ticks.push(v);
  }
  if (!ticks.includes(0) && 0 >= yMin && 0 <= yMax) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }

  const activePoint = hoverIdx !== null && combined[hoverIdx] ? combined[hoverIdx] : null;
  const colW = combined.length > 1 ? plotW / (combined.length - 1) : plotW;

  return (
    <section
      className="liquid-glass rounded-[22px] px-5 py-4"
      aria-label={lang === "ru" ? "Прогноз температуры на 6 часов" : "6 сааттык температура болжолу"}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium tracking-tight text-white">
            {lang === "ru"
              ? "Прогноз температуры на 6 часов"
              : "6 сааттык температура болжолу"}
          </h2>

          {/* Interactive point readout on hover/focus */}
          {activePoint && (
            <div className="font-mono-num flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-2.5 py-0.5 text-[11px] text-white">
              <span className="text-white/75">{activePoint.label}</span>
              <span className="text-[#7DD3FC]">
                {lang === "ru" ? "Воздух" : "Аба"} {activePoint.air > 0 ? "+" : ""}
                {activePoint.air.toFixed(1)}°
              </span>
              <span className="text-[#B5F043]">
                {lang === "ru" ? "Лист" : "Жалб."} {activePoint.leaf > 0 ? "+" : ""}
                {activePoint.leaf.toFixed(1)}°
              </span>
              <span className="text-[#E5D9B6]">
                {lang === "ru" ? "Роса" : "Шүүд."} {activePoint.dew > 0 ? "+" : ""}
                {activePoint.dew.toFixed(1)}°
              </span>
            </div>
          )}
        </div>

        {/* Distinct color + line-style legend (never color alone) */}
        <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-white/85">
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3.5 bg-[#7DD3FC]" aria-hidden="true" />
            {lang === "ru" ? "Воздух" : "Аба"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full bg-[#B5F043]" aria-hidden="true" />
            {lang === "ru" ? "Лист" : "Жалбырак"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-3.5 border-t-2 border-dotted border-[#E5D9B6]" aria-hidden="true" />
            {lang === "ru" ? "Точка росы" : "Шүүдүрүм"}
          </span>
          <span className="flex items-center gap-1.5 text-[#FF9494]">
            <span className="h-0 w-3.5 border-t border-dashed border-[#FF9494]" aria-hidden="true" />
            {lang === "ru" ? "Заморозок 0°C" : "Үшүк 0°C"}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          lang === "ru"
            ? `График температуры воздуха, листа и точки росы. Минимальный прогноз листа за 6 часов: ${prediction.min_predicted_leaf_c.toFixed(1)}°C, риск заморозка ${prediction.frost_risk_pct}%.`
            : `Аба, жалбырак жана шүүдүрүм графиги. 6 сааттагы минималдуу жалбырак: ${prediction.min_predicted_leaf_c.toFixed(1)}°C, үшүк коркунучу ${prediction.frost_risk_pct}%.`
        }
        onMouseLeave={() => setHoverIdx(null)}
        className="h-[152px] w-full overflow-visible"
      >
        <defs>
          <linearGradient id="glassFrostZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Forecast horizon highlight */}
        <rect
          x={nowX}
          y={padT}
          width={Math.max(0, W - padR - nowX)}
          height={plotH}
          fill="rgba(255, 255, 255, 0.06)"
          rx={8}
        />

        {/* Sub-zero freeze danger zone */}
        {zeroY < padT + plotH && (
          <rect
            x={padL}
            y={Math.max(padT, zeroY)}
            width={plotW}
            height={Math.max(0, padT + plotH - Math.max(padT, zeroY))}
            fill="url(#glassFrostZone)"
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
                stroke={isZero ? "#FF8787" : "rgba(255, 255, 255, 0.14)"}
                strokeWidth={isZero ? 1.3 : 1}
                strokeDasharray={isZero ? "5 4" : undefined}
              />
              <text
                x={padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10.5"
                fontFamily="JetBrains Mono, monospace"
                fill={isZero ? "#FF9494" : "rgba(255, 255, 255, 0.78)"}
                fontWeight={isZero ? "600" : "400"}
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
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth={1.1}
          strokeDasharray="3 3"
        />
        <text
          x={nowX + 6}
          y={padT + 12}
          fontSize="9.5"
          fontWeight="600"
          fill="rgba(255, 255, 255, 0.8)"
        >
          {lang === "ru" ? "ПРОГНОЗ +6Ч" : "БОЛЖОЛ +6С"}
        </text>

        {/* Past curves (solid Air/Leaf, dotted Dew Point) */}
        <path
          d={pastDew}
          fill="none"
          stroke="#E5D9B6"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          strokeOpacity="0.85"
        />
        <path d={pastAir} fill="none" stroke="#7DD3FC" strokeWidth="2.1" strokeLinecap="round" />
        <path d={pastLeaf} fill="none" stroke="#B5F043" strokeWidth="2.7" strokeLinecap="round" />

        {/* Forecast dashed curves */}
        <path
          d={futDew}
          fill="none"
          stroke="#E5D9B6"
          strokeWidth="1.3"
          strokeDasharray="2 3"
          strokeOpacity="0.65"
        />
        <path
          d={futAir}
          fill="none"
          stroke="#7DD3FC"
          strokeWidth="1.9"
          strokeDasharray="5 4"
          strokeOpacity="0.9"
        />
        <path
          d={futLeaf}
          fill="none"
          stroke={prediction.frost_level === "critical" ? "#FF6B6B" : "#B5F043"}
          strokeWidth="2.7"
          strokeDasharray="6 4"
        />

        {/* Active hover/focus vertical crosshair */}
        {hoverIdx !== null && combined[hoverIdx] && (
          <g>
            <line
              x1={xOf(hoverIdx)}
              y1={padT}
              x2={xOf(hoverIdx)}
              y2={padT + plotH}
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={1}
            />
            <circle
              cx={xOf(hoverIdx)}
              cy={yOf(combined[hoverIdx].air)}
              r={3.5}
              fill="#7DD3FC"
              stroke="#142215"
              strokeWidth={1.2}
            />
            <circle
              cx={xOf(hoverIdx)}
              cy={yOf(combined[hoverIdx].leaf)}
              r={4.2}
              fill={combined[hoverIdx].leaf <= 0.5 ? "#FF6B6B" : "#B5F043"}
              stroke="#FFFFFF"
              strokeWidth={1.4}
            />
          </g>
        )}

        {/* Forecast dots */}
        {combined.slice(splitIdx + 1).map((c, idx) => {
          const i = splitIdx + 1 + idx;
          const isFreeze = c.leaf <= 0.5;
          return (
            <circle
              key={i}
              cx={xOf(i)}
              cy={yOf(c.leaf)}
              r={isFreeze ? 3.5 : 2.5}
              fill={isFreeze ? "#FF6B6B" : "#B5F043"}
              stroke="#142215"
              strokeWidth={1.3}
            />
          );
        })}

        {/* Current live anchor */}
        {combined[splitIdx] && (
          <circle
            cx={nowX}
            cy={yOf(combined[splitIdx].leaf)}
            r={4.2}
            fill={prediction.frost_level === "critical" ? "#FF6B6B" : "#B5F043"}
            stroke="#FFFFFF"
            strokeWidth={1.6}
          />
        )}

        {/* X axis ticks (prevent adjacent overlap near splitIdx) */}
        {combined.map((c, i) => {
          const show =
            i === 0 ||
            i === splitIdx ||
            i === combined.length - 1 ||
            (c.isForecast && (i - splitIdx) % 2 === 0) ||
            (!c.isForecast && i % 3 === 0 && splitIdx - i >= 2);
          if (!show) return null;
          return (
            <text
              key={i}
              x={xOf(i)}
              y={H - 5}
              textAnchor="middle"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              fill={c.isForecast ? "#FFFFFF" : "rgba(255, 255, 255, 0.78)"}
              fontWeight={i === splitIdx ? "600" : "400"}
            >
              {c.label}
            </text>
          );
        })}

        {/* Accessible hover & keyboard focus hit zones */}
        {combined.map((c, i) => (
          <rect
            key={`hit-${i}`}
            x={xOf(i) - colW / 2}
            y={padT}
            width={Math.max(12, colW)}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${c.label}: ${lang === "ru" ? "воздух" : "аба"} ${c.air.toFixed(1)}°C, ${
              lang === "ru" ? "лист" : "жалбырак"
            } ${c.leaf.toFixed(1)}°C`}
            onMouseEnter={() => setHoverIdx(i)}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx(null)}
            className="cursor-crosshair outline-none"
          />
        ))}
      </svg>
    </section>
  );
};
