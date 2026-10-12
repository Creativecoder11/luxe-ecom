import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { isValidSlug, slugify } from "@/lib/slug";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a brand name").max(80),
  slug: z.string().trim().toLowerCase().optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["ACTIVE", "HIDDEN"]).default("ACTIVE"),
});

export async function listBrands(actor: StaffActor) {
  assertCan(actor, "catalog.view");
  return db.brand.findMany({
    where: { businessId: actor.businessId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

async function getBrand(actor: StaffActor, id: string) {
  const brand = await db.brand.findFirst({ where: { id, businessId: actor.businessId } });
  if (!brand) throw new NotFoundError("Brand");
  return brand;
}

function resolveSlug(input: { slug: string; name: string }) {
  const slug = input.slug || slugify(input.name);
  if (!isValidSlug(slug)) throw new ValidationError("Enter a URL slug using lowercase letters, numbers and hyphens.", { slug: "Use lowercase letters, numbers and hyphens" });
  return slug;
}

export async function createBrand(actor: StaffActor, raw: unknown) {
  assertCan(actor, "catalog.create");
  const input = brandInputSchema.parse(raw);
  const slug = resolveSlug(input);
  if (await db.brand.findUnique({ where: { businessId_slug: { businessId: actor.businessId, slug } } })) {
    throw new ValidationError("This URL slug is already used.", { slug: "Already used by another brand" });
  }
  return db.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: { businessId: actor.businessId, slug, name: input.name, description: input.description || null, status: input.status },
    });
    await recordAudit(tx, actor, { action: "brand.created", entityType: "Brand", entityId: brand.id, after: { name: input.name, slug } });
    return brand;
  });
}

export async function updateBrand(actor: StaffActor, id: string, raw: unknown) {
  assertCan(actor, "catalog.update");
  const existing = await getBrand(actor, id);
  const input = brandInputSchema.parse(raw);
  const slug = resolveSlug(input);
  if (slug !== existing.slug && (await db.brand.findUnique({ where: { businessId_slug: { businessId: actor.businessId, slug } } }))) {
    throw new ValidationError("This URL slug is already used.", { slug: "Already used by another brand" });
  }
  await db.$transaction(async (tx) => {
    await tx.brand.update({ where: { id }, data: { slug, name: input.name, description: input.description || null, status: input.status } });
    await recordAudit(tx, actor, {
      action: "brand.updated",
      entityType: "Brand",
      entityId: id,
      before: { name: existing.name, slug: existing.slug, status: existing.status },
      after: { name: input.name, slug, status: input.status },
    });
  });
}

export async function deleteBrand(actor: StaffActor, id: string) {
  assertCan(actor, "catalog.delete");
  const brand = await getBrand(actor, id);
  if ((await db.product.count({ where: { brandId: id } })) > 0) throw new ConflictError("Products use this brand. Hide it instead.");
  await db.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id } });
    await recordAudit(tx, actor, { action: "brand.deleted", entityType: "Brand", entityId: id, before: { name: brand.name } });
  });
}
