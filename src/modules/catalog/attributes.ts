/**
 * Category-driven, typed product attributes (FR-CAT-01). New attributes are data, not schema:
 * an admin defines e.g. "shade" (SELECT) for Cosmetics or "warranty_months" (NUMBER) for Gadgets,
 * and every product value is validated here against those definitions before it is stored.
 * Only defined attributes are accepted; unknown keys from the client are ignored (SRS §3).
 */

export const ATTRIBUTE_TYPES = ["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT"] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export interface AttributeValidationRules {
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
}

export interface AttributeOptionLike {
  id: string;
  value: string;
  label: string;
}

export interface AttributeDefinitionLike {
  id: string;
  code: string;
  label: string;
  type: AttributeType;
  unit?: string | null;
  /** Required for products in this category (from the category template). */
  required: boolean;
  isVariantAxis: boolean;
  validation?: AttributeValidationRules | null;
  options: readonly AttributeOptionLike[];
}

export interface NormalizedAttributeValue {
  attributeId: string;
  textValue?: string;
  numberValue?: number;
  dateValue?: Date;
  booleanValue?: boolean;
  optionIds?: string[];
}

export type RawAttributeInput = Record<string, string | string[] | undefined | null>;

const DEFAULT_TEXT_MAX = 1000;

function firstString(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

function asList(value: string | string[] | undefined | null): string[] {
  const list = Array.isArray(value) ? value : value ? value.split(",") : [];
  return list.map((v) => v.trim()).filter(Boolean);
}

function findOption(def: AttributeDefinitionLike, token: string): AttributeOptionLike | undefined {
  const lower = token.toLowerCase();
  return def.options.find((o) => o.id === token || o.value.toLowerCase() === lower || o.label.toLowerCase() === lower);
}

/**
 * Validates one attribute. Returns `null` when the attribute is empty and optional,
 * a normalized value when valid, or an error message.
 */
export function validateAttributeValue(
  def: AttributeDefinitionLike,
  raw: string | string[] | undefined | null,
): { value: NormalizedAttributeValue | null } | { error: string } {
  const rules = def.validation ?? {};
  const base = { attributeId: def.id };

  if (def.type === "MULTI_SELECT") {
    const tokens = asList(raw);
    if (tokens.length === 0) return def.required ? { error: `${def.label} is required` } : { value: null };
    const ids: string[] = [];
    for (const token of tokens) {
      const option = findOption(def, token);
      if (!option) return { error: `“${token}” is not a valid ${def.label} option` };
      if (!ids.includes(option.id)) ids.push(option.id);
    }
    return { value: { ...base, optionIds: ids } };
  }

  const text = firstString(raw);
  if (text === "") return def.required ? { error: `${def.label} is required` } : { value: null };

  switch (def.type) {
    case "TEXT": {
      const maxLength = rules.maxLength ?? DEFAULT_TEXT_MAX;
      if (text.length > maxLength) return { error: `${def.label} must be at most ${maxLength} characters` };
      return { value: { ...base, textValue: text } };
    }
    case "NUMBER": {
      if (!/^-?\d+(\.\d+)?$/.test(text)) return { error: `${def.label} must be a number` };
      const n = Number(text);
      if (!Number.isFinite(n)) return { error: `${def.label} must be a number` };
      if (rules.integer && !Number.isInteger(n)) return { error: `${def.label} must be a whole number` };
      if (rules.min !== undefined && n < rules.min) return { error: `${def.label} must be at least ${rules.min}` };
      if (rules.max !== undefined && n > rules.max) return { error: `${def.label} must be at most ${rules.max}` };
      return { value: { ...base, numberValue: n } };
    }
    case "DATE": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
      if (!date || date.toISOString().slice(0, 10) !== text) return { error: `${def.label} must be a valid date (YYYY-MM-DD)` };
      return { value: { ...base, dateValue: date } };
    }
    case "BOOLEAN": {
      const lower = text.toLowerCase();
      if (["true", "yes", "on", "1"].includes(lower)) return { value: { ...base, booleanValue: true } };
      if (["false", "no", "off", "0"].includes(lower)) return { value: { ...base, booleanValue: false } };
      return { error: `${def.label} must be yes or no` };
    }
    case "SELECT": {
      const option = findOption(def, text);
      if (!option) return { error: `“${text}” is not a valid ${def.label} option` };
      return { value: { ...base, optionIds: [option.id] } };
    }
  }
}

/**
 * Validates product-level attribute input (keyed by attribute code) against a category's
 * definitions. Variant axes (size, shade…) are excluded: they are chosen per variant.
 */
export function validateProductAttributes(
  definitions: readonly AttributeDefinitionLike[],
  input: RawAttributeInput,
): { values: NormalizedAttributeValue[]; errors: Record<string, string> } {
  const values: NormalizedAttributeValue[] = [];
  const errors: Record<string, string> = {};
  for (const def of definitions) {
    if (def.isVariantAxis) continue;
    const result = validateAttributeValue(def, input[def.code]);
    if ("error" in result) errors[def.code] = result.error;
    else if (result.value) values.push(result.value);
  }
  return { values, errors };
}

/** Human-readable value for storefront specification tables. */
export function formatAttributeValue(def: Pick<AttributeDefinitionLike, "type" | "unit" | "options">, value: NormalizedAttributeValue): string {
  const unit = def.unit ? ` ${def.unit}` : "";
  if (value.optionIds) {
    return value.optionIds.map((id) => def.options.find((o) => o.id === id)?.label ?? "").filter(Boolean).join(", ");
  }
  if (value.numberValue !== undefined) return `${value.numberValue}${unit}`;
  if (value.booleanValue !== undefined) return value.booleanValue ? "Yes" : "No";
  if (value.dateValue) return value.dateValue.toISOString().slice(0, 10);
  return value.textValue ?? "";
}
