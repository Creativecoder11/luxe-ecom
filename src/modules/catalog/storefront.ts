import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { getBusinessId } from "@/modules/business/context";
import { formatAttributeValue, type AttributeType } from "./attributes";
import { RETAIL_PRICE_LIST } from "./defaults";

/** Cache tag for every storefront catalog read; admin catalog writes call updateTag(CATALOG_TAG). */
export const CATALOG_TAG = "catalog";
export const LISTING_PAGE_SIZE = 24;

export type ListingSort = "newest" | "price_asc" | "price_desc";

export interface ListingFilters {
  categorySlug?: string;
  brandSlugs?: string[];
  q?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  /** attribute code → selected option values (or ["true"] for yes/no attributes) */
  attributes?: Record<string, string[]>;
  sort?: ListingSort;
  page?: number;
}

export interface ListingItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  priceFromMinor: number;
  compareAtFromMinor: number | null;
  /** True when active variants have different prices ("From ৳…"). */
  priceVaries: boolean;
  imageKey: string | null;
  imageAlt: string | null;
  /** Distinct colour options across active variants (for swatches), in option order. */
  swatches: { label: string; hex: string }[];
}

export interface FacetOption {
  value: string;
  label: string;
  colorHex: string | null;
  count: number;
}

export interface Facet {
  code: string;
  label: string;
  type: "SELECT" | "MULTI_SELECT" | "BOOLEAN";
  options: FacetOption[];
}

export interface Listing {
  category: { name: string; slug: string; description: string | null; lineage: { name: string; slug: string }[] } | null;
  items: ListingItem[];
  total: number;
  page: number;
  pageCount: number;
  facets: Facet[];
  brands: { slug: string; name: string; count: number }[];
  priceRange: { minMinor: number; maxMinor: number } | null;
}

interface CategoryRow {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "HIDDEN";
}

async function loadCategories(businessId: string): Promise<CategoryRow[]> {
  return db.category.findMany({
    where: { businessId },
    select: { id: true, parentId: true, slug: true, name: true, description: true, status: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Active subtree ids rooted at `rootId` (hidden categories and everything below them are excluded). */
function activeSubtree(categories: CategoryRow[], rootId: string): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const node = categories.find((c) => c.id === id);
    if (!node || node.status !== "ACTIVE") return;
    out.push(id);
    for (const child of categories.filter((c) => c.parentId === id)) visit(child.id);
  };
  visit(rootId);
  return out;
}

function lineageOf(categories: CategoryRow[], id: string) {
  const chain: CategoryRow[] = [];
  let current = categories.find((c) => c.id === id);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? categories.find((c) => c.id === current!.parentId) : undefined;
  }
  return chain;
}

/** A category is visible only if it and all its ancestors are ACTIVE. */
function isVisible(categories: CategoryRow[], id: string) {
  return lineageOf(categories, id).every((c) => c.status === "ACTIVE");
}

function normalizeFilters(filters: ListingFilters) {
  return {
    categorySlug: filters.categorySlug?.trim() || undefined,
    brandSlugs: [...new Set(filters.brandSlugs ?? [])].slice(0, 20),
    q: filters.q?.trim().slice(0, 100) || undefined,
    minPriceMinor: filters.minPriceMinor,
    maxPriceMinor: filters.maxPriceMinor,
    attributes: Object.fromEntries(
      Object.entries(filters.attributes ?? {})
        .filter(([, values]) => values.length > 0)
        .slice(0, 10)
        .map(([code, values]) => [code, [...new Set(values)].slice(0, 20)]),
    ),
    sort: filters.sort ?? "newest",
    page: Math.max(1, Math.min(500, Math.floor(filters.page ?? 1))),
  };
}

function collectSwatches(options: { label: string; colorHex: string | null; sortOrder: number }[]) {
  const seen = new Map<string, { label: string; hex: string; sortOrder: number }>();
  for (const o of options) if (o.colorHex && !seen.has(o.label)) seen.set(o.label, { label: o.label, hex: o.colorHex, sortOrder: o.sortOrder });
  return [...seen.values()].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 6).map(({ label, hex }) => ({ label, hex }));
}

const LISTING_SELECT = {
  id: true,
  slug: true,
  title: true,
  priceFromMinor: true,
  compareAtFromMinor: true,
  brand: { select: { name: true, status: true } },
  media: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true, alt: true } },
  variants: {
    where: { isActive: true },
    select: {
      prices: { where: { priceList: { code: RETAIL_PRICE_LIST } }, select: { amountMinor: true } },
      options: { where: { option: { colorHex: { not: null } } }, select: { option: { select: { label: true, colorHex: true, sortOrder: true } } } },
    },
  },
} satisfies Prisma.ProductSelect;

function toListingItem(r: Prisma.ProductGetPayload<{ select: typeof LISTING_SELECT }>): ListingItem {
  const prices = r.variants.flatMap((v) => v.prices.map((p) => p.amountMinor));
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    brand: r.brand?.status === "ACTIVE" ? r.brand.name : null,
    priceFromMinor: r.priceFromMinor ?? 0,
    compareAtFromMinor: r.compareAtFromMinor,
    priceVaries: prices.length > 1 && Math.min(...prices) !== Math.max(...prices),
    imageKey: r.media[0]?.storageKey ?? null,
    imageAlt: r.media[0]?.alt ?? null,
    swatches: collectSwatches(r.variants.flatMap((v) => v.options.map((o) => o.option))),
  };
}

/** Published, visible products by id, in the order given (unknown or hidden ids are skipped). */
export async function getListingItemsByIds(ids: string[]): Promise<ListingItem[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  if (ids.length === 0) return [];
  const businessId = await getBusinessId();
  const categories = await loadCategories(businessId);
  const visible = categories.filter((c) => isVisible(categories, c.id)).map((c) => c.id);
  const rows = await db.product.findMany({
    where: { id: { in: ids }, businessId, status: "ACTIVE", priceFromMinor: { not: null }, primaryCategoryId: { in: visible } },
    select: LISTING_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, toListingItem(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is ListingItem => Boolean(x));
}

/**
 * Published-product listing with category-subtree scope, brand/price/attribute filters, search,
 * sorting, pagination and facet counts computed from real records. Returns null for an unknown
 * or hidden category.
 */
export async function getStorefrontListing(rawFilters: ListingFilters): Promise<Listing | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const filters = normalizeFilters(rawFilters);
  const businessId = await getBusinessId();
  const categories = await loadCategories(businessId);

  let scope: string[] | null = null;
  let category: Listing["category"] = null;
  if (filters.categorySlug) {
    const match = categories.find((c) => c.slug === filters.categorySlug);
    if (!match || !isVisible(categories, match.id)) return null;
    scope = activeSubtree(categories, match.id);
    category = {
      name: match.name,
      slug: match.slug,
      description: match.description,
      lineage: lineageOf(categories, match.id).map((c) => ({ name: c.name, slug: c.slug })),
    };
  }
  // Products whose primary category is hidden (or under a hidden parent) are never listed.
  const visibleCategoryIds = categories.filter((c) => isVisible(categories, c.id)).map((c) => c.id);

  const base: Prisma.ProductWhereInput = {
    businessId,
    status: "ACTIVE",
    priceFromMinor: { not: null },
    primaryCategoryId: { in: visibleCategoryIds },
    ...(scope ? { OR: [{ primaryCategoryId: { in: scope } }, { categories: { some: { categoryId: { in: scope } } } }] } : {}),
  };
  const and: Prisma.ProductWhereInput[] = [];
  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { variants: { some: { isActive: true, sku: { contains: q, mode: "insensitive" } } } },
        { attributeValues: { some: { attribute: { isSearchable: true }, textValue: { contains: q, mode: "insensitive" } } } },
        { attributeValues: { some: { option: { label: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  if (filters.minPriceMinor !== undefined) and.push({ priceFromMinor: { gte: filters.minPriceMinor } });
  if (filters.maxPriceMinor !== undefined) and.push({ priceFromMinor: { lte: filters.maxPriceMinor } });
  const baseWithoutFacets: Prisma.ProductWhereInput = { ...base, AND: [...and] };
  if (filters.brandSlugs.length) and.push({ brand: { slug: { in: filters.brandSlugs }, status: "ACTIVE" } });

  // Facet definitions: filterable attributes in scope (category templates incl. ancestors), or all.
  const scopeIds = scope ? new Set([...scope, ...(category ? lineageOf(categories, categories.find((c) => c.slug === category!.slug)!.id).map((c) => c.id) : [])]) : null;
  const facetDefs = await db.attributeDefinition.findMany({
    where: {
      businessId,
      archivedAt: null,
      isFilterable: true,
      ...(scopeIds ? { categories: { some: { categoryId: { in: [...scopeIds] } } } } : {}),
    },
    include: { options: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
    orderBy: { label: "asc" },
  });

  for (const [code, values] of Object.entries(filters.attributes)) {
    const def = facetDefs.find((d) => d.code === code);
    if (!def) continue; // unknown filter keys are ignored, never trusted
    if (def.type === "BOOLEAN") {
      if (values.includes("true")) and.push({ attributeValues: { some: { attributeId: def.id, booleanValue: true } } });
    } else if (def.isVariantAxis) {
      and.push({ variants: { some: { isActive: true, options: { some: { attributeId: def.id, option: { value: { in: values } } } } } } });
    } else {
      and.push({ attributeValues: { some: { attributeId: def.id, option: { value: { in: values } } } } });
    }
  }

  const where: Prisma.ProductWhereInput = { ...base, AND: and };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === "price_asc"
      ? [{ priceFromMinor: "asc" }, { publishedAt: "desc" }]
      : filters.sort === "price_desc"
        ? [{ priceFromMinor: "desc" }, { publishedAt: "desc" }]
        : [{ publishedAt: "desc" }, { id: "asc" }];

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * LISTING_PAGE_SIZE,
      take: LISTING_PAGE_SIZE,
      select: LISTING_SELECT,
    }),
  ]);

  // Facet counts over the scope + search + price (independent of the attribute/brand selections).
  const candidateIds = (await db.product.findMany({ where: baseWithoutFacets, select: { id: true }, take: 5000 })).map((p) => p.id);
  const facets: Facet[] = [];
  if (candidateIds.length && facetDefs.length) {
    const axisIds = facetDefs.filter((d) => d.isVariantAxis).map((d) => d.id);
    const valueIds = facetDefs.filter((d) => !d.isVariantAxis && d.type !== "BOOLEAN").map((d) => d.id);
    const boolIds = facetDefs.filter((d) => d.type === "BOOLEAN").map((d) => d.id);
    const [axisCounts, valueCounts, boolCounts] = await Promise.all([
      axisIds.length
        ? db.$queryRaw<{ optionId: string; count: bigint }[]>`
            SELECT vov."optionId", COUNT(DISTINCT v."productId") AS count
            FROM variant_option_values vov JOIN product_variants v ON v.id = vov."variantId"
            WHERE v."isActive" AND v."productId" = ANY(${candidateIds}) AND vov."attributeId" = ANY(${axisIds})
            GROUP BY vov."optionId"`
        : [],
      valueIds.length
        ? db.$queryRaw<{ optionId: string; count: bigint }[]>`
            SELECT "optionId", COUNT(DISTINCT "productId") AS count FROM product_attribute_values
            WHERE "productId" = ANY(${candidateIds}) AND "attributeId" = ANY(${valueIds}) AND "optionId" IS NOT NULL
            GROUP BY "optionId"`
        : [],
      boolIds.length
        ? db.$queryRaw<{ attributeId: string; count: bigint }[]>`
            SELECT "attributeId", COUNT(DISTINCT "productId") AS count FROM product_attribute_values
            WHERE "productId" = ANY(${candidateIds}) AND "attributeId" = ANY(${boolIds}) AND "booleanValue" = true
            GROUP BY "attributeId"`
        : [],
    ]);
    const optionCount = new Map([...axisCounts, ...valueCounts].map((r) => [r.optionId, Number(r.count)]));
    for (const def of facetDefs) {
      if (def.type === "BOOLEAN") {
        const count = Number(boolCounts.find((b) => b.attributeId === def.id)?.count ?? 0);
        if (count) facets.push({ code: def.code, label: def.label, type: "BOOLEAN", options: [{ value: "true", label: "Yes", colorHex: null, count }] });
        continue;
      }
      if (def.type !== "SELECT" && def.type !== "MULTI_SELECT") continue;
      const options = def.options
        .map((o) => ({ value: o.value, label: o.label, colorHex: o.colorHex, count: optionCount.get(o.id) ?? 0 }))
        .filter((o) => o.count > 0);
      if (options.length) facets.push({ code: def.code, label: def.label, type: def.type, options });
    }
  }

  const [brandGroups, priceAgg] = await Promise.all([
    db.product.groupBy({ by: ["brandId"], where: { ...baseWithoutFacets, brandId: { not: null } }, _count: { _all: true } }),
    db.product.aggregate({ where: baseWithoutFacets, _min: { priceFromMinor: true }, _max: { priceFromMinor: true } }),
  ]);
  const brandRows = brandGroups.length
    ? await db.brand.findMany({ where: { id: { in: brandGroups.map((b) => b.brandId!) }, status: "ACTIVE" }, select: { id: true, slug: true, name: true } })
    : [];

  return {
    category,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE)),
    items: rows.map(toListingItem),
    facets,
    brands: brandRows
      .map((b) => ({ slug: b.slug, name: b.name, count: brandGroups.find((g) => g.brandId === b.id)?._count._all ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    priceRange:
      priceAgg._min.priceFromMinor !== null && priceAgg._max.priceFromMinor !== null
        ? { minMinor: priceAgg._min.priceFromMinor, maxMinor: priceAgg._max.priceFromMinor }
        : null,
  };
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  title: string;
  priceMinor: number;
  compareAtMinor: number | null;
  /** attribute code → option value */
  options: Record<string, string>;
}

export interface StorefrontProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: { name: string; slug: string } | null;
  lineage: { name: string; slug: string }[];
  returnPolicyNote: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  currency: string;
  axes: { code: string; label: string; options: { value: string; label: string; colorHex: string | null }[] }[];
  variants: StorefrontVariant[];
  specs: { label: string; value: string }[];
  media: { key: string; alt: string | null; width: number | null; height: number | null }[];
  categoryId: string;
}

export async function getStorefrontProduct(slug: string): Promise<StorefrontProduct | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const businessId = await getBusinessId();
  const product = await db.product.findFirst({
    where: { businessId, slug, status: "ACTIVE" },
    include: {
      brand: true,
      media: { orderBy: { sortOrder: "asc" } },
      attributeValues: { include: { attribute: { include: { options: true } }, option: true } },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: {
          prices: { where: { priceList: { code: RETAIL_PRICE_LIST } }, include: { priceList: true } },
          options: { include: { attribute: true, option: true } },
        },
      },
    },
  });
  if (!product) return null;
  const categories = await loadCategories(businessId);
  if (!isVisible(categories, product.primaryCategoryId)) return null;
  const variants = product.variants.filter((v) => v.prices.length > 0);
  if (variants.length === 0) return null;

  type AxisBuilder = StorefrontProduct["axes"][number] & { sort: Map<string, number> };
  const axes = new Map<string, AxisBuilder>();
  for (const v of variants) {
    for (const o of v.options) {
      const axis: AxisBuilder = axes.get(o.attribute.code) ?? { code: o.attribute.code, label: o.attribute.label, options: [], sort: new Map() };
      if (!axis.options.some((x) => x.value === o.option.value)) {
        axis.options.push({ value: o.option.value, label: o.option.label, colorHex: o.option.colorHex });
        axis.sort.set(o.option.value, o.option.sortOrder);
      }
      axes.set(o.attribute.code, axis);
    }
  }

  const specGroups = new Map<string, { label: string; type: AttributeType; unit: string | null; options: { id: string; value: string; label: string }[]; values: Parameters<typeof formatAttributeValue>[1][] }>();
  for (const v of product.attributeValues) {
    const a = v.attribute;
    const group = specGroups.get(a.id) ?? { label: a.label, type: a.type as AttributeType, unit: a.unit, options: a.options, values: [] };
    group.values.push({
      attributeId: a.id,
      ...(v.optionId ? { optionIds: [v.optionId] } : {}),
      ...(v.textValue !== null ? { textValue: v.textValue } : {}),
      ...(v.numberValue !== null ? { numberValue: v.numberValue.toNumber() } : {}),
      ...(v.booleanValue !== null ? { booleanValue: v.booleanValue } : {}),
      ...(v.dateValue !== null ? { dateValue: v.dateValue } : {}),
    });
    specGroups.set(a.id, group);
  }
  const specs = [...specGroups.values()].map((g) => ({
    label: g.label,
    value: g.values.map((value) => formatAttributeValue({ type: g.type, unit: g.unit, options: g.options }, value)).join(", "),
  }));

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    brand: product.brand && product.brand.status === "ACTIVE" ? { name: product.brand.name, slug: product.brand.slug } : null,
    lineage: lineageOf(categories, product.primaryCategoryId).map((c) => ({ name: c.name, slug: c.slug })),
    returnPolicyNote: product.returnPolicyNote,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    currency: variants[0]!.prices[0]!.priceList.currency,
    axes: [...axes.values()].map(({ sort, ...axis }) => ({
      ...axis,
      options: [...axis.options].sort((a, b) => (sort.get(a.value) ?? 0) - (sort.get(b.value) ?? 0)),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      priceMinor: v.prices[0]!.amountMinor,
      compareAtMinor: v.prices[0]!.compareAtMinor,
      options: Object.fromEntries(v.options.map((o) => [o.attribute.code, o.option.value])),
    })),
    specs,
    media: product.media.map((m) => ({ key: m.storageKey, alt: m.alt, width: m.width, height: m.height })),
    categoryId: product.primaryCategoryId,
  };
}

export interface NavCategory {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

/** Top-level visible categories with their visible children (header menu, homepage tiles). */
export async function getStorefrontNav(): Promise<NavCategory[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const categories = (await loadCategories(businessId)).filter((c) => c.status === "ACTIVE");
  return categories
    .filter((c) => c.parentId === null)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      children: categories.filter((child) => child.parentId === c.id).map((child) => ({ name: child.name, slug: child.slug })),
    }));
}

export async function getNewestProducts(limit = 8, excludeId?: string, categorySlug?: string): Promise<ListingItem[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const listing = await getStorefrontListing({ categorySlug, sort: "newest", page: 1 });
  return (listing?.items ?? []).filter((i) => i.id !== excludeId).slice(0, limit);
}

/** Sitemap entries for published products and visible categories. */
export async function getSitemapEntries() {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const categories = await loadCategories(businessId);
  const visible = categories.filter((c) => isVisible(categories, c.id));
  const products = await db.product.findMany({
    where: { businessId, status: "ACTIVE", priceFromMinor: { not: null }, primaryCategoryId: { in: visible.map((c) => c.id) } },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 5000,
  });
  return {
    categories: visible.map((c) => c.slug),
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
  };
}

/** Active brands that have at least one published product (header menu). */
export async function getStorefrontBrands(): Promise<{ name: string; slug: string }[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  return db.brand.findMany({
    where: { businessId, status: "ACTIVE", products: { some: { status: "ACTIVE", priceFromMinor: { not: null } } } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
    take: 30,
  });
}
