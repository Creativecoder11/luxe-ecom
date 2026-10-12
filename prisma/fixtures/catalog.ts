/**
 * Synthetic multi-category catalog for development and tests (never production data).
 * Built through the real catalog services, so every fixture passes the same validation
 * as products created in the admin.
 */
import type { StaffActor } from "../../src/modules/identity/actor";
import { createAttribute } from "../../src/modules/catalog/attribute.service";
import type { AttributeInput } from "../../src/modules/catalog/attribute.service";
import { createBrand } from "../../src/modules/catalog/brand.service";
import { createCategory } from "../../src/modules/catalog/category.service";
import { createProduct, publishProduct } from "../../src/modules/catalog/product.service";
import { buildVariantCombinations } from "../../src/modules/catalog/variants";

const SAMPLE_NOTE = "\n\nSample product for development and testing.";

const attributes: AttributeInput[] = [
  { code: "shade", label: "Shade", type: "SELECT", isVariantAxis: true, isFilterable: true, options: [{ label: "Ruby Red", colorHex: "#9B111E" }, { label: "Nude Beige", colorHex: "#D8B59A" }, { label: "Rose Pink", colorHex: "#E8A0B4" }] },
  { code: "skin_type", label: "Skin type", type: "MULTI_SELECT", isFilterable: true, options: [{ label: "Dry" }, { label: "Oily" }, { label: "Combination" }, { label: "Sensitive" }, { label: "All skin types" }] },
  { code: "volume_ml", label: "Volume", type: "NUMBER", unit: "ml", min: "1", max: "5000" },
  { code: "ingredients", label: "Key ingredients", type: "TEXT", isSearchable: true, maxLength: "2000" },
  { code: "size", label: "Size", type: "SELECT", isVariantAxis: true, isFilterable: true, options: [{ label: "XS" }, { label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }] },
  { code: "color", label: "Color", type: "SELECT", isVariantAxis: true, isFilterable: true, options: [{ label: "Black", colorHex: "#111111" }, { label: "White", colorHex: "#FFFFFF" }, { label: "Navy", colorHex: "#1F2A44" }, { label: "Olive", colorHex: "#556B2F" }] },
  { code: "material", label: "Material", type: "TEXT", isSearchable: true, maxLength: "200" },
  { code: "fit", label: "Fit", type: "SELECT", isFilterable: true, options: [{ label: "Regular" }, { label: "Slim" }, { label: "Relaxed" }] },
  { code: "model", label: "Model", type: "TEXT", isSearchable: true, maxLength: "80" },
  { code: "warranty_months", label: "Warranty", type: "NUMBER", unit: "months", min: "0", max: "60", integer: true },
  { code: "connectivity", label: "Connectivity", type: "MULTI_SELECT", isFilterable: true, options: [{ label: "Bluetooth 5.3" }, { label: "Wi-Fi" }, { label: "USB-C" }] },
  { code: "battery_mah", label: "Battery", type: "NUMBER", unit: "mAh", min: "0", integer: true },
  { code: "water_resistant", label: "Water resistant", type: "BOOLEAN", isFilterable: true },
];

interface CategorySpec {
  key: string;
  name: string;
  parent?: string;
  trackingMode?: "NONE" | "BATCH_EXPIRY" | "SERIAL";
  template: [code: string, required: boolean][];
}

const categories: CategorySpec[] = [
  { key: "beauty", name: "Beauty", trackingMode: "BATCH_EXPIRY", template: [["ingredients", false]] },
  { key: "makeup", name: "Makeup", parent: "beauty", trackingMode: "BATCH_EXPIRY", template: [["shade", true], ["volume_ml", false]] },
  { key: "skincare", name: "Skincare", parent: "beauty", trackingMode: "BATCH_EXPIRY", template: [["skin_type", true], ["volume_ml", true]] },
  { key: "fashion", name: "Fashion", template: [["material", true], ["fit", false]] },
  { key: "women", name: "Women's clothing", parent: "fashion", template: [["size", true], ["color", false]] },
  { key: "men", name: "Men's clothing", parent: "fashion", template: [["size", true], ["color", false]] },
  { key: "gadgets", name: "Gadgets", trackingMode: "SERIAL", template: [["model", true], ["warranty_months", true]] },
  { key: "audio", name: "Audio", parent: "gadgets", trackingMode: "SERIAL", template: [["connectivity", false], ["battery_mah", false], ["water_resistant", false]] },
  { key: "wearables", name: "Wearables", parent: "gadgets", trackingMode: "SERIAL", template: [["connectivity", false], ["water_resistant", false], ["color", false]] },
  { key: "home", name: "Home & Living", template: [["material", false]] },
];

const brands = ["Aurora Beauty", "Thread & Co", "Volt Labs", "Hearth Home"];

interface ProductSpec {
  title: string;
  category: string;
  brand?: string;
  baseSku: string;
  description: string;
  attributes: Record<string, string | string[]>;
  axes?: [code: string, options: string[]][];
  price: string;
  compareAt?: string;
  cost?: string;
  publish: boolean;
}

const products: ProductSpec[] = [
  { title: "Velvet Matte Lipstick", category: "makeup", brand: "Aurora Beauty", baseSku: "LIP-VELVET", description: "Long-wear matte lipstick with a soft, non-drying finish.", attributes: { volume_ml: "4", ingredients: "Shea butter, vitamin E" }, axes: [["shade", ["Ruby Red", "Nude Beige", "Rose Pink"]]], price: "650", compareAt: "800", cost: "300", publish: true },
  { title: "Hydrating Face Serum 30 ml", category: "skincare", brand: "Aurora Beauty", baseSku: "SER-HYDRA-30", description: "Lightweight hyaluronic acid serum for daily hydration.", attributes: { skin_type: ["Dry", "Combination"], volume_ml: "30", ingredients: "Hyaluronic acid, niacinamide" }, price: "1250", cost: "520", publish: true },
  { title: "Gentle Foaming Cleanser 150 ml", category: "skincare", brand: "Aurora Beauty", baseSku: "CLN-GENTLE-150", description: "Low-pH foaming cleanser that removes makeup without stripping.", attributes: { skin_type: ["All skin types"], volume_ml: "150" }, price: "890", cost: "360", publish: true },
  { title: "Classic Cotton Kurti", category: "women", brand: "Thread & Co", baseSku: "KRT-CLASSIC", description: "Breathable cotton kurti with a straight cut, made for everyday wear.", attributes: { material: "100% cotton", fit: "Regular" }, axes: [["size", ["S", "M", "L"]], ["color", ["Navy", "Olive"]]], price: "1890", compareAt: "2490", cost: "900", publish: true },
  { title: "Everyday Crew T-Shirt", category: "men", brand: "Thread & Co", baseSku: "TEE-CREW", description: "Soft combed-cotton crew neck tee.", attributes: { material: "Combed cotton, 180 GSM", fit: "Slim" }, axes: [["size", ["M", "L", "XL"]], ["color", ["Black", "White"]]], price: "690", cost: "280", publish: true },
  { title: "Wireless Earbuds Pro", category: "audio", brand: "Volt Labs", baseSku: "AUD-EARBUDS-PRO", description: "True wireless earbuds with active noise cancellation and a pocketable charging case.", attributes: { model: "VL-EB200", warranty_months: "12", connectivity: ["Bluetooth 5.3", "USB-C"], battery_mah: "500", water_resistant: "yes" }, price: "3499", compareAt: "3999", cost: "2100", publish: true },
  { title: "Fitness Smart Band", category: "wearables", brand: "Volt Labs", baseSku: "WRB-BAND", description: "Heart-rate, sleep and step tracking with a 10-day battery.", attributes: { model: "VL-FB5", warranty_months: "6", connectivity: ["Bluetooth 5.3"], water_resistant: "yes" }, axes: [["color", ["Black", "Olive"]]], price: "2799", cost: "1600", publish: true },
  { title: "Stoneware Mug Set of 4", category: "home", brand: "Hearth Home", baseSku: "HOM-MUG-4", description: "Hand-glazed stoneware mugs, dishwasher safe.", attributes: { material: "Stoneware" }, price: "1490", cost: "700", publish: true },
  { title: "Linen Cushion Cover", category: "home", brand: "Hearth Home", baseSku: "HOM-CUSHION", description: "Washed linen cushion cover, 45 × 45 cm.", attributes: { material: "Linen" }, price: "750", publish: false },
];

export interface SeededCatalog {
  attributeIds: Record<string, string>;
  categoryIds: Record<string, string>;
  brandIds: Record<string, string>;
  productIds: Record<string, string>;
}

export async function seedCatalog(actor: StaffActor): Promise<SeededCatalog> {
  const attributeIds: Record<string, string> = {};
  const optionIds: Record<string, Record<string, string>> = {};
  for (const spec of attributes) {
    const created = await createAttribute(actor, spec);
    attributeIds[spec.code] = created.id;
  }
  const { db } = await import("../../src/lib/db/client");
  for (const option of await db.attributeOption.findMany({ where: { attributeId: { in: Object.values(attributeIds) } } })) {
    const code = Object.entries(attributeIds).find(([, id]) => id === option.attributeId)![0];
    (optionIds[code] ??= {})[option.label] = option.id;
  }

  const categoryIds: Record<string, string> = {};
  for (const [index, spec] of categories.entries()) {
    const created = await createCategory(actor, {
      name: spec.name,
      parentId: spec.parent ? categoryIds[spec.parent] : "",
      sortOrder: index,
      defaultTrackingMode: spec.trackingMode ?? "NONE",
      attributes: spec.template.map(([code, isRequired]) => ({ attributeId: attributeIds[code]!, isRequired })),
    });
    categoryIds[spec.key] = created.id;
  }

  const brandIds: Record<string, string> = {};
  for (const name of brands) brandIds[name] = (await createBrand(actor, { name })).id;

  const productIds: Record<string, string> = {};
  for (const spec of products) {
    const axes = (spec.axes ?? []).map(([code, labels]) => ({
      attributeId: attributeIds[code]!,
      label: code,
      options: labels.map((label) => ({ id: optionIds[code]![label]!, label, value: label.toLowerCase() })),
    }));
    const combos = buildVariantCombinations(axes);
    const product = await createProduct(actor, {
      title: spec.title,
      description: spec.description + SAMPLE_NOTE,
      primaryCategoryId: categoryIds[spec.category]!,
      brandId: spec.brand ? brandIds[spec.brand] : "",
      baseSku: spec.baseSku,
      attributes: spec.attributes,
      axes: axes.map((a) => ({ attributeId: a.attributeId, optionIds: a.options.map((o) => o.id) })),
      variants: combos.map((c) => ({
        combinationKey: c.key,
        sku: [spec.baseSku, ...c.values].join("-").toUpperCase().replace(/[^A-Z0-9-]+/g, "-"),
        price: spec.price,
        compareAt: spec.compareAt ?? "",
        cost: spec.cost ?? "",
        isActive: true,
      })),
    });
    if (spec.publish) await publishProduct(actor, product.id);
    productIds[spec.baseSku] = product.id;
  }
  return { attributeIds, categoryIds, brandIds, productIds };
}
