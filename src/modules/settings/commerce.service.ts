import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isDistrictCode } from "@/lib/bd-geo";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseMajorToMinor } from "@/lib/money";
import { recordAudit } from "@/modules/audit/service";
import type { ZoneRule } from "@/modules/checkout/pricing";
import { assertCan, type StaffActor } from "@/modules/identity/actor";

type Reader = Pick<PrismaClient, "businessSettings" | "shippingZone">;

export interface CommerceSettings {
  pricesIncludeTax: boolean;
  vatRegistrationNumber: string | null;
  codEnabled: boolean;
  codMaxOrderMinor: number | null;
  guestCheckoutEnabled: boolean;
  lowStockThreshold: number;
}

export async function getCommerceSettings(client: Reader, businessId: string): Promise<CommerceSettings> {
  const s = await client.businessSettings.findUniqueOrThrow({ where: { businessId } });
  return {
    pricesIncludeTax: s.pricesIncludeTax,
    vatRegistrationNumber: s.vatRegistrationNumber,
    codEnabled: s.codEnabled,
    codMaxOrderMinor: s.codMaxOrderMinor,
    guestCheckoutEnabled: s.guestCheckoutEnabled,
    lowStockThreshold: s.lowStockThreshold,
  };
}

const money = (label: string, { optional }: { optional: boolean }) =>
  z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v, ctx) => {
      if (!v) {
        if (optional) return null;
        ctx.addIssue({ code: "custom", message: `Enter ${label}` });
        return z.NEVER;
      }
      const minor = parseMajorToMinor(v);
      if (minor === null || minor < 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 60 or 60.50" });
        return z.NEVER;
      }
      return minor;
    });

export const commerceSettingsSchema = z.object({
  pricesIncludeTax: z.boolean(),
  vatRegistrationNumber: z.string().trim().max(30).optional().default(""),
  codEnabled: z.boolean(),
  codMaxOrder: money("a maximum", { optional: true }),
  guestCheckoutEnabled: z.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
});

export async function updateCommerceSettings(actor: StaffActor, raw: unknown) {
  assertCan(actor, "settings.manage");
  const input = commerceSettingsSchema.parse(raw);
  const before = await getCommerceSettings(db, actor.businessId);
  if (input.codMaxOrder === 0) throw new ValidationError("Maximum COD order must be greater than zero.", { codMaxOrder: "Must be greater than zero" });
  await db.$transaction(async (tx) => {
    await tx.businessSettings.update({
      where: { businessId: actor.businessId },
      data: {
        pricesIncludeTax: input.pricesIncludeTax,
        vatRegistrationNumber: input.vatRegistrationNumber || null,
        codEnabled: input.codEnabled,
        codMaxOrderMinor: input.codMaxOrder,
        guestCheckoutEnabled: input.guestCheckoutEnabled,
        lowStockThreshold: input.lowStockThreshold,
      },
    });
    await recordAudit(tx, actor, { action: "settings.commerce_updated", entityType: "BusinessSettings", entityId: actor.businessId, before, after: input });
  });
}

// ---------- Tax classes ----------

export const taxClassSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,29}$/, "Use lowercase letters, digits, dashes or underscores"),
  ratePercent: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(v);
      const bp = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : NaN;
      if (!Number.isInteger(bp) || bp > 10_000) {
        ctx.addIssue({ code: "custom", message: "Enter a rate between 0 and 100, e.g. 15 or 7.5" });
        return z.NEVER;
      }
      return bp;
    }),
  isDefault: z.boolean().default(false),
});

export async function listTaxClasses(actor: StaffActor) {
  assertCan(actor, "settings.view");
  return db.taxClass.findMany({ where: { businessId: actor.businessId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
}

export async function saveTaxClass(actor: StaffActor, id: string | null, raw: unknown) {
  assertCan(actor, "settings.manage");
  const input = taxClassSchema.parse(raw);
  const clash = await db.taxClass.findFirst({ where: { businessId: actor.businessId, code: input.code, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw new ValidationError("This code is already used.", { code: "Already used" });
  const existing = id ? await db.taxClass.findFirst({ where: { id, businessId: actor.businessId } }) : null;
  if (id && !existing) throw new NotFoundError("Tax class");
  if (existing?.isDefault && !input.isDefault) throw new ValidationError("Choose another default tax class instead of unsetting this one.", { isDefault: "One tax class must be the default" });

  await db.$transaction(async (tx) => {
    if (input.isDefault) await tx.taxClass.updateMany({ where: { businessId: actor.businessId, isDefault: true }, data: { isDefault: false } });
    const data = { name: input.name, code: input.code, rateBasisPoints: input.ratePercent, isDefault: input.isDefault };
    const saved = existing
      ? await tx.taxClass.update({ where: { id: existing.id }, data })
      : await tx.taxClass.create({ data: { ...data, businessId: actor.businessId } });
    await recordAudit(tx, actor, {
      action: existing ? "tax_class.updated" : "tax_class.created",
      entityType: "TaxClass",
      entityId: saved.id,
      before: existing ? { rateBasisPoints: existing.rateBasisPoints, isDefault: existing.isDefault } : undefined,
      after: data,
    });
  });
}

// ---------- Delivery zones ----------

export const zoneSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a zone name").max(60),
    isFallback: z.boolean().default(false),
    districts: z.array(z.string()).default([]),
    baseFee: money("a delivery fee", { optional: false }),
    includedWeightGrams: z.coerce.number().int().min(0).max(1_000_000).default(1000),
    extraPerKg: money("an extra fee", { optional: true }),
    freeShippingThreshold: money("a threshold", { optional: true }),
    codEnabled: z.boolean().default(true),
    codFee: money("a COD fee", { optional: true }),
    estimate: z.string().trim().max(40).optional().default(""),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .superRefine((v, ctx) => {
    if (!v.isFallback && v.districts.length === 0) ctx.addIssue({ code: "custom", path: ["districts"], message: "Choose at least one district (or make this the rest-of-Bangladesh zone)" });
    const bad = v.districts.filter((d) => !isDistrictCode(d));
    if (bad.length) ctx.addIssue({ code: "custom", path: ["districts"], message: `Unknown districts: ${bad.join(", ")}` });
  });

export async function listShippingZones(actor: StaffActor) {
  assertCan(actor, "settings.view");
  return db.shippingZone.findMany({ where: { businessId: actor.businessId }, orderBy: [{ isFallback: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function saveShippingZone(actor: StaffActor, id: string | null, raw: unknown) {
  assertCan(actor, "settings.manage");
  const input = zoneSchema.parse(raw);
  const existing = id ? await db.shippingZone.findFirst({ where: { id, businessId: actor.businessId } }) : null;
  if (id && !existing) throw new NotFoundError("Delivery zone");
  const districts = input.isFallback ? [] : [...new Set(input.districts)];

  if (input.isActive) {
    const others = await db.shippingZone.findMany({ where: { businessId: actor.businessId, isActive: true, ...(id ? { id: { not: id } } : {}) } });
    if (input.isFallback && others.some((z) => z.isFallback)) {
      throw new ConflictError("Another active zone already covers the rest of Bangladesh.");
    }
    const overlap = others.flatMap((z) => z.districts.filter((d) => districts.includes(d)).map((d) => `${d} (${z.name})`));
    if (overlap.length) throw new ValidationError(`These districts already belong to another zone: ${overlap.join(", ")}.`, { districts: "Districts overlap another zone" });
  }

  const data = {
    name: input.name,
    isFallback: input.isFallback,
    districts,
    baseFeeMinor: input.baseFee!,
    includedWeightGrams: input.includedWeightGrams,
    extraPerKgMinor: input.extraPerKg ?? 0,
    freeShippingThresholdMinor: input.freeShippingThreshold,
    codEnabled: input.codEnabled,
    codFeeMinor: input.codFee ?? 0,
    estimate: input.estimate || null,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
  await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.shippingZone.update({ where: { id: existing.id }, data })
      : await tx.shippingZone.create({ data: { ...data, businessId: actor.businessId } });
    await recordAudit(tx, actor, {
      action: existing ? "shipping_zone.updated" : "shipping_zone.created",
      entityType: "ShippingZone",
      entityId: saved.id,
      before: existing ?? undefined,
      after: data,
    });
  });
}

export async function deleteShippingZone(actor: StaffActor, id: string) {
  assertCan(actor, "settings.manage");
  const zone = await db.shippingZone.findFirst({ where: { id, businessId: actor.businessId } });
  if (!zone) throw new NotFoundError("Delivery zone");
  await db.$transaction(async (tx) => {
    await tx.shippingZone.delete({ where: { id } });
    await recordAudit(tx, actor, { action: "shipping_zone.deleted", entityType: "ShippingZone", entityId: id, before: zone });
  });
}

export interface ResolvedZone extends ZoneRule {
  id: string;
  name: string;
  estimate: string | null;
}

/** The active zone covering a district (explicit zones first, then the fallback), or null if undeliverable. */
export async function resolveZone(client: Reader, businessId: string, districtCode: string): Promise<ResolvedZone | null> {
  if (!isDistrictCode(districtCode)) return null;
  const zones = await client.shippingZone.findMany({ where: { businessId, isActive: true }, orderBy: { sortOrder: "asc" } });
  const zone = zones.find((z) => !z.isFallback && z.districts.includes(districtCode)) ?? zones.find((z) => z.isFallback);
  if (!zone) return null;
  return {
    id: zone.id,
    name: zone.name,
    estimate: zone.estimate,
    baseFeeMinor: zone.baseFeeMinor,
    includedWeightGrams: zone.includedWeightGrams,
    extraPerKgMinor: zone.extraPerKgMinor,
    freeShippingThresholdMinor: zone.freeShippingThresholdMinor,
    codEnabled: zone.codEnabled,
    codFeeMinor: zone.codFeeMinor,
  };
}
