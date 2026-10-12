import { beforeAll, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { updateAttribute } from "@/modules/catalog/attribute.service";
import { createCategory, resolveAllCategoryTemplates, resolveCategoryAttributes, updateCategory } from "@/modules/catalog/category.service";
import {
  archiveProduct,
  bulkProductAction,
  createProduct,
  deleteDraftProduct,
  duplicateProduct,
  publishProduct,
  restoreProduct,
  unpublishProduct,
  updateProduct,
} from "@/modules/catalog/product.service";
import { combinationKey } from "@/modules/catalog/variants";
import type { StaffActor } from "@/modules/identity/actor";
import { seedCatalog, type SeededCatalog } from "../../prisma/fixtures/catalog";
import { createBusiness, createStaffActor, db, resetDatabase } from "../support/db";

let owner: StaffActor;
let businessId: string;
let catalog: SeededCatalog;

async function optionId(code: string, label: string) {
  return (await db.attributeOption.findFirstOrThrow({ where: { attribute: { code, businessId }, label } })).id;
}

beforeAll(async () => {
  await resetDatabase();
  businessId = (await createBusiness()).id;
  owner = await createStaffActor(businessId, "owner");
  catalog = await seedCatalog(owner);
});

describe("multi-category catalog without schema changes", () => {
  it("stores cosmetics with one variant per shade and typed attributes", async () => {
    const lipstick = await db.product.findUniqueOrThrow({
      where: { id: catalog.productIds["LIP-VELVET"] },
      include: { variants: { include: { options: { include: { option: true } }, prices: true } }, attributeValues: true },
    });
    expect(lipstick.productType).toBe("VARIANT");
    expect(lipstick.trackingMode).toBe("BATCH_EXPIRY");
    expect(lipstick.variants.map((v) => v.title).sort()).toEqual(["Nude Beige", "Rose Pink", "Ruby Red"]);
    expect(lipstick.variants.every((v) => v.prices[0]?.amountMinor === 65_000 && v.prices[0]?.compareAtMinor === 80_000)).toBe(true);
    expect(lipstick.attributeValues.find((a) => a.numberValue)?.numberValue?.toNumber()).toBe(4);
  });

  it("stores apparel as a size × color matrix", async () => {
    const kurti = await db.product.findUniqueOrThrow({ where: { id: catalog.productIds["KRT-CLASSIC"] }, include: { variants: true } });
    expect(kurti.variants).toHaveLength(6);
    expect(kurti.variants.map((v) => v.sku)).toContain("KRT-CLASSIC-S-NAVY");
    expect(kurti.priceFromMinor).toBe(189_000);
    expect(kurti.compareAtFromMinor).toBe(249_000);
  });

  it("stores gadgets with technical specs and serial tracking", async () => {
    const earbuds = await db.product.findUniqueOrThrow({
      where: { id: catalog.productIds["AUD-EARBUDS-PRO"] },
      include: { variants: true, attributeValues: { include: { attribute: true, option: true } } },
    });
    expect(earbuds.productType).toBe("SIMPLE");
    expect(earbuds.trackingMode).toBe("SERIAL");
    expect(earbuds.variants).toHaveLength(1);
    const byCode = (code: string) => earbuds.attributeValues.filter((v) => v.attribute.code === code);
    expect(byCode("warranty_months")[0]?.numberValue?.toNumber()).toBe(12);
    expect(byCode("water_resistant")[0]?.booleanValue).toBe(true);
    expect(byCode("connectivity").map((v) => v.option?.label).sort()).toEqual(["Bluetooth 5.3", "USB-C"]);
  });

  it("batched template resolution matches per-category resolution for every category", async () => {
    const all = await resolveAllCategoryTemplates(db, businessId);
    for (const id of Object.values(catalog.categoryIds)) {
      expect(all.get(id), id).toEqual(await resolveCategoryAttributes(db, id));
    }
  });

  it("inherits parent templates (Makeup inherits Beauty's ingredients)", async () => {
    const defs = await resolveCategoryAttributes(db, catalog.categoryIds.makeup!);
    expect(defs.map((d) => d.code)).toEqual(["ingredients", "shade", "volume_ml"]);
    expect(defs.find((d) => d.code === "shade")?.required).toBe(true);
  });
});

describe("product validation", () => {
  const base = () => ({
    title: "Test Serum",
    primaryCategoryId: catalog.categoryIds.skincare!,
    attributes: { skin_type: ["Dry"], volume_ml: "50" } as Record<string, string | string[]>,
    variants: [{ combinationKey: "default", sku: "TEST-SERUM-50", price: "999" }],
  });

  it("reports typed attribute, price and SKU errors together", async () => {
    const error = await createProduct(owner, {
      ...base(),
      attributes: { volume_ml: "fifty" },
      variants: [{ combinationKey: "default", sku: "x", price: "abc", compareAt: "1" }],
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toMatchObject({
      "attributes.skin_type": "Skin type is required",
      "attributes.volume_ml": "Volume must be a number",
      "variants.default.sku": expect.stringContaining("letters"),
      "variants.default.price": expect.stringContaining("amount"),
    });
  });

  it("rejects SKUs already used by another product (case-insensitive)", async () => {
    const error = await createProduct(owner, { ...base(), variants: [{ combinationKey: "default", sku: "ser-hydra-30", price: "999" }] }).catch((e: unknown) => e);
    expect((error as ValidationError).fieldErrors["variants.default.sku"]).toContain("already used");
  });

  it("requires a variant row for every combination and a compare-at above the price", async () => {
    const size = catalog.attributeIds.size!;
    const s = await optionId("size", "S");
    const m = await optionId("size", "M");
    const error = await createProduct(owner, {
      title: "Test Tee",
      primaryCategoryId: catalog.categoryIds.men!,
      attributes: { material: "Cotton" },
      axes: [{ attributeId: size, optionIds: [s, m] }],
      variants: [{ combinationKey: combinationKey([{ attributeId: size, optionId: s }]), sku: "TT-S", price: "500", compareAt: "400" }],
    }).catch((e: unknown) => e);
    const fields = (error as ValidationError).fieldErrors;
    expect(Object.values(fields).join(" ")).toContain("Missing details for M");
    expect(Object.values(fields).join(" ")).toContain("“Was” price must be higher");
  });

  it("rejects axes that are not part of the category template", async () => {
    const error = await createProduct(owner, {
      ...base(),
      axes: [{ attributeId: catalog.attributeIds.shade!, optionIds: [await optionId("shade", "Ruby Red")] }],
    }).catch((e: unknown) => e);
    expect((error as ValidationError).fieldErrors.axes).toContain("does not belong");
  });

  it("generates unique slugs from titles", async () => {
    const a = await createProduct(owner, { ...base(), variants: [{ combinationKey: "default", sku: "SLUG-A", price: "100" }] });
    const b = await createProduct(owner, { ...base(), variants: [{ combinationKey: "default", sku: "SLUG-B", price: "100" }] });
    expect(a.slug).toBe("test-serum");
    expect(b.slug).toBe("test-serum-2");
  });
});

describe("lifecycle and retention", () => {
  it("publishes, unpublishes, archives and restores with audit records", async () => {
    const id = catalog.productIds["HOM-CUSHION"]!;
    await publishProduct(owner, id);
    expect((await db.product.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
    await unpublishProduct(owner, id);
    await archiveProduct(owner, id);
    await expect(publishProduct(owner, id)).rejects.toBeInstanceOf(ConflictError);
    await restoreProduct(owner, id);
    const product = await db.product.findUniqueOrThrow({ where: { id } });
    expect(product.status).toBe("DRAFT");
    expect(product.firstPublishedAt).not.toBeNull();
    const actions = (await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["product.created", "product.published", "product.unpublished", "product.archived", "product.restored"]);
  });

  it("only deletes never-published drafts", async () => {
    await expect(deleteDraftProduct(owner, catalog.productIds["HOM-CUSHION"]!)).rejects.toBeInstanceOf(ConflictError);
    const draft = await createProduct(owner, {
      title: "Throwaway Draft",
      primaryCategoryId: catalog.categoryIds.home!,
      variants: [{ combinationKey: "default", sku: "THROWAWAY-1", price: "10" }],
    });
    await deleteDraftProduct(owner, draft.id);
    expect(await db.product.findUnique({ where: { id: draft.id } })).toBeNull();
  });

  it("re-validates required attributes at publish time after a template change", async () => {
    const home = catalog.categoryIds.home!;
    const product = await createProduct(owner, {
      title: "Plain Basket",
      primaryCategoryId: home,
      variants: [{ combinationKey: "default", sku: "BASKET-1", price: "450" }],
    });
    await updateCategory(owner, home, { name: "Home & Living", slug: "home-living", attributes: [{ attributeId: catalog.attributeIds.material!, isRequired: true }] });
    await expect(publishProduct(owner, product.id)).rejects.toThrow(/Material/);
  });

  it("duplicates as a draft with suffixed SKUs", async () => {
    const copy = await duplicateProduct(owner, catalog.productIds["TEE-CREW"]!);
    const full = await db.product.findUniqueOrThrow({ where: { id: copy.id }, include: { variants: true } });
    expect(full.status).toBe("DRAFT");
    expect(full.slug).toBe("everyday-crew-t-shirt-copy");
    expect(full.variants).toHaveLength(6);
    expect(full.variants.every((v) => v.sku.endsWith("-COPY"))).toBe(true);
    expect(full.priceFromMinor).toBe(69_000);
  });

  it("updates variants: removing an axis option deletes that variant and recomputes the from-price", async () => {
    const id = catalog.productIds["LIP-VELVET"]!;
    const shade = catalog.attributeIds.shade!;
    const ruby = await optionId("shade", "Ruby Red");
    const nude = await optionId("shade", "Nude Beige");
    await updateProduct(owner, id, {
      title: "Velvet Matte Lipstick",
      primaryCategoryId: catalog.categoryIds.makeup!,
      attributes: { volume_ml: "4" },
      axes: [{ attributeId: shade, optionIds: [ruby, nude] }],
      variants: [
        { combinationKey: combinationKey([{ attributeId: shade, optionId: ruby }]), sku: "LIP-VELVET-RUBY-RED", price: "600" },
        { combinationKey: combinationKey([{ attributeId: shade, optionId: nude }]), sku: "LIP-VELVET-NUDE-BEIGE", price: "550" },
      ],
    });
    const product = await db.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    expect(product.variants.map((v) => v.title).sort()).toEqual(["Nude Beige", "Ruby Red"]);
    expect(product.priceFromMinor).toBe(55_000);
    expect(product.compareAtFromMinor).toBeNull();
    expect(product.slug).toBe("velvet-matte-lipstick");
  });

  it("bulk actions report per-product failures", async () => {
    const archived = await createProduct(owner, {
      title: "Archived Mug",
      primaryCategoryId: catalog.categoryIds.home!,
      attributes: { material: "Stoneware" },
      variants: [{ combinationKey: "default", sku: "ARCHIVED-MUG", price: "100" }],
    });
    await archiveProduct(owner, archived.id);
    const result = await bulkProductAction(owner, [catalog.productIds["HOM-MUG-4"]!, archived.id], "publish");
    expect(result.succeeded).toBe(1);
    expect(result.failures).toEqual([{ productId: archived.id, error: expect.stringContaining("Restore") }]);
  });
});

describe("access control and integrity", () => {
  it("denies catalog writes to roles without catalog permissions", async () => {
    const crm = await createStaffActor(businessId, "crm_agent");
    await expect(
      createProduct(crm, { title: "Nope", primaryCategoryId: catalog.categoryIds.home!, variants: [{ combinationKey: "default", sku: "NOPE-1", price: "1" }] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishProduct(crm, catalog.productIds["HOM-MUG-4"]!)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets a catalog manager create but not touch another business's records", async () => {
    const manager = await createStaffActor(businessId, "catalog_manager");
    const foreign = { ...manager, businessId: "some-other-business" };
    await expect(publishProduct(foreign, catalog.productIds["HOM-MUG-4"]!)).rejects.toThrow(/not found/);
  });

  it("prevents category cycles and locks attribute type once in use", async () => {
    await expect(
      updateCategory(owner, catalog.categoryIds.beauty!, { name: "Beauty", slug: "beauty", parentId: catalog.categoryIds.makeup! }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateAttribute(owner, catalog.attributeIds.volume_ml!, { code: "volume_ml", label: "Volume", type: "TEXT" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces price integrity in the database itself", async () => {
    const variant = await db.productVariant.findFirstOrThrow({ where: { businessId }, include: { prices: true } });
    await expect(db.variantPrice.update({ where: { id: variant.prices[0]!.id }, data: { amountMinor: -1 } })).rejects.toThrow();
    await expect(
      db.variantPrice.update({ where: { id: variant.prices[0]!.id }, data: { compareAtMinor: variant.prices[0]!.amountMinor } }),
    ).rejects.toThrow();
  });

  it("rejects duplicate category slugs", async () => {
    await expect(createCategory(owner, { name: "Makeup" })).rejects.toBeInstanceOf(ValidationError);
  });
});
