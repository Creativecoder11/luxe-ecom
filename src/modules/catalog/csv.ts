import "server-only";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { CsvParseError, parseCsv } from "@/lib/csv-parse";
import { db } from "@/lib/db/client";
import { DomainError, ValidationError } from "@/lib/errors";
import { isValidSlug } from "@/lib/slug";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, can, type StaffActor } from "@/modules/identity/actor";
import { minorToInput } from "./admin-queries";
import { resolveCategoryAttributes } from "./category.service";
import { RETAIL_PRICE_LIST } from "./defaults";
import { createProduct, publishProduct, unpublishProduct, updateProduct, validateProductInput, type ProductInput } from "./product.service";
import { combinationKey } from "./variants";

export const CSV_MAX_ROWS = 2000;
export const CSV_MAX_BYTES = 900 * 1024; // below the 1 MB default server-action body limit

const PRODUCT_COLUMNS = ["product_slug", "title", "category_slug", "brand_slug", "status", "description", "base_sku"] as const;
const VARIANT_COLUMNS = ["sku", "barcode", "price", "compare_at", "cost", "weight_grams", "variant_active"] as const;
const REQUIRED = ["product_slug", "title", "category_slug", "sku", "price"] as const;

// ---------------------------------------------------------------- export

/** One row per variant; option and attribute columns cover every code used by the exported products. */
export async function exportProductsCsv(actor: StaffActor): Promise<{ csv: string; rowCount: number }> {
  assertCan(actor, "catalog.export");
  const products = await db.product.findMany({
    where: { businessId: actor.businessId, status: { not: "ARCHIVED" } },
    orderBy: { slug: "asc" },
    include: {
      brand: { select: { slug: true } },
      primaryCategory: { select: { slug: true } },
      attributeValues: { include: { attribute: { select: { code: true, type: true } }, option: { select: { label: true } } } },
      variants: {
        orderBy: { position: "asc" },
        include: {
          options: { include: { attribute: { select: { code: true } }, option: { select: { label: true } } } },
          prices: { where: { priceList: { code: RETAIL_PRICE_LIST } } },
        },
      },
    },
  });

  const optionCodes = [...new Set(products.flatMap((p) => p.variants.flatMap((v) => v.options.map((o) => o.attribute.code))))].sort();
  const attrCodes = [...new Set(products.flatMap((p) => p.attributeValues.map((a) => a.attribute.code)))].sort();

  type Row = { product: (typeof products)[number]; variant: (typeof products)[number]["variants"][number] };
  const rows: Row[] = products.flatMap((product) => product.variants.map((variant) => ({ product, variant })));

  const attributeValue = (product: Row["product"], code: string) => {
    const values = product.attributeValues.filter((a) => a.attribute.code === code);
    return values
      .map((v) => v.option?.label ?? v.textValue ?? v.numberValue?.toString() ?? (v.booleanValue !== null ? String(v.booleanValue) : v.dateValue?.toISOString().slice(0, 10) ?? ""))
      .join("|");
  };

  const columns: CsvColumn<Row>[] = [
    { header: "product_slug", value: (r) => r.product.slug },
    { header: "title", value: (r) => r.product.title },
    { header: "category_slug", value: (r) => r.product.primaryCategory.slug },
    { header: "brand_slug", value: (r) => r.product.brand?.slug ?? "" },
    { header: "status", value: (r) => (r.product.status === "ACTIVE" ? "published" : "draft") },
    { header: "description", value: (r) => r.product.description },
    { header: "base_sku", value: (r) => r.product.baseSku ?? "" },
    { header: "sku", value: (r) => r.variant.sku },
    { header: "barcode", value: (r) => r.variant.barcode ?? "" },
    { header: "price", value: (r) => minorToInput(r.variant.prices[0]?.amountMinor) },
    { header: "compare_at", value: (r) => minorToInput(r.variant.prices[0]?.compareAtMinor) },
    { header: "cost", value: (r) => minorToInput(r.variant.costMinor) },
    { header: "weight_grams", value: (r) => r.variant.weightGrams ?? "" },
    { header: "variant_active", value: (r) => (r.variant.isActive ? "true" : "false") },
    ...optionCodes.map((code) => ({ header: `option:${code}`, value: (r: Row) => r.variant.options.find((o) => o.attribute.code === code)?.option.label ?? "" })),
    ...attrCodes.map((code) => ({ header: `attr:${code}`, value: (r: Row) => attributeValue(r.product, code) })),
  ];

  await db.$transaction((tx) =>
    recordAudit(tx, actor, { action: "catalog.exported", entityType: "Product", after: { products: products.length, rows: rows.length } }),
  );
  return { csv: toCsv(rows, columns), rowCount: rows.length };
}

// ---------------------------------------------------------------- import

export interface ImportIssue {
  /** 1-based CSV line number (header is line 1); null for file-level problems. */
  line: number | null;
  message: string;
}

export interface ImportReport {
  applied: boolean;
  products: number;
  variants: number;
  creates: number;
  updates: number;
  issues: ImportIssue[];
}

interface PlannedProduct {
  slug: string;
  existingId: string | null;
  status: "published" | "draft" | "";
  input: ProductInput;
  /** combination key → CSV line, for mapping variant errors back to rows */
  lines: Map<string, number>;
  firstLine: number;
}

function bool(value: string, fallback: boolean): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "") return fallback;
  if (["true", "yes", "1"].includes(v)) return true;
  if (["false", "no", "0"].includes(v)) return false;
  return null;
}

/**
 * Validates a CSV of products (one row per variant) and, when `apply` is true and the whole file
 * is valid, creates/updates the products. Nothing is written if any row has an error.
 */
export async function importProductsCsv(actor: StaffActor, text: string, options: { apply: boolean }): Promise<ImportReport> {
  assertCan(actor, "catalog.import");
  const report: ImportReport = { applied: false, products: 0, variants: 0, creates: 0, updates: 0, issues: [] };
  const issue = (line: number | null, message: string) => report.issues.push({ line, message });

  let parsed;
  try {
    parsed = parseCsv(text, { maxRows: CSV_MAX_ROWS });
  } catch (error) {
    if (error instanceof CsvParseError) {
      issue(null, error.message);
      return report;
    }
    throw error;
  }
  const missing = REQUIRED.filter((h) => !parsed.headers.includes(h));
  if (missing.length) {
    issue(null, `Missing required columns: ${missing.join(", ")}.`);
    return report;
  }
  const known = new Set<string>([...PRODUCT_COLUMNS, ...VARIANT_COLUMNS]);
  for (const h of parsed.headers) {
    if (!known.has(h) && !h.startsWith("option:") && !h.startsWith("attr:")) issue(null, `Unknown column “${h}”.`);
  }
  if (report.issues.length) return report;

  // Group rows by product.
  const groups = new Map<string, { line: number; row: Record<string, string> }[]>();
  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    const slug = row.product_slug!.trim().toLowerCase();
    if (!isValidSlug(slug)) return issue(line, `product_slug “${row.product_slug}” must use lowercase letters, numbers and hyphens.`);
    groups.set(slug, [...(groups.get(slug) ?? []), { line, row }]);
  });

  const [categories, brands, existing] = await Promise.all([
    db.category.findMany({ where: { businessId: actor.businessId }, select: { id: true, slug: true } }),
    db.brand.findMany({ where: { businessId: actor.businessId }, select: { id: true, slug: true } }),
    db.product.findMany({ where: { businessId: actor.businessId, slug: { in: [...groups.keys()] } }, select: { id: true, slug: true, status: true } }),
  ]);
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));
  const templateCache = new Map<string, Awaited<ReturnType<typeof resolveCategoryAttributes>>>();

  const planned: PlannedProduct[] = [];
  for (const [slug, rows] of groups) {
    const first = rows[0]!;
    const productField = (name: string) => (first.row[name] ?? "").trim();
    for (const { line, row } of rows.slice(1)) {
      for (const col of [...PRODUCT_COLUMNS, ...parsed.headers.filter((h) => h.startsWith("attr:"))]) {
        if ((row[col] ?? "").trim() && (row[col] ?? "").trim() !== productField(col)) {
          issue(line, `“${col}” differs from line ${first.line} for product ${slug}; product-level values must match on every row.`);
        }
      }
    }
    const categoryId = categoryBySlug.get(productField("category_slug"));
    if (!categoryId) {
      issue(first.line, `Unknown category_slug “${productField("category_slug")}”.`);
      continue;
    }
    const brandSlug = productField("brand_slug");
    const brandId = brandSlug ? brandBySlug.get(brandSlug) : "";
    if (brandSlug && !brandId) issue(first.line, `Unknown brand_slug “${brandSlug}”.`);
    const status = productField("status").toLowerCase();
    if (status && status !== "published" && status !== "draft") issue(first.line, `status must be “published” or “draft”.`);
    if (status === "published" && !can(actor, "catalog.publish")) issue(first.line, "You do not have permission to publish products.");

    const template = templateCache.get(categoryId) ?? (await resolveCategoryAttributes(db, categoryId));
    templateCache.set(categoryId, template);

    const attributes: Record<string, string | string[]> = {};
    for (const header of parsed.headers.filter((h) => h.startsWith("attr:"))) {
      const code = header.slice(5);
      const raw = productField(header);
      if (!raw) continue;
      const def = template.find((d) => d.code === code && !d.isVariantAxis);
      if (!def) {
        issue(first.line, `Attribute “${code}” is not part of this category's template.`);
        continue;
      }
      attributes[code] = def.type === "MULTI_SELECT" ? raw.split("|").map((v) => v.trim()) : raw;
    }

    const optionHeaders = parsed.headers.filter((h) => h.startsWith("option:"));
    const axisOptionIds = new Map<string, string[]>();
    const lines = new Map<string, number>();
    const variants: ProductInput["variants"] = [];
    for (const { line, row } of rows) {
      const options: { attributeId: string; optionId: string }[] = [];
      for (const header of optionHeaders) {
        const raw = (row[header] ?? "").trim();
        if (!raw) continue;
        const code = header.slice(7);
        const def = template.find((d) => d.code === code && d.isVariantAxis);
        const option = def?.options.find((o) => o.label.toLowerCase() === raw.toLowerCase() || o.value === raw.toLowerCase());
        if (!def || !option) {
          issue(line, def ? `“${raw}” is not a ${def.label} option.` : `“${code}” is not a variant option in this category.`);
          continue;
        }
        options.push({ attributeId: def.id, optionId: option.id });
        const list = axisOptionIds.get(def.id) ?? [];
        if (!list.includes(option.id)) list.push(option.id);
        axisOptionIds.set(def.id, list);
      }
      const active = bool(row.variant_active ?? "", true);
      if (active === null) issue(line, "variant_active must be true or false.");
      const key = combinationKey(options);
      if (lines.has(key)) issue(line, `Duplicate variant (same options as line ${lines.get(key)}).`);
      lines.set(key, line);
      variants.push({
        combinationKey: key,
        sku: row.sku ?? "",
        barcode: row.barcode ?? "",
        price: row.price ?? "",
        compareAt: row.compare_at ?? "",
        cost: row.cost ?? "",
        weightGrams: row.weight_grams ?? "",
        isActive: active ?? true,
      });
    }

    planned.push({
      slug,
      existingId: existingBySlug.get(slug)?.id ?? null,
      status: (status as PlannedProduct["status"]) || "",
      firstLine: first.line,
      lines,
      input: {
        title: productField("title"),
        slug,
        description: first.row.description ?? "",
        brandId: brandId ?? "",
        primaryCategoryId: categoryId,
        baseSku: productField("base_sku"),
        attributes,
        axes: [...axisOptionIds].map(([attributeId, optionIds]) => ({ attributeId, optionIds })),
        variants,
      },
    });
  }

  // Full service validation of every product, without writing.
  for (const product of planned) {
    try {
      await validateProductInput(actor, product.input, product.existingId);
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      const fields = Object.entries(error.fieldErrors);
      if (fields.length === 0) issue(product.firstLine, error.message);
      for (const [field, message] of fields) {
        const variantKey = field.startsWith("variants.") ? [...product.lines.keys()].find((k) => field.startsWith(`variants.${k}.`)) : undefined;
        // Variant errors are keyed "variants.<combinationKey>.<field>"; report them against that variant's line.
        const label = variantKey ? (field.split(".").at(-1) ?? field) : field;
        issue(variantKey ? product.lines.get(variantKey)! : product.firstLine, `${label}: ${message}`);
      }
    }
  }

  report.products = planned.length;
  report.variants = planned.reduce((n, p) => n + p.input.variants!.length, 0);
  report.creates = planned.filter((p) => !p.existingId).length;
  report.updates = planned.length - report.creates;
  report.issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  if (!options.apply || report.issues.length) return report;

  for (const product of planned) {
    try {
      const saved = product.existingId ? await updateProduct(actor, product.existingId, product.input) : await createProduct(actor, product.input);
      if (product.status === "published") await publishProduct(actor, saved.id);
      if (product.status === "draft" && existingBySlug.get(product.slug)?.status === "ACTIVE") await unpublishProduct(actor, saved.id);
    } catch (error) {
      // Validation passed moments ago; a concurrent edit can still conflict. Report and stop.
      if (error instanceof DomainError) {
        issue(product.firstLine, `Not imported: ${error.message} Products before this line were saved.`);
        return { ...report, applied: true };
      }
      throw error;
    }
  }
  await db.$transaction((tx) =>
    recordAudit(tx, actor, { action: "catalog.imported", entityType: "Product", after: { products: report.products, variants: report.variants, creates: report.creates, updates: report.updates } }),
  );
  return { ...report, applied: true };
}
