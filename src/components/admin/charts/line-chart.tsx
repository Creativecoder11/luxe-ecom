"use client";

import { useState } from "react";
import { DataTable, formatAxis, formatValue, Legend, Tooltip, TooltipRow, useWidth, type ChartSeries, type ValueFormat } from "./common";
import { monotonePath, niceTicks } from "./scale";

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

/** Smooth (monotone, no overshoot) line chart with crosshair tooltip, keyboard stepping and a table view. */
export function LineChart({ title, labels, series, format, height = 220 }: { title: string; labels: string[]; series: ChartSeries[]; format: ValueFormat; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max, 4, format === "count");
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  function indexAt(clientX: number, rect: DOMRect) {
    const rel = clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(labels.length - 1, Math.round((rel / Math.max(1, plotW)) * (labels.length - 1))));
  }

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
          aria-label={`${title}. Use the arrow keys to read each month, or open the table below.`}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
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
          {labels.map((label, i) => (
            <text key={label} x={x(i)} y={height - 8} textAnchor="middle" className={active === i ? "fill-[#1570ef] text-[11px] font-semibold" : "fill-[#7a8699] text-[11px]"}>
              {label}
            </text>
          ))}
          {active !== null ? <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="#101828" strokeOpacity={0.35} /> : null}
          {series.map((s) => (
            <g key={s.key}>
              <path d={monotonePath(s.values.map((v, i) => ({ x: x(i), y: y(v) })))} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" />
              {s.values.map((v, i) =>
                active === i || labels.length === 1 ? <circle key={i} cx={x(i)} cy={y(v)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} /> : null,
              )}
            </g>
          ))}
        </svg>
        {active !== null ? (
          <Tooltip
            x={x(active)}
            y={Math.min(...series.map((s) => y(s.values[active] ?? 0)))}
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
