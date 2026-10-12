/** Pure chart geometry helpers (unit-tested). */

/** Ticks from 0 to a "nice" maximum ≥ `max` (1, 2, 2.5 or 5 × 10ⁿ steps). Always at least [0, 1]. */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = integer ? Math.max(1, max / count) : max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const steps = integer && magnitude < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const step = steps.map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Monotone cubic (Fritsch–Carlson) path: smooth like the design, but never overshoots the data,
 * so a curve can't dip below zero or invent a peak between two points.
 */
export function monotonePath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]!.x - points[i]!.x);
    slope.push((points[i + 1]!.y - points[i]!.y) / dx[i]!);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  }
  tangent.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i]!;
      tangent[i + 1] = t * b * slope[i]!;
    }
  }
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${p0.x + h},${p0.y + tangent[i]! * h} ${p1.x - h},${p1.y - tangent[i + 1]! * h} ${p1.x},${p1.y}`;
  }
  return d;
}

/** Short axis label: 1,500 → "1.5k", 2,000,000 → "2M" (values in major units). */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${+(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${+(value / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${+(value / 1e3).toFixed(1)}k`;
  return String(+value.toFixed(1));
}
