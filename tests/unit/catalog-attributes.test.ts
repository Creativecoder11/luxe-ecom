import { describe, expect, it } from "vitest";
import {
  formatAttributeValue,
  validateAttributeValue,
  validateProductAttributes,
  type AttributeDefinitionLike,
} from "@/modules/catalog/attributes";

const opt = (id: string, label: string) => ({ id, value: label.toLowerCase().replace(/\s+/g, "-"), label });

// Cosmetics template
const shade: AttributeDefinitionLike = { id: "a-shade", code: "shade", label: "Shade", type: "SELECT", required: true, isVariantAxis: true, options: [opt("o-ruby", "Ruby Red"), opt("o-nude", "Nude Beige")] };
const skinType: AttributeDefinitionLike = { id: "a-skin", code: "skin_type", label: "Skin type", type: "MULTI_SELECT", required: true, isVariantAxis: false, options: [opt("o-dry", "Dry"), opt("o-oily", "Oily"), opt("o-all", "All skin types")] };
const ingredients: AttributeDefinitionLike = { id: "a-ing", code: "ingredients", label: "Ingredients", type: "TEXT", required: false, isVariantAxis: false, validation: { maxLength: 20 }, options: [] };
const volume: AttributeDefinitionLike = { id: "a-vol", code: "volume_ml", label: "Volume", type: "NUMBER", unit: "ml", required: false, isVariantAxis: false, validation: { min: 1, max: 5000 }, options: [] };
// Gadgets template
const warranty: AttributeDefinitionLike = { id: "a-war", code: "warranty_months", label: "Warranty", type: "NUMBER", unit: "months", required: true, isVariantAxis: false, validation: { min: 0, max: 60, integer: true }, options: [] };
const waterproof: AttributeDefinitionLike = { id: "a-wp", code: "waterproof", label: "Waterproof", type: "BOOLEAN", required: false, isVariantAxis: false, options: [] };
const launch: AttributeDefinitionLike = { id: "a-launch", code: "launch_date", label: "Launch date", type: "DATE", required: false, isVariantAxis: false, options: [] };

describe("validateProductAttributes", () => {
  it("validates a cosmetic: multi-select skin types, optional text and number; skips the shade axis", () => {
    const { values, errors } = validateProductAttributes([shade, skinType, ingredients, volume], {
      skin_type: ["Dry", "oily", "o-dry"],
      volume_ml: "30",
      shade: "ignored-axis",
      made_up_key: "dropped",
    });
    expect(errors).toEqual({});
    expect(values).toEqual([
      { attributeId: "a-skin", optionIds: ["o-dry", "o-oily"] },
      { attributeId: "a-vol", numberValue: 30 },
    ]);
  });

  it("reports required, range and option errors per attribute code", () => {
    const { errors } = validateProductAttributes([skinType, volume, warranty], { volume_ml: "0", warranty_months: "12.5" });
    expect(errors).toEqual({
      skin_type: "Skin type is required",
      volume_ml: "Volume must be at least 1",
      warranty_months: "Warranty must be a whole number",
    });
  });

  it("validates gadget specs: integer warranty, boolean and date", () => {
    const { values, errors } = validateProductAttributes([warranty, waterproof, launch], {
      warranty_months: "24",
      waterproof: "yes",
      launch_date: "2026-02-29",
    });
    expect(errors).toEqual({ launch_date: "Launch date must be a valid date (YYYY-MM-DD)" });
    expect(values).toEqual([
      { attributeId: "a-war", numberValue: 24 },
      { attributeId: "a-wp", booleanValue: true },
    ]);
  });
});

describe("validateAttributeValue edge cases", () => {
  it("rejects text over the configured length and non-numeric numbers", () => {
    expect(validateAttributeValue(ingredients, "x".repeat(21))).toEqual({ error: "Ingredients must be at most 20 characters" });
    expect(validateAttributeValue(volume, "30ml")).toEqual({ error: "Volume must be a number" });
    expect(validateAttributeValue(volume, "1e3")).toEqual({ error: "Volume must be a number" });
  });

  it("rejects unknown select options and accepts ids, values or labels", () => {
    expect(validateAttributeValue({ ...shade, isVariantAxis: false }, "Electric Blue")).toEqual({ error: "“Electric Blue” is not a valid Shade option" });
    for (const token of ["o-ruby", "ruby-red", "ruby red"]) {
      expect(validateAttributeValue(shade, token)).toEqual({ value: { attributeId: "a-shade", optionIds: ["o-ruby"] } });
    }
  });

  it("treats empty optional values as absent", () => {
    expect(validateAttributeValue(volume, "   ")).toEqual({ value: null });
    expect(validateAttributeValue(waterproof, undefined)).toEqual({ value: null });
  });

  it("formats values for specification tables", () => {
    expect(formatAttributeValue(volume, { attributeId: "a-vol", numberValue: 30 })).toBe("30 ml");
    expect(formatAttributeValue(skinType, { attributeId: "a-skin", optionIds: ["o-dry", "o-all"] })).toBe("Dry, All skin types");
    expect(formatAttributeValue(waterproof, { attributeId: "a-wp", booleanValue: false })).toBe("No");
  });
});
