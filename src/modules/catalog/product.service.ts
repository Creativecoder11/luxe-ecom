import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, HEAVY_TRANSACTION } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertStorable, parseMajorToMinor } from "@/lib/money";
import { isValidSlug, slugify } from "@/lib/slug";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import { validateProductAttributes, type AttributeDefinitionLike } from "./attributes";
import { resolveCategoryAttributes } from "./category.service";
import { RETAIL_PRICE_LIST } from "./defaults";
import { buildVariantCombinations, combinationKey, findDuplicateSku, normalizeSku, type AxisSelection } from "./variants";

type Tx = Prisma.TransactionClient;

const variantInputSchema = z.object({
  combinationKey: z.string().min(1),
  sku: z.string().default(""),
  barcode: z.string().trim().max(64).optional().default(""),
  price: z.string().default(""),
  compareAt: z.string().optional().default(""),
  cost: z.string().optional().default(""),
  weightGrams: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(2, "Enter a product title").max(160),
  slug: z.string().trim().toLowerCase().optional().default(""),
  description: z.string().max(20_000).optional().default(""),
  brandId: z.string().optional().default(""),
  /** Empty uses the business default tax class at checkout. */
  taxClassId: z.string().optional().default(""),
  primaryCategoryId: z.string().min(1, "Choose a category"),
  additionalCategoryIds: z.array(z.string()).max(10).default([]),
  trackingMode: z.enum(["NONE", "BATCH_EXPIRY", "SERIAL"]).optional(),
  baseSku: z.string().trim().max(40).optional().default(""),
  returnPolicyNote: z.string().trim().max(500).optional().default(""),
  seoTitle: z.string().trim().max(70).optional().default(""),
  seoDescription: z.string().trim().max(160).optional().default(""),
  attributes: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  axes: z.array(z.object({ attributeId: z.string(), optionIds: z.array(z.string()) })).max(3).default([]),
  variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(100),
});

export type ProductInput = z.input<typeof productInputSchema>;

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function parseMoneyField(value: string, field: string, errors: Record<string, string>, { required }: { required: boolean }) {
  if (!value.trim()) {
    if (required) errors[field] = "Enter a price";
    return null;
  }
  const minor = parseMajorToMinor(value);
  if (minor === null || minor < 0) {
    errors[field] = "Enter an amount like 1250 or 1250.50";
    return null;
  }
  try {
    return assertStorable(minor);
  } catch {
    errors[field] = "Amount is too large";
    return null;
  }
}

interface PreparedVariant {
  combinationKey: string;
  title: string;
  options: { attributeId: string; optionId: string }[];
  sku: string;
  barcode: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  costMinor: number | null;
  weightGrams: number | null;
  isActive: boolean;
  position: number;
}

interface PreparedProduct {
  input: z.output<typeof productInputSchema>;
  slug: string;
  attributeValues: ReturnType<typeof validateProductAttributes>["values"];
  variants: PreparedVariant[];
  trackingMode: "NONE" | "BATCH_EXPIRY" | "SERIAL";
  productType: "SIMPLE" | "VARIANT";
}

/** Validates everything that can be checked before writing; throws one ValidationError with all field errors. */
async function prepareProduct(actor: StaffActor, raw: unknown, productId: string | null): Promise<PreparedProduct> {
  const input = productInputSchema.parse(raw);
  const errors: Record<string, string> = {};
  const businessId = actor.businessId;

  const category = await db.category.findFirst({ where: { id: input.primaryCategoryId, businessId } });
  if (!category) throw new ValidationError("Choose a valid category.", { primaryCategoryId: "Choose a valid category" });
  const extraIds = [...new Set(input.additionalCategoryIds.filter((id) => id !== category.id))];
  if (extraIds.length && (await db.category.count({ where: { id: { in: extraIds }, businessId } })) !== extraIds.length) {
    errors.additionalCategoryIds = "One of the additional categories is invalid";
  }
  if (input.brandId && !(await db.brand.findFirst({ where: { id: input.brandId, businessId } }))) {
    errors.brandId = "Choose a valid brand";
  }
  if (input.taxClassId && !(await db.taxClass.findFirst({ where: { id: input.taxClassId, businessId } }))) {
    errors.taxClassId = "Choose a valid VAT class";
  }

  // Typed attributes from the category template (and its ancestors).
  const definitions: AttributeDefinitionLike[] = await resolveCategoryAttributes(db, category.id);
  const attributeResult = validateProductAttributes(definitions, input.attributes);
  for (const [code, message] of Object.entries(attributeResult.errors)) errors[`attributes.${code}`] = message;

  // Variant axes must be axis attributes of this template, with valid options.
  const axisDefs = new Map(definitions.filter((d) => d.isVariantAxis).map((d) => [d.id, d]));
  const axes: AxisSelection[] = [];
  for (const axis of input.axes) {
    const def = axisDefs.get(axis.attributeId);
    if (!def) {
      errors.axes = "A selected variant option does not belong to this category";
      continue;
    }
    const optionIds = [...new Set(axis.optionIds)];
    const options = optionIds.map((id) => def.options.find((o) => o.id === id)).filter((o) => o !== undefined);
    if (options.length !== optionIds.length) errors[`axes.${def.code}`] = `Choose valid ${def.label} options`;
    if (options.length) axes.push({ attributeId: def.id, label: def.label, options });
  }
  for (const def of axisDefs.values()) {
    if (def.required && !axes.some((a) => a.attributeId === def.id)) errors[`axes.${def.code}`] = `Choose at least one ${def.label}`;
  }

  let combinations: ReturnType<typeof buildVariantCombinations> = [];
  try {
    combinations = buildVariantCombinations(axes);
  } catch (error) {
    if (error instanceof RangeError) errors.axes = error.message;
    else throw error;
  }

  const inputByKey = new Map(input.variants.map((v) => [v.combinationKey, v]));
  const variants: PreparedVariant[] = [];
  combinations.forEach((combo, index) => {
    const v = inputByKey.get(combo.key);
    const prefix = `variants.${combo.key}`;
    if (!v) {
      errors[`${prefix}.sku`] = `Missing details for ${combo.title}`;
      return;
    }
    const sku = normalizeSku(v.sku);
    if (!sku) errors[`${prefix}.sku`] = "Use 2–64 letters, digits, dots, dashes or underscores";
    const priceMinor = parseMoneyField(v.price, `${prefix}.price`, errors, { required: true });
    if (priceMinor === 0) errors[`${prefix}.price`] = "Price must be greater than zero";
    const compareAtMinor = parseMoneyField(v.compareAt, `${prefix}.compareAt`, errors, { required: false });
    if (compareAtMinor !== null && priceMinor !== null && compareAtMinor <= priceMinor) {
      errors[`${prefix}.compareAt`] = "“Was” price must be higher than the price";
    }
    const costMinor = parseMoneyField(v.cost, `${prefix}.cost`, errors, { required: false });
    let weightGrams: number | null = null;
    if (v.weightGrams.trim()) {
      const w = Number(v.weightGrams);
      if (!Number.isInteger(w) || w < 0 || w > 1_000_000) errors[`${prefix}.weightGrams`] = "Enter whole grams";
      else weightGrams = w;
    }
    variants.push({
      combinationKey: combo.key,
      title: combo.title,
      options: combo.options,
      sku: sku ?? "",
      barcode: v.barcode.trim() || null,
      priceMinor: priceMinor ?? 0,
      compareAtMinor,
      costMinor,
      weightGrams,
      isActive: v.isActive,
      position: index,
    });
  });

  if (variants.length && !variants.some((v) => v.isActive)) errors.variants = "At least one variant must be active";

  const duplicateSku = findDuplicateSku(variants.map((v) => v.sku).filter(Boolean));
  if (duplicateSku) errors.variants = `SKU ${duplicateSku} is used more than once`;
  const duplicateBarcode = findDuplicateSku(variants.map((v) => v.barcode ?? "").filter(Boolean));
  if (duplicateBarcode) errors.variants = `Barcode ${duplicateBarcode} is used more than once`;

  const skus = variants.map((v) => v.sku).filter(Boolean);
  if (skus.length) {
    const taken = await db.productVariant.findMany({
      where: { businessId, sku: { in: skus }, ...(productId ? { productId: { not: productId } } : {}) },
      select: { sku: true },
    });
    for (const t of taken) {
      const variant = variants.find((v) => v.sku === t.sku);
      if (variant) errors[`variants.${variant.combinationKey}.sku`] = `SKU ${t.sku} is already used by another product`;
    }
  }
  const barcodes = variants.map((v) => v.barcode).filter((b): b is string => !!b);
  if (barcodes.length) {
    const taken = await db.productVariant.findMany({
      where: { businessId, barcode: { in: barcodes }, ...(productId ? { productId: { not: productId } } : {}) },
      select: { barcode: true },
    });
    for (const t of taken) {
      const variant = variants.find((v) => v.barcode === t.barcode);
      if (variant) errors[`variants.${variant.combinationKey}.barcode`] = "Barcode already used by another product";
    }
  }

  // Slug: explicit slugs must be free; generated ones get a numeric suffix.
  let slug = input.slug;
  if (slug) {
    if (!isValidSlug(slug)) errors.slug = "Use lowercase letters, numbers and hyphens";
    else if (await db.product.findFirst({ where: { businessId, slug, ...(productId ? { id: { not: productId } } : {}) } })) {
      errors.slug = "Already used by another product";
    }
  } else {
    const base = slugify(input.title) || "product";
    slug = base;
    for (let n = 2; await db.product.findFirst({ where: { businessId, slug, ...(productId ? { id: { not: productId } } : {}) } }); n++) {
      slug = `${base}-${n}`;
    }
  }

  if (Object.keys(errors).length) throw new ValidationError("Please correct the highlighted fields.", errors);

  return {
    input,
    slug,
    attributeValues: attributeResult.values,
    variants,
    trackingMode: input.trackingMode ?? category.defaultTrackingMode,
    productType: axes.length ? "VARIANT" : "SIMPLE",
  };
}

async function retailPriceListId(tx: Tx, businessId: string) {
  const list = await tx.priceList.findUnique({ where: { businessId_code: { businessId, code: RETAIL_PRICE_LIST } } });
  if (!list) throw new Error("RETAIL price list missing: run the seed or bootstrap script");
  return list.id;
}

/** Recomputes the denormalized "from" price from active variants on the RETAIL list. */
async function refreshPriceCache(tx: Tx, productId: string, priceListId: string) {
  const cheapest = await tx.variantPrice.findFirst({
    where: { priceListId, variant: { productId, isActive: true } },
    orderBy: { amountMinor: "asc" },
    select: { amountMinor: true, compareAtMinor: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { priceFromMinor: cheapest?.amountMinor ?? null, compareAtFromMinor: cheapest?.compareAtMinor ?? null },
  });
}

async function writeProductDetails(tx: Tx, actor: StaffActor, productId: string, prepared: PreparedProduct) {
  const { input } = prepared;
  await tx.productCategory.deleteMany({ where: { productId } });
  const extra = [...new Set(input.additionalCategoryIds.filter((id) => id !== input.primaryCategoryId))];
  if (extra.length) await tx.productCategory.createMany({ data: extra.map((categoryId) => ({ productId, categoryId })) });

  await tx.productAttributeValue.deleteMany({ where: { productId } });
  const rows: Prisma.ProductAttributeValueCreateManyInput[] = prepared.attributeValues.flatMap((v): Prisma.ProductAttributeValueCreateManyInput[] =>
    v.optionIds
      ? v.optionIds.map((optionId) => ({ productId, attributeId: v.attributeId, optionId }))
      : [{
          productId,
          attributeId: v.attributeId,
          textValue: v.textValue ?? null,
          numberValue: v.numberValue !== undefined ? new Prisma.Decimal(v.numberValue) : null,
          dateValue: v.dateValue ?? null,
          booleanValue: v.booleanValue ?? null,
        }],
  );
  if (rows.length) await tx.productAttributeValue.createMany({ data: rows });

  // Sync variants by combination key: update kept ones, create new ones, delete removed ones.
  // (Gate 3 adds a guard: variants with stock movements or order lines are deactivated, not deleted.)
  const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true, combinationKey: true } });
  const keep = new Set(prepared.variants.map((v) => v.combinationKey));
  const removed = existing.filter((v) => !keep.has(v.combinationKey));
  if (removed.length) await tx.productVariant.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } });

  const priceListId = await retailPriceListId(tx, actor.businessId);
  for (const v of prepared.variants) {
    const data = {
      sku: v.sku,
      barcode: v.barcode,
      title: v.title,
      isActive: v.isActive,
      position: v.position,
      weightGrams: v.weightGrams,
      costMinor: v.costMinor,
    };
    const variant = await tx.productVariant.upsert({
      where: { productId_combinationKey: { productId, combinationKey: v.combinationKey } },
      create: { ...data, businessId: actor.businessId, productId, combinationKey: v.combinationKey },
      update: data,
    });
    await tx.variantOptionValue.deleteMany({ where: { variantId: variant.id } });
    if (v.options.length) {
      await tx.variantOptionValue.createMany({ data: v.options.map((o) => ({ variantId: variant.id, attributeId: o.attributeId, optionId: o.optionId })) });
    }
    await tx.variantPrice.upsert({
      where: { priceListId_variantId: { priceListId, variantId: variant.id } },
      create: { priceListId, variantId: variant.id, amountMinor: v.priceMinor, compareAtMinor: v.compareAtMinor },
      update: { amountMinor: v.priceMinor, compareAtMinor: v.compareAtMinor },
    });
  }
  await refreshPriceCache(tx, productId, priceListId);
}

function auditSummary(prepared: PreparedProduct) {
  return {
    title: prepared.input.title,
    slug: prepared.slug,
    categoryId: prepared.input.primaryCategoryId,
    variants: prepared.variants.map((v) => ({ sku: v.sku, price: v.priceMinor, compareAt: v.compareAtMinor, active: v.isActive })),
  };
}

function productData(prepared: PreparedProduct) {
  const { input } = prepared;
  return {
    slug: prepared.slug,
    title: input.title,
    description: input.description,
    brandId: input.brandId || null,
    taxClassId: input.taxClassId || null,
    primaryCategoryId: input.primaryCategoryId,
    productType: prepared.productType,
    trackingMode: prepared.trackingMode,
    baseSku: input.baseSku ? normalizeSku(input.baseSku) : null,
    returnPolicyNote: input.returnPolicyNote || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

async function translateUniqueViolations<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // A concurrent save may claim a SKU, barcode or slug between validation and write.
    if (isUniqueViolation(error)) throw new ConflictError("A SKU, barcode or URL slug was just taken by another product. Please review and save again.");
    throw error;
  }
}

export async function createProduct(actor: StaffActor, raw: unknown) {
  assertCan(actor, "catalog.create");
  const prepared = await prepareProduct(actor, raw, null);
  return translateUniqueViolations(() =>
    db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...productData(prepared), businessId: actor.businessId, status: "DRAFT", createdById: actor.userId },
      });
      await writeProductDetails(tx, actor, product.id, prepared);
      await recordAudit(tx, actor, { action: "product.created", entityType: "Product", entityId: product.id, after: auditSummary(prepared) });
      return product;
    }, HEAVY_TRANSACTION),
  );
}

export async function updateProduct(actor: StaffActor, productId: string, raw: unknown) {
  assertCan(actor, "catalog.update");
  const existing = await db.product.findFirst({
    where: { id: productId, businessId: actor.businessId },
    include: { variants: { include: { prices: true } } },
  });
  if (!existing) throw new NotFoundError("Product");
  if (existing.status === "ARCHIVED") throw new ConflictError("Restore this product before editing it.");
  const prepared = await prepareProduct(actor, raw, productId);

  return translateUniqueViolations(() =>
    db.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id: productId }, data: productData(prepared) });
      await writeProductDetails(tx, actor, productId, prepared);
      await recordAudit(tx, actor, {
        action: "product.updated",
        entityType: "Product",
        entityId: productId,
        before: {
          title: existing.title,
          slug: existing.slug,
          categoryId: existing.primaryCategoryId,
          variants: existing.variants.map((v) => ({ sku: v.sku, price: v.prices[0]?.amountMinor, active: v.isActive })),
        },
        after: auditSummary(prepared),
      });
      return product;
    }, HEAVY_TRANSACTION),
  );
}

async function getOwnedProduct(actor: StaffActor, productId: string) {
  const product = await db.product.findFirst({ where: { id: productId, businessId: actor.businessId } });
  if (!product) throw new NotFoundError("Product");
  return product;
}

/** Publication re-validates against the *current* category template, which may have changed since saving. */
export async function publishProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.publish");
  const product = await getOwnedProduct(actor, productId);
  if (product.status === "ARCHIVED") throw new ConflictError("Restore this product before publishing it.");

  const priced = await db.productVariant.count({
    where: { productId, isActive: true, prices: { some: { priceList: { code: RETAIL_PRICE_LIST } } } },
  });
  if (priced === 0) throw new ValidationError("Add at least one active, priced variant before publishing.");

  const definitions = await resolveCategoryAttributes(db, product.primaryCategoryId);
  const stored = await db.productAttributeValue.findMany({ where: { productId }, include: { attribute: { select: { code: true } } } });
  const missing = definitions
    .filter((d) => d.required && !d.isVariantAxis && !stored.some((v) => v.attributeId === d.id))
    .map((d) => d.label);
  if (missing.length) throw new ValidationError(`Complete the required details before publishing: ${missing.join(", ")}.`);

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { status: "ACTIVE", publishedAt: now, firstPublishedAt: product.firstPublishedAt ?? now },
    });
    await recordAudit(tx, actor, { action: "product.published", entityType: "Product", entityId: productId, before: { status: product.status }, after: { status: "ACTIVE" } });
  });
}

export async function unpublishProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.publish");
  const product = await getOwnedProduct(actor, productId);
  if (product.status !== "ACTIVE") return;
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { status: "DRAFT", publishedAt: null } });
    await recordAudit(tx, actor, { action: "product.unpublished", entityType: "Product", entityId: productId, before: { status: "ACTIVE" }, after: { status: "DRAFT" } });
  });
}

export async function archiveProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.archive");
  const product = await getOwnedProduct(actor, productId);
  if (product.status === "ARCHIVED") return;
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { status: "ARCHIVED", archivedAt: new Date(), publishedAt: null } });
    await recordAudit(tx, actor, { action: "product.archived", entityType: "Product", entityId: productId, before: { status: product.status }, after: { status: "ARCHIVED" } });
  });
}

export async function restoreProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.archive");
  const product = await getOwnedProduct(actor, productId);
  if (product.status !== "ARCHIVED") return;
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { status: "DRAFT", archivedAt: null } });
    await recordAudit(tx, actor, { action: "product.restored", entityType: "Product", entityId: productId, before: { status: "ARCHIVED" }, after: { status: "DRAFT" } });
  });
}

/**
 * Hard delete is only allowed for drafts that were never published (retention rule):
 * anything customers may have seen is archived instead. Gate 3 adds stock/order reference checks.
 */
export async function deleteDraftProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.delete");
  const product = await getOwnedProduct(actor, productId);
  if (product.status !== "DRAFT" || product.firstPublishedAt) {
    throw new ConflictError("Only never-published drafts can be deleted. Archive this product instead.");
  }
  await db.$transaction(async (tx) => {
    await tx.product.delete({ where: { id: productId } });
    await recordAudit(tx, actor, { action: "product.deleted", entityType: "Product", entityId: productId, before: { title: product.title, slug: product.slug } });
  });
}

/** Copies a product as a new draft with "-copy" slug and SKU suffixes (media is not copied). */
export async function duplicateProduct(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.create");
  const source = await db.product.findFirst({
    where: { id: productId, businessId: actor.businessId },
    include: {
      categories: true,
      attributeValues: true,
      variants: { include: { options: true, prices: true }, orderBy: { position: "asc" } },
    },
  });
  if (!source) throw new NotFoundError("Product");

  let slug = `${source.slug}-copy`.slice(0, 80);
  for (let n = 2; await db.product.findFirst({ where: { businessId: actor.businessId, slug } }); n++) slug = `${source.slug}-copy-${n}`.slice(0, 80);

  const claimed = new Set<string>();
  const isTaken = async (sku: string) =>
    claimed.has(sku) || !!(await db.productVariant.findUnique({ where: { businessId_sku: { businessId: actor.businessId, sku } }, select: { id: true } }));
  const copySkus = new Map<string, string>();
  for (const v of source.variants) {
    let candidate = `${v.sku}-COPY`.slice(0, 64);
    for (let n = 2; await isTaken(candidate); n++) candidate = `${v.sku}-COPY${n}`.slice(0, 64);
    claimed.add(candidate);
    copySkus.set(v.id, candidate);
  }

  return translateUniqueViolations(() => db.$transaction(async (tx) => {
    const copy = await tx.product.create({
      data: {
        businessId: actor.businessId,
        slug,
        title: `Copy of ${source.title}`.slice(0, 160),
        description: source.description,
        brandId: source.brandId,
        primaryCategoryId: source.primaryCategoryId,
        taxClassId: source.taxClassId,
        productType: source.productType,
        trackingMode: source.trackingMode,
        baseSku: source.baseSku,
        returnPolicyNote: source.returnPolicyNote,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        status: "DRAFT",
        createdById: actor.userId,
        categories: { create: source.categories.map((c) => ({ categoryId: c.categoryId })) },
        attributeValues: {
          create: source.attributeValues.map((v) => ({
            attributeId: v.attributeId,
            textValue: v.textValue,
            numberValue: v.numberValue,
            dateValue: v.dateValue,
            booleanValue: v.booleanValue,
            optionId: v.optionId,
          })),
        },
      },
    });
    for (const v of source.variants) {
      await tx.productVariant.create({
        data: {
          businessId: actor.businessId,
          productId: copy.id,
          sku: copySkus.get(v.id)!,
          barcode: null,
          title: v.title,
          combinationKey: combinationKey(v.options),
          isActive: v.isActive,
          position: v.position,
          weightGrams: v.weightGrams,
          costMinor: v.costMinor,
          options: { create: v.options.map((o) => ({ attributeId: o.attributeId, optionId: o.optionId })) },
          prices: { create: v.prices.map((p) => ({ priceListId: p.priceListId, amountMinor: p.amountMinor, compareAtMinor: p.compareAtMinor })) },
        },
      });
    }
    await refreshPriceCache(tx, copy.id, await retailPriceListId(tx, actor.businessId));
    await recordAudit(tx, actor, { action: "product.duplicated", entityType: "Product", entityId: copy.id, after: { sourceId: source.id, slug } });
    return copy;
  }));
}

export type BulkProductAction = "publish" | "unpublish" | "archive";

/** Applies an action to many products; reports per-product failures instead of failing the batch. */
export async function bulkProductAction(actor: StaffActor, productIds: readonly string[], action: BulkProductAction) {
  const ids = [...new Set(productIds)].slice(0, 200);
  const run = { publish: publishProduct, unpublish: unpublishProduct, archive: archiveProduct }[action];
  const failures: { productId: string; error: string }[] = [];
  let succeeded = 0;
  for (const id of ids) {
    try {
      await run(actor, id);
      succeeded++;
    } catch (error) {
      if (error instanceof Error && "code" in error) failures.push({ productId: id, error: error.message });
      else throw error;
    }
  }
  return { succeeded, failures };
}

/** Runs every save-time check without writing (used by CSV import dry runs). Throws ValidationError. */
export async function validateProductInput(actor: StaffActor, raw: unknown, productId: string | null): Promise<void> {
  assertCan(actor, productId ? "catalog.update" : "catalog.create");
  await prepareProduct(actor, raw, productId);
}
