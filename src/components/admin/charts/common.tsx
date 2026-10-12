"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { compactNumber } from "./scale";

export type ValueFormat = "money" | "count";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** Money in minor units, counts as integers. */
  values: number[];
}

export function formatValue(value: number, format: ValueFormat): string {
  return format === "money" ? formatMoney(Math.round(value), "BDT") : new Intl.NumberFormat("en-IN").format(value);
}

export function formatAxis(value: number, format: ValueFormat): string {
  return format === "money" ? `৳${compactNumber(value / 100)}` : compactNumber(value);
}

/** Measures the chart container so the SVG uses real pixels (text never stretches). */
export function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Accessible table of the plotted numbers (required alongside every chart). */
export function DataTable({ caption, labels, series, format }: { caption: string; labels: string[]; series: ChartSeries[]; format: ValueFormat }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Period
              </th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="py-1.5 pr-3 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label} className="border-b border-border/60">
                <th scope="row" className="py-1.5 pr-3 font-normal">
                  {label}
                </th>
                {series.map((s) => (
                  <td key={s.key} className="py-1.5 pr-3 text-right tabular-nums">
                    {formatValue(s.values[i] ?? 0, format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Tooltip({ x, y, title, rows, containerWidth }: { x: number; y: number; title: string; rows: ReactNode; containerWidth: number }) {
  const flip = x > containerWidth - 170;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg bg-[#101828] px-3 py-2 text-xs text-white shadow-lg"
      style={{ left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined, top: Math.max(0, y - 12) }}
      role="presentation"
    >
      <p className="mb-1 font-semibold">{title}</p>
      {rows}
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-white/80">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </p>
  );
}
