import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import type { AttributeType } from "./attributes";
import { listCategoryTree, resolveAllCategoryTemplates, type CategoryNode } from "./category.service";
import { RETAIL_PRICE_LIST } from "./defaults";

export const ADMIN_PRODUCTS_PAGE_SIZE = 25;

export interface AdminProductFilters {
  q?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId?: string;
  page?: number;
}

export async function listAdminProducts(actor: StaffActor, filters: AdminProductFilters) {
  assertCan(actor, "catalog.view");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const q = filters.q?.trim();
  const where: Prisma.ProductWhereInput = {
    businessId: actor.businessId,
    ...(filters.status ? { status: filters.status } : { status: { not: "ARCHIVED" } }),
    ...(filters.categoryId ? { OR: [{ primaryCategoryId: filters.categoryId }, { categories: { some: { categoryId: filters.categoryId } } }] } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { slug: { contains: q.toLowerCase() } },
                { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
                { variants: { some: { barcode: q } } },
              ],
            },
          ],
        }
      : {}),
  };
  const [total, rows, statusCounts] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_PRODUCTS_PAGE_SIZE,
      take: ADMIN_PRODUCTS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        productType: true,
        priceFromMinor: true,
        updatedAt: true,
        brand: { select: { name: true } },
        primaryCategory: { select: { name: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true } },
        _count: { select: { variants: true } },
      },
    }),
    db.product.groupBy({ by: ["status"], where: { businessId: actor.businessId }, _count: { _all: true } }),
  ]);
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE)),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Partial<Record<"DRAFT" | "ACTIVE" | "ARCHIVED", number>>,
  };
}

export interface EditorAttribute {
  id: string;
  code: string;
  label: string;
  type: AttributeType;
  unit: string | null;
  required: boolean;
  isVariantAxis: boolean;
  options: { id: string; label: string; value: string; colorHex: string | null }[];
}

export interface EditorVariant {
  sku: string;
  barcode: string;
  price: string;
  compareAt: string;
  cost: string;
  weightGrams: string;
  isActive: boolean;
}

export interface EditorProduct {
  id: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  firstPublishedAt: string | null;
  slug: string;
  title: string;
  description: string;
  brandId: string;
  taxClassId: string;
  primaryCategoryId: string;
  baseSku: string;
  returnPolicyNote: string;
  seoTitle: string;
  seoDescription: string;
  attributes: Record<string, string | string[]>;
  axes: Record<string, string[]>;
  variants: Record<string, EditorVariant>;
}

export interface ProductEditorData {
  categories: CategoryNode[];
  templates: Record<string, EditorAttribute[]>;
  brands: { id: string; name: string }[];
  taxClasses: { id: string; name: string; rateBasisPoints: number; isDefault: boolean }[];
  product: EditorProduct | null;
}

/** Minor units → plain major-unit string for inputs ("1890", "1250.5"). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

export async function getProductEditorData(actor: StaffActor, productId?: string): Promise<ProductEditorData> {
  assertCan(actor, "catalog.view");
  const [categories, brands, taxClasses] = await Promise.all([
    listCategoryTree(actor),
    db.brand.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.taxClass.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" }, select: { id: true, name: true, rateBasisPoints: true, isDefault: true } }),
  ]);

  const templates: Record<string, EditorAttribute[]> = {};
  const [colorRows, resolved] = await Promise.all([
    db.attributeOption.findMany({ where: { attribute: { businessId: actor.businessId } }, select: { id: true, colorHex: true } }),
    resolveAllCategoryTemplates(db, actor.businessId),
  ]);
  const colorById = new Map(colorRows.map((o) => [o.id, o.colorHex]));
  for (const category of categories) {
    templates[category.id] = (resolved.get(category.id) ?? []).map((d) => ({
      id: d.id,
      code: d.code,
      label: d.label,
      type: d.type,
      unit: d.unit ?? null,
      required: d.required,
      isVariantAxis: d.isVariantAxis,
      options: d.options.map((o) => ({ ...o, colorHex: colorById.get(o.id) ?? null })),
    }));
  }

  let product: EditorProduct | null = null;
  if (productId) {
    const p = await db.product.findFirst({
      where: { id: productId, businessId: actor.businessId },
      include: {
        attributeValues: { include: { attribute: true } },
        variants: {
          orderBy: { position: "asc" },
          include: { options: true, prices: { where: { priceList: { code: RETAIL_PRICE_LIST } } } },
        },
      },
    });
    if (!p) throw new NotFoundError("Product");
    const attributes: Record<string, string | string[]> = {};
    for (const v of p.attributeValues) {
      const code = v.attribute.code;
      if (v.attribute.type === "MULTI_SELECT") attributes[code] = [...((attributes[code] as string[] | undefined) ?? []), v.optionId!];
      else if (v.optionId) attributes[code] = v.optionId;
      else if (v.textValue !== null) attributes[code] = v.textValue;
      else if (v.numberValue !== null) attributes[code] = v.numberValue.toString();
      else if (v.booleanValue !== null) attributes[code] = v.booleanValue ? "true" : "false";
      else if (v.dateValue) attributes[code] = v.dateValue.toISOString().slice(0, 10);
    }
    const axes: Record<string, string[]> = {};
    for (const variant of p.variants) {
      for (const o of variant.options) {
        const list = (axes[o.attributeId] ??= []);
        if (!list.includes(o.optionId)) list.push(o.optionId);
      }
    }
    product = {
      id: p.id,
      status: p.status,
      firstPublishedAt: p.firstPublishedAt?.toISOString() ?? null,
      slug: p.slug,
      title: p.title,
      description: p.description,
      brandId: p.brandId ?? "",
      taxClassId: p.taxClassId ?? "",
      primaryCategoryId: p.primaryCategoryId,
      baseSku: p.baseSku ?? "",
      returnPolicyNote: p.returnPolicyNote ?? "",
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      attributes,
      axes,
      variants: Object.fromEntries(
        p.variants.map((v) => [
          v.combinationKey,
          {
            sku: v.sku,
            barcode: v.barcode ?? "",
            price: minorToInput(v.prices[0]?.amountMinor),
            compareAt: minorToInput(v.prices[0]?.compareAtMinor),
            cost: minorToInput(v.costMinor),
            weightGrams: v.weightGrams?.toString() ?? "",
            isActive: v.isActive,
          },
        ]),
      ),
    };
  }
  return { categories, templates, brands, taxClasses, product };
}
