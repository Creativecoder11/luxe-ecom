import "server-only";
import { randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { zodFieldErrors } from "@/lib/zod-errors";
import { db } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { readImageMeta } from "@/lib/image-meta";
import { logger } from "@/lib/logging/logger";
import { consumeRateLimit, type RateLimitRule } from "@/lib/security/rate-limit";
import { getStorage } from "@/lib/storage";
import { recordAudit } from "@/modules/audit/service";
import { getBusinessId } from "@/modules/business/context";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import { applySection, type FieldReader } from "./form";
import { contentImageKeys, homepageContentSchema, parseHomepageContent, type ContentSection, type HomepageContent } from "./schema";

/** Storefront reads are cached under this tag; content saves expire it. */
export const CONTENT_TAG = "storefront-content";

export const MAX_CONTENT_IMAGE_BYTES = 5 * 1024 * 1024;

/** Published homepage content (cached; defaults when nothing has been saved yet). */
export async function getHomepageContent(): Promise<HomepageContent> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const row = await db.storefrontContent.findUnique({ where: { businessId }, select: { data: true } });
  return parseHomepageContent(row?.data);
}

export async function getHomepageContentForAdmin(actor: StaffActor) {
  assertCan(actor, "content.manage");
  const row = await db.storefrontContent.findUnique({ where: { businessId: actor.businessId }, select: { data: true, updatedAt: true } });
  return { content: parseHomepageContent(row?.data), updatedAt: row?.updatedAt ?? null };
}

/**
 * Saves one section of the homepage document. Image keys must belong to this business's
 * uploads; images no longer referenced anywhere are deleted after the save commits.
 */
export async function updateHomepageSection(actor: StaffActor, section: ContentSection, get: FieldReader): Promise<void> {
  assertCan(actor, "content.manage");
  const removed = await db.$transaction(async (tx) => {
    const row = await tx.storefrontContent.findUnique({ where: { businessId: actor.businessId }, select: { data: true } });
    const before = parseHomepageContent(row?.data);
    const parsed = homepageContentSchema.safeParse(applySection(before, section, get));
    if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error));
    const next = parsed.data;

    const beforeKeys = new Set(contentImageKeys(before));
    const nextKeys = contentImageKeys(next);
    const newKeys = nextKeys.filter((k) => !beforeKeys.has(k));
    if (newKeys.length) {
      const owned = await tx.contentMedia.count({ where: { businessId: actor.businessId, storageKey: { in: newKeys } } });
      if (owned !== new Set(newKeys).size) throw new ValidationError("One of the images is no longer available. Upload it again.");
    }

    if (section === "sale" && next.sale.couponCode) {
      const coupon = await tx.coupon.findFirst({ where: { businessId: actor.businessId, code: next.sale.couponCode }, select: { id: true } });
      if (!coupon) throw new ValidationError("Please correct the highlighted fields.", { "sale.couponCode": "No coupon with this code exists." });
    }

    const data = next as unknown as Prisma.InputJsonValue;
    await tx.storefrontContent.upsert({
      where: { businessId: actor.businessId },
      create: { businessId: actor.businessId, data, updatedById: actor.userId },
      update: { data, updatedById: actor.userId },
    });
    await recordAudit(tx, actor, { action: "content.homepage_updated", entityType: "StorefrontContent", entityId: actor.businessId, after: { section } });

    const stillUsed = new Set(nextKeys);
    const orphaned = [...beforeKeys].filter((k) => !stillUsed.has(k));
    if (orphaned.length) await tx.contentMedia.deleteMany({ where: { businessId: actor.businessId, storageKey: { in: orphaned } } });
    return orphaned;
  });

  const storage = getStorage();
  await Promise.all(removed.map((key) => storage.delete(key).catch((err: unknown) => logger.error({ err, key }, "content image cleanup failed"))));
}

/** Stores an uploaded banner image (validated by content, random key) and returns its key. */
export async function uploadContentImage(actor: StaffActor, file: { name: string; bytes: Uint8Array }): Promise<{ key: string; width: number; height: number }> {
  assertCan(actor, "content.manage");
  if (file.bytes.byteLength === 0) throw new ValidationError("Choose an image.");
  if (file.bytes.byteLength > MAX_CONTENT_IMAGE_BYTES) throw new ValidationError(`“${file.name}” is larger than 5 MB.`);
  const meta = readImageMeta(file.bytes);
  if (!meta) throw new ValidationError(`“${file.name}” is not a JPEG, PNG or WebP image (or its dimensions are invalid).`);
  const key = `content/${randomBytes(1).toString("hex")}/${randomBytes(18).toString("base64url")}.${meta.extension}`;
  const storage = getStorage();
  await storage.put(key, file.bytes, meta.mimeType);
  try {
    await db.contentMedia.create({
      data: {
        businessId: actor.businessId,
        storageKey: key,
        mimeType: meta.mimeType,
        sizeBytes: file.bytes.byteLength,
        width: meta.width,
        height: meta.height,
        uploadedById: actor.userId,
      },
    });
  } catch (error) {
    await storage.delete(key).catch((err: unknown) => logger.error({ err, key }, "content image cleanup failed"));
    throw error;
  }
  return { key, width: meta.width, height: meta.height };
}

const NEWSLETTER_BY_IP: RateLimitRule = { name: "newsletter:ip", limit: 10, windowSeconds: 60 * 60 };

/**
 * Records a footer newsletter sign-up. Nothing is emailed: there is no email provider yet,
 * and the storefront says so instead of promising a confirmation message.
 */
export async function subscribeToNewsletter(email: string, ip: string): Promise<"subscribed" | "already"> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new ValidationError("Enter a valid email address.", { email: "Enter a valid email address." });
  }
  await consumeRateLimit(db, NEWSLETTER_BY_IP, ip);
  const businessId = await getBusinessId();
  const existing = await db.newsletterSubscriber.findUnique({ where: { businessId_email: { businessId, email: normalized } }, select: { unsubscribedAt: true } });
  if (existing && !existing.unsubscribedAt) return "already";
  await db.newsletterSubscriber.upsert({
    where: { businessId_email: { businessId, email: normalized } },
    create: { businessId, email: normalized },
    update: { unsubscribedAt: null },
  });
  return "subscribed";
}

/** Choices for the homepage editor: categories (as "Parent › Child") and active coupons. */
export async function getContentEditorOptions(actor: StaffActor) {
  assertCan(actor, "content.manage");
  const [categories, coupons] = await Promise.all([
    db.category.findMany({ where: { businessId: actor.businessId }, select: { id: true, parentId: true, name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.coupon.findMany({ where: { businessId: actor.businessId, isActive: true }, orderBy: { code: "asc" }, select: { code: true, endsAt: true } }),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path = (c: (typeof categories)[number]): string => {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return parent ? `${path(parent)} › ${c.name}` : c.name;
  };
  return {
    categories: categories.map((c) => ({ slug: c.slug, label: path(c) })).sort((a, b) => a.label.localeCompare(b.label)),
    coupons,
  };
}
