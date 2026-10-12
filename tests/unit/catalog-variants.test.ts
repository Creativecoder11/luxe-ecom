import { describe, expect, it } from "vitest";
import { slugify, isValidSlug } from "@/lib/slug";
import {
  buildVariantCombinations,
  combinationKey,
  DEFAULT_COMBINATION_KEY,
  findDuplicateSku,
  MAX_VARIANTS_PER_PRODUCT,
  normalizeSku,
  suggestSku,
} from "@/modules/catalog/variants";

const o = (id: string, label: string) => ({ id, label, value: label.toLowerCase() });

describe("buildVariantCombinations", () => {
  it("creates one default variant without axes (simple product, e.g. a gadget)", () => {
    expect(buildVariantCombinations([])).toEqual([{ key: DEFAULT_COMBINATION_KEY, title: "Default", options: [], values: [] }]);
  });

  it("creates the size × color matrix for apparel", () => {
    const combos = buildVariantCombinations([
      { attributeId: "size", label: "Size", options: [o("s", "S"), o("m", "M"), o("l", "L")] },
      { attributeId: "color", label: "Color", options: [o("black", "Black"), o("white", "White")] },
    ]);
    expect(combos).toHaveLength(6);
    expect(combos.map((c) => c.title)).toEqual(["S / Black", "S / White", "M / Black", "M / White", "L / Black", "L / White"]);
    expect(new Set(combos.map((c) => c.key)).size).toBe(6);
  });

  it("creates one variant per shade for cosmetics and ignores empty axes", () => {
    const combos = buildVariantCombinations([
      { attributeId: "shade", label: "Shade", options: [o("ruby", "Ruby"), o("nude", "Nude")] },
      { attributeId: "size", label: "Size", options: [] },
    ]);
    expect(combos.map((c) => c.title)).toEqual(["Ruby", "Nude"]);
  });

  it("produces order-independent combination keys", () => {
    expect(combinationKey([{ attributeId: "b", optionId: "2" }, { attributeId: "a", optionId: "1" }])).toBe(
      combinationKey([{ attributeId: "a", optionId: "1" }, { attributeId: "b", optionId: "2" }]),
    );
  });

  it("refuses combinatorial explosions", () => {
    const many = Array.from({ length: 11 }, (_, i) => o(`x${i}`, `X${i}`));
    expect(() =>
      buildVariantCombinations([
        { attributeId: "a", label: "A", options: many },
        { attributeId: "b", label: "B", options: many },
      ]),
    ).toThrow(String(MAX_VARIANTS_PER_PRODUCT));
  });
});

describe("SKUs", () => {
  it("normalizes valid SKUs and rejects invalid ones", () => {
    expect(normalizeSku("  lip-matte-01 ")).toBe("LIP-MATTE-01");
    expect(normalizeSku("tee blk m")).toBe("TEE-BLK-M");
    for (const bad of ["", "a", "-LEADING", "BAD/SKU", "X".repeat(65)]) expect(normalizeSku(bad), bad).toBeNull();
  });

  it("suggests SKUs and detects duplicates case-insensitively", () => {
    expect(suggestSku("tee-classic", ["m", "black"])).toBe("TEE-CLASSIC-M-BLACK");
    expect(findDuplicateSku(["A-1", "B-1", "a-1"])).toBe("A-1");
    expect(findDuplicateSku(["A-1", "B-1"])).toBeNull();
  });
});

describe("slugs", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Hydrating Face Serum 30 ml")).toBe("hydrating-face-serum-30-ml");
    expect(slugify("Café & Crème — Édition")).toBe("cafe-and-creme-edition");
    expect(slugify("শাড়ি")).toBe("");
    expect(isValidSlug("tee-classic")).toBe(true);
    expect(isValidSlug("Tee Classic")).toBe(false);
  });
});
