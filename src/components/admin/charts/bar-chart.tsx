"use client";

import { useState } from "react";
import { DataTable, formatAxis, formatValue, Legend, Tooltip, TooltipRow, useWidth, type ChartSeries, type ValueFormat } from "./common";
import { niceTicks } from "./scale";

const PAD = { top: 18, right: 8, bottom: 30, left: 48 };
const GAP = 2;

/** Grouped vertical bars (rounded data ends on a zero baseline), per-group tooltip and a table view. */
export function BarChart({ title, labels, series, format, height = 220 }: { title: string; labels: string[]; series: ChartSeries[]; format: ValueFormat; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max, 4, format === "count");
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, labels.length);
  const groupW = Math.min(band * 0.72, 30 * series.length + GAP * (series.length - 1));
  const barW = (groupW - GAP * (series.length - 1)) / series.length;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  return (
    <div>
      {series.length > 1 ? (
        <div className="mb-2 flex justify-end">
          <Legend items={series} />
        </div>
      ) : null}
      <div ref={ref} className="relative w-full min-w-0">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}. Use the arrow keys to read each bar group, or open the table below.`}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setActive((a) => Math.min(labels.length - 1, (a ?? -1) + 1));
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? labels.length) - 1));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e7ebf1" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-[#7a8699] text-[11px]">
                {formatAxis(t, format)}
              </text>
            </g>
          ))}
          {labels.map((label, i) => {
            const gx = PAD.left + band * i + (band - groupW) / 2;
            return (
              <g key={label} onPointerEnter={() => setActive(i)}>
                {/* Hit target: the whole band, bigger than the bars. */}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill={active === i ? "#f2f6fc" : "transparent"} />
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const h = Math.max(v > 0 ? 2 : 0, PAD.top + plotH - y(v));
                  const bx = gx + si * (barW + GAP);
                  const r = Math.min(4, barW / 2, h);
                  return h > 0 ? (
                    <path
                      key={s.key}
                      d={`M${bx},${PAD.top + plotH} V${PAD.top + plotH - h + r} Q${bx},${PAD.top + plotH - h} ${bx + r},${PAD.top + plotH - h} H${bx + barW - r} Q${bx + barW},${PAD.top + plotH - h} ${bx + barW},${PAD.top + plotH - h + r} V${PAD.top + plotH} Z`}
                      fill={s.color}
                    />
                  ) : null;
                })}
                <text x={PAD.left + band * i + band / 2} y={height - 10} textAnchor="middle" className="fill-[#7a8699] text-[11px]">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
        {active !== null ? (
          <Tooltip
            x={PAD.left + band * active + band / 2}
            y={PAD.top}
            containerWidth={width}
            title={labels[active]!}
            rows={series.map((s) => (
              <TooltipRow key={s.key} color={s.color} label={s.label} value={formatValue(s.values[active] ?? 0, format)} />
            ))}
          />
        ) : null}
      </div>
      <DataTable caption={title} labels={labels} series={series} format={format} />
    </div>
  );
}
