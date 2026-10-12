"use client";

import { useState } from "react";
import { formatValue, Legend } from "./common";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = { x: cx + r * Math.sin(start), y: cy - r * Math.cos(start) };
  const e = { x: cx + r * Math.sin(end), y: cy - r * Math.cos(end) };
  return `M${s.x},${s.y} A${r},${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${e.x},${e.y}`;
}

/** Ring chart with a total in the centre, labelled legend (values shown), and a 2px gap between segments. */
export function DonutChart({ title, segments, centerLabel }: { title: string; segments: DonutSegment[]; centerLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 220;
  const r = 84;
  const stroke = 30;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 0.025 : 0;
  let angle = 0;
  const shown = active !== null ? segments[active] : null;
  return (
    <figure className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}, total ${total}.`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={stroke} />
        {total > 0
          ? segments.map((s, i) => {
              if (s.value <= 0) return null;
              const sweep = (s.value / total) * Math.PI * 2;
              const start = angle + gap / 2;
              const end = angle + sweep - gap / 2;
              angle += sweep;
              const full = s.value === total;
              return full ? (
                <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} />
              ) : (
                <path
                  key={s.label}
                  d={arc(size / 2, size / 2, r, start, end)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === i ? stroke + 6 : stroke}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                />
              );
            })
          : null}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="fill-[#101828] font-display text-[30px] font-bold">
          {formatValue(shown ? shown.value : total, "count")}
        </text>
        <text x={size / 2} y={size / 2 + 20} textAnchor="middle" className="fill-[#475467] text-[12px]">
          {shown ? shown.label : centerLabel}
        </text>
      </svg>
      <figcaption>
        <Legend items={segments.map((s) => ({ label: `${s.label}: ${formatValue(s.value, "count")}`, color: s.color }))} />
      </figcaption>
    </figure>
  );
}
