import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { DomainError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseMajorToMinor } from "@/lib/money";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import type { CouponRule } from "./pricing";

type Client = PrismaClient | Prisma.TransactionClient;

export class CouponError extends DomainError {
  constructor(message: string) {
    super(message, "COUPON");
  }
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

type CouponRow = Awaited<ReturnType<typeof db.coupon.findFirst>> & {};

export function couponRule(c: NonNullable<CouponRow>): CouponRule {
  if (c.type === "PERCENT") return { type: "PERCENT", percentBasisPoints: c.percentBasisPoints!, maxDiscountMinor: c.maxDiscountMinor, minSubtotalMinor: c.minSubtotalMinor };
  if (c.type === "FIXED") return { type: "FIXED", amountMinor: c.amountMinor!, minSubtotalMinor: c.minSubtotalMinor };
  return { type: "FREE_SHIPPING", minSubtotalMinor: c.minSubtotalMinor };
}

/** Validates a code for use now (and, when known, for this customer). Throws CouponError with a customer-safe reason. */
export async function findUsableCoupon(client: Client, businessId: string, rawCode: string, customerId?: string | null) {
  const code = normalizeCouponCode(rawCode);
  const coupon = code ? await client.coupon.findUnique({ where: { businessId_code: { businessId, code } } }) : null;
  if (!coupon || !coupon.isActive) throw new CouponError("This coupon code is not valid.");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new CouponError("This coupon is not active yet.");
  if (coupon.endsAt && coupon.endsAt < now) throw new CouponError("This coupon has expired.");
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) throw new CouponError("This coupon has been fully redeemed.");
  if (customerId && coupon.perCustomerLimit !== null) {
    const used = await client.couponRedemption.count({ where: { couponId: coupon.id, customerId } });
    if (used >= coupon.perCustomerLimit) throw new CouponError("You have already used this coupon.");
  }
  return coupon;
}

// ---------- Admin ----------

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (!v) return null;
    const minor = parseMajorToMinor(v);
    if (minor === null || minor <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero" });
      return z.NEVER;
    }
    return minor;
  });
const optionalInt = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number of at least 1" });
      return z.NEVER;
    }
    return n;
  });
const optionalDate = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (!v) return null;
    // Form values have no timezone: interpret them in business time (Asia/Dhaka, UTC+6).
    const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+06:00` : v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  });

export const couponSchema = z
  .object({
    code: z.string().transform(normalizeCouponCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3–30 letters, digits, dashes or underscores")),
    description: z.string().trim().max(200).optional().default(""),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    percent: z.string().trim().optional().default(""),
    amount: optionalMoney,
    maxDiscount: optionalMoney,
    minSubtotal: optionalMoney,
    startsAt: optionalDate,
    endsAt: optionalDate,
    usageLimit: optionalInt,
    perCustomerLimit: optionalInt,
    isActive: z.boolean().default(true),
  })
  .transform((v, ctx) => {
    let percentBasisPoints: number | null = null;
    if (v.type === "PERCENT") {
      const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(v.percent);
      percentBasisPoints = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : NaN;
      if (!Number.isInteger(percentBasisPoints) || percentBasisPoints < 1 || percentBasisPoints > 10_000) {
        ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a percentage between 0.01 and 100" });
      }
    }
    if (v.type === "FIXED" && !v.amount) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the discount amount" });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after the start" });
    return { ...v, percentBasisPoints };
  });

export async function listCoupons(actor: StaffActor) {
  assertCan(actor, "campaigns.manage");
  return db.coupon.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" } });
}

export async function saveCoupon(actor: StaffActor, id: string | null, raw: unknown) {
  assertCan(actor, "campaigns.manage");
  const input = couponSchema.parse(raw);
  const existing = id ? await db.coupon.findFirst({ where: { id, businessId: actor.businessId } }) : null;
  if (id && !existing) throw new NotFoundError("Coupon");
  const clash = await db.coupon.findFirst({ where: { businessId: actor.businessId, code: input.code, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw new ValidationError("This code already exists.", { code: "Already exists" });
  if (existing && input.usageLimit !== null && input.usageLimit < existing.timesUsed) {
    throw new ValidationError(`The coupon was already used ${existing.timesUsed} times.`, { usageLimit: `At least ${existing.timesUsed}` });
  }
  const data = {
    code: input.code,
    description: input.description || null,
    type: input.type,
    percentBasisPoints: input.type === "PERCENT" ? input.percentBasisPoints : null,
    amountMinor: input.type === "FIXED" ? input.amount : null,
    maxDiscountMinor: input.type === "PERCENT" ? input.maxDiscount : null,
    minSubtotalMinor: input.minSubtotal,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: input.usageLimit,
    perCustomerLimit: input.perCustomerLimit,
    isActive: input.isActive,
  };
  await db.$transaction(async (tx) => {
    const saved = existing ? await tx.coupon.update({ where: { id: existing.id }, data }) : await tx.coupon.create({ data: { ...data, businessId: actor.businessId } });
    await recordAudit(tx, actor, { action: existing ? "coupon.updated" : "coupon.created", entityType: "Coupon", entityId: saved.id, before: existing ?? undefined, after: data });
  });
}
