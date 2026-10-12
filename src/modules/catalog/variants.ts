/**
 * Variant generation from axis attributes (e.g. Size × Color for apparel, Shade for cosmetics,
 * Storage for gadgets). A product without axes has exactly one default variant.
 */

export const MAX_VARIANTS_PER_PRODUCT = 100;

export interface AxisSelection {
  attributeId: string;
  label: string;
  /** Selected options for this product, in display order. */
  options: readonly { id: string; label: string; value: string }[];
}

export interface VariantCombination {
  /** Stable identity of the combination: sorted "attributeId=optionId" pairs. */
  key: string;
  title: string;
  options: { attributeId: string; optionId: string }[];
  /** Option values in axis order, for SKU suggestions. */
  values: string[];
}

export const DEFAULT_COMBINATION_KEY = "default";

export function combinationKey(options: readonly { attributeId: string; optionId: string }[]): string {
  if (options.length === 0) return DEFAULT_COMBINATION_KEY;
  return options
    .map((o) => `${o.attributeId}=${o.optionId}`)
    .sort()
    .join("|");
}

export function buildVariantCombinations(axes: readonly AxisSelection[]): VariantCombination[] {
  const active = axes.filter((a) => a.options.length > 0);
  if (active.length === 0) {
    return [{ key: DEFAULT_COMBINATION_KEY, title: "Default", options: [], values: [] }];
  }
  const total = active.reduce((n, a) => n * a.options.length, 1);
  if (total > MAX_VARIANTS_PER_PRODUCT) {
    throw new RangeError(`This would create ${total} variants; the limit is ${MAX_VARIANTS_PER_PRODUCT}.`);
  }
  let combos: { options: { attributeId: string; optionId: string }[]; labels: string[]; values: string[] }[] = [
    { options: [], labels: [], values: [] },
  ];
  for (const axis of active) {
    combos = combos.flatMap((combo) =>
      axis.options.map((option) => ({
        options: [...combo.options, { attributeId: axis.attributeId, optionId: option.id }],
        labels: [...combo.labels, option.label],
        values: [...combo.values, option.value],
      })),
    );
  }
  return combos.map((c) => ({ key: combinationKey(c.options), title: c.labels.join(" / "), options: c.options, values: c.values }));
}

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;

/** Uppercases and trims; returns null when the SKU is not 2–64 chars of A–Z, 0–9, dot, dash, underscore. */
export function normalizeSku(input: string): string | null {
  const sku = input.trim().toUpperCase().replace(/\s+/g, "-");
  return SKU_PATTERN.test(sku) ? sku : null;
}

/** Suggested SKU from a product code and option values, e.g. ("LIP-MATTE", ["ruby-red"]) → "LIP-MATTE-RUBY-RED". */
export function suggestSku(baseCode: string, values: readonly string[]): string {
  const parts = [baseCode, ...values].map((p) =>
    p
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
  return parts.filter(Boolean).join("-").slice(0, 64).replace(/-+$/, "");
}

/** Returns the first SKU that appears more than once (case-insensitive), or null. */
export function findDuplicateSku(skus: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const sku of skus) {
    const key = sku.toUpperCase();
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}
