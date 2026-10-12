import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isValidSlug, slugify } from "@/lib/slug";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import type { AttributeDefinitionLike, AttributeType, AttributeValidationRules } from "./attributes";

type Client = Pick<PrismaClient, "category" | "categoryAttribute">;

export type CatalogClient = Client;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(80),
  slug: z.string().trim().toLowerCase().optional().default(""),
  parentId: z.string().optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["ACTIVE", "HIDDEN"]).default("ACTIVE"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  defaultTrackingMode: z.enum(["NONE", "BATCH_EXPIRY", "SERIAL"]).default("NONE"),
  seoTitle: z.string().trim().max(70).optional().default(""),
  seoDescription: z.string().trim().max(160).optional().default(""),
  /** Template: attribute ids with a required flag, in display order. */
  attributes: z.array(z.object({ attributeId: z.string(), isRequired: z.boolean().default(false) })).default([]),
});

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "HIDDEN";
  parentId: string | null;
  depth: number;
  productCount: number;
}

/** Flattened depth-first tree, ordered by sortOrder then name. */
export async function listCategoryTree(actor: StaffActor): Promise<CategoryNode[]> {
  assertCan(actor, "catalog.view");
  const rows = await db.category.findMany({
    where: { businessId: actor.businessId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, status: true, parentId: true, _count: { select: { primaryProducts: true } } },
  });
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
  const out: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const row of byParent.get(parentId) ?? []) {
      out.push({ id: row.id, name: row.name, slug: row.slug, status: row.status, parentId: row.parentId, depth, productCount: row._count.primaryProducts });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export async function getCategory(actor: StaffActor, id: string) {
  assertCan(actor, "catalog.view");
  const category = await db.category.findFirst({
    where: { id, businessId: actor.businessId },
    include: { attributes: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) throw new NotFoundError("Category");
  return category;
}

/** Ancestor chain from the root down to (and including) the category. */
export async function categoryLineage(client: Client, categoryId: string): Promise<{ id: string; name: string; slug: string }[]> {
  const chain: { id: string; name: string; slug: string }[] = [];
  let current: string | null = categoryId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row: { id: string; name: string; slug: string; parentId: string | null } | null = await client.category.findUnique({
      where: { id: current },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    if (!row) break;
    chain.unshift({ id: row.id, name: row.name, slug: row.slug });
    current = row.parentId;
  }
  return chain;
}

/**
 * Effective attribute template for a category: its own template plus every ancestor's.
 * An attribute required anywhere in the lineage is required.
 */
export async function resolveCategoryAttributes(client: Client, categoryId: string): Promise<AttributeDefinitionLike[]> {
  const lineage = await categoryLineage(client, categoryId);
  const links = await client.categoryAttribute.findMany({
    where: { categoryId: { in: lineage.map((c) => c.id) }, attribute: { archivedAt: null } },
    orderBy: { sortOrder: "asc" },
    include: { attribute: { include: { options: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } } },
  });
  const depth = new Map(lineage.map((c, i) => [c.id, i]));
  links.sort((a, b) => (depth.get(a.categoryId) ?? 0) - (depth.get(b.categoryId) ?? 0) || a.sortOrder - b.sortOrder);

  const byId = new Map<string, AttributeDefinitionLike>();
  for (const link of links) {
    const a = link.attribute;
    const existing = byId.get(a.id);
    if (existing) {
      existing.required ||= link.isRequired;
      continue;
    }
    byId.set(a.id, {
      id: a.id,
      code: a.code,
      label: a.label,
      type: a.type as AttributeType,
      unit: a.unit,
      required: link.isRequired,
      isVariantAxis: a.isVariantAxis,
      validation: (a.validation as AttributeValidationRules | null) ?? null,
      options: a.options.map((o) => ({ id: o.id, value: o.value, label: o.label })),
    });
  }
  return [...byId.values()];
}

/** Rejects moving a category under itself or one of its descendants. */
async function assertNoCycle(businessId: string, categoryId: string, newParentId: string | null) {
  let current = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === categoryId) throw new ValidationError("A category cannot be placed inside itself or its subcategories.", { parentId: "Choose a different parent" });
    if (seen.has(current)) break;
    seen.add(current);
    const parent: { parentId: string | null } | null = await db.category.findFirst({ where: { id: current, businessId }, select: { parentId: true } });
    current = parent?.parentId ?? null;
  }
}

async function validateTemplate(businessId: string, attributes: { attributeId: string }[]) {
  if (attributes.length === 0) return;
  const ids = [...new Set(attributes.map((a) => a.attributeId))];
  if (ids.length !== attributes.length) throw new ValidationError("Each attribute can appear once in a template.");
  const found = await db.attributeDefinition.count({ where: { id: { in: ids }, businessId, archivedAt: null } });
  if (found !== ids.length) throw new ValidationError("The template contains an unknown or archived attribute.");
}

function resolveSlug(input: { slug: string; name: string }) {
  const slug = input.slug || slugify(input.name);
  if (!isValidSlug(slug)) {
    throw new ValidationError("Enter a URL slug using lowercase letters, numbers and hyphens.", { slug: "Use lowercase letters, numbers and hyphens" });
  }
  return slug;
}

export async function createCategory(actor: StaffActor, raw: unknown) {
  assertCan(actor, "catalog.create");
  const input = categoryInputSchema.parse(raw);
  const slug = resolveSlug(input);
  const parentId = input.parentId || null;
  if (parentId && !(await db.category.findFirst({ where: { id: parentId, businessId: actor.businessId } }))) {
    throw new ValidationError("Choose a valid parent category.", { parentId: "Choose a valid parent" });
  }
  await validateTemplate(actor.businessId, input.attributes);
  if (await db.category.findUnique({ where: { businessId_slug: { businessId: actor.businessId, slug } } })) {
    throw new ValidationError("This URL slug is already used.", { slug: "Already used by another category" });
  }

  return db.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        businessId: actor.businessId,
        parentId,
        slug,
        name: input.name,
        description: input.description || null,
        status: input.status,
        sortOrder: input.sortOrder,
        defaultTrackingMode: input.defaultTrackingMode,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        attributes: { create: input.attributes.map((a, i) => ({ attributeId: a.attributeId, isRequired: a.isRequired, sortOrder: i })) },
      },
    });
    await recordAudit(tx, actor, { action: "category.created", entityType: "Category", entityId: category.id, after: { name: input.name, slug, parentId } });
    return category;
  });
}

export async function updateCategory(actor: StaffActor, id: string, raw: unknown) {
  assertCan(actor, "catalog.update");
  const existing = await getCategory(actor, id);
  const input = categoryInputSchema.parse(raw);
  const slug = resolveSlug(input);
  const parentId = input.parentId || null;
  await assertNoCycle(actor.businessId, id, parentId);
  await validateTemplate(actor.businessId, input.attributes);
  if (slug !== existing.slug && (await db.category.findUnique({ where: { businessId_slug: { businessId: actor.businessId, slug } } }))) {
    throw new ValidationError("This URL slug is already used.", { slug: "Already used by another category" });
  }

  await db.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: {
        parentId,
        slug,
        name: input.name,
        description: input.description || null,
        status: input.status,
        sortOrder: input.sortOrder,
        defaultTrackingMode: input.defaultTrackingMode,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      },
    });
    await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
    if (input.attributes.length) {
      await tx.categoryAttribute.createMany({
        data: input.attributes.map((a, i) => ({ categoryId: id, attributeId: a.attributeId, isRequired: a.isRequired, sortOrder: i })),
      });
    }
    await recordAudit(tx, actor, {
      action: "category.updated",
      entityType: "Category",
      entityId: id,
      before: { name: existing.name, slug: existing.slug, parentId: existing.parentId, status: existing.status, template: existing.attributes.map((a) => a.attributeId) },
      after: { name: input.name, slug, parentId, status: input.status, template: input.attributes.map((a) => a.attributeId) },
    });
  });
}

/** Categories with products or subcategories cannot be deleted (hide them instead). */
export async function deleteCategory(actor: StaffActor, id: string) {
  assertCan(actor, "catalog.delete");
  const category = await getCategory(actor, id);
  const [children, primary, secondary] = await Promise.all([
    db.category.count({ where: { parentId: id } }),
    db.product.count({ where: { primaryCategoryId: id } }),
    db.productCategory.count({ where: { categoryId: id } }),
  ]);
  if (children > 0) throw new ConflictError("Move or delete its subcategories first.");
  if (primary + secondary > 0) throw new ConflictError("Products use this category. Hide it instead, or move the products first.");
  await db.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await recordAudit(tx, actor, { action: "category.deleted", entityType: "Category", entityId: id, before: { name: category.name, slug: category.slug } });
  });
}

/**
 * Effective templates for every category at once (two queries, resolved in memory) with the
 * same semantics as resolveCategoryAttributes. Used by the product editor.
 */
export async function resolveAllCategoryTemplates(client: PrismaClient, businessId: string): Promise<Map<string, AttributeDefinitionLike[]>> {
  const [categories, links] = await Promise.all([
    client.category.findMany({ where: { businessId }, select: { id: true, parentId: true } }),
    client.categoryAttribute.findMany({
      where: { category: { businessId }, attribute: { archivedAt: null } },
      orderBy: { sortOrder: "asc" },
      include: { attribute: { include: { options: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } } },
    }),
  ]);
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const linksByCategory = new Map<string, typeof links>();
  for (const link of links) linksByCategory.set(link.categoryId, [...(linksByCategory.get(link.categoryId) ?? []), link]);

  const out = new Map<string, AttributeDefinitionLike[]>();
  for (const category of categories) {
    const lineage: string[] = [];
    const seen = new Set<string>();
    for (let id: string | null = category.id; id && !seen.has(id); id = parentOf.get(id) ?? null) {
      seen.add(id);
      lineage.unshift(id);
    }
    const byId = new Map<string, AttributeDefinitionLike>();
    for (const categoryId of lineage) {
      for (const link of linksByCategory.get(categoryId) ?? []) {
        const a = link.attribute;
        const existing = byId.get(a.id);
        if (existing) {
          existing.required ||= link.isRequired;
          continue;
        }
        byId.set(a.id, {
          id: a.id,
          code: a.code,
          label: a.label,
          type: a.type as AttributeType,
          unit: a.unit,
          required: link.isRequired,
          isVariantAxis: a.isVariantAxis,
          validation: (a.validation as AttributeValidationRules | null) ?? null,
          options: a.options.map((o) => ({ id: o.id, value: o.value, label: o.label })),
        });
      }
    }
    out.set(category.id, [...byId.values()]);
  }
  return out;
}
