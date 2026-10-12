import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { readImageMeta } from "@/lib/image-meta";
import { logger } from "@/lib/logging/logger";
import { getStorage } from "@/lib/storage";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_FILES_PER_UPLOAD = 5;

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

async function ownedProduct(actor: StaffActor, productId: string) {
  const product = await db.product.findFirst({ where: { id: productId, businessId: actor.businessId }, select: { id: true, title: true, status: true } });
  if (!product) throw new NotFoundError("Product");
  if (product.status === "ARCHIVED") throw new ConflictError("Restore this product before changing its images.");
  return product;
}

/** Validates by content, stores under a random key, then records the media rows (cleaning up files on failure). */
export async function addProductImages(actor: StaffActor, productId: string, files: UploadedFile[]) {
  assertCan(actor, "catalog.update");
  const product = await ownedProduct(actor, productId);
  if (files.length === 0) throw new ValidationError("Choose at least one image.");
  if (files.length > MAX_FILES_PER_UPLOAD) throw new ValidationError(`Upload at most ${MAX_FILES_PER_UPLOAD} images at a time.`);
  const existing = await db.productMedia.count({ where: { productId } });
  if (existing + files.length > MAX_IMAGES_PER_PRODUCT) throw new ValidationError(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`);

  const prepared = files.map((file) => {
    if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new ValidationError(`“${file.name}” is larger than 5 MB.`);
    const meta = readImageMeta(file.bytes);
    if (!meta) throw new ValidationError(`“${file.name}” is not a JPEG, PNG or WebP image (or its dimensions are invalid).`);
    const key = `products/${productId.slice(-2).toLowerCase()}/${randomBytes(18).toString("base64url")}.${meta.extension}`;
    return { file, meta, key };
  });

  const storage = getStorage();
  const stored: string[] = [];
  try {
    for (const p of prepared) {
      await storage.put(p.key, p.file.bytes, p.meta.mimeType);
      stored.push(p.key);
    }
    await db.$transaction(async (tx) => {
      await tx.productMedia.createMany({
        data: prepared.map((p, i) => ({
          productId,
          storageKey: p.key,
          mimeType: p.meta.mimeType,
          sizeBytes: p.file.bytes.byteLength,
          width: p.meta.width,
          height: p.meta.height,
          alt: product.title,
          sortOrder: existing + i,
        })),
      });
      await recordAudit(tx, actor, {
        action: "product.media_added",
        entityType: "Product",
        entityId: productId,
        after: { files: prepared.map((p) => ({ key: p.key, bytes: p.file.bytes.byteLength, width: p.meta.width, height: p.meta.height })) },
      });
    });
  } catch (error) {
    await Promise.all(stored.map((key) => storage.delete(key).catch((e: unknown) => logger.error({ err: e, key }, "orphaned media cleanup failed"))));
    throw error;
  }
  return prepared.length;
}

async function ownedMedia(actor: StaffActor, mediaId: string) {
  const media = await db.productMedia.findFirst({ where: { id: mediaId, product: { businessId: actor.businessId } } });
  if (!media) throw new NotFoundError("Image");
  return media;
}

export async function updateMediaAlt(actor: StaffActor, mediaId: string, alt: string) {
  assertCan(actor, "catalog.update");
  const media = await ownedMedia(actor, mediaId);
  const text = alt.trim().slice(0, 200);
  await db.$transaction(async (tx) => {
    await tx.productMedia.update({ where: { id: mediaId }, data: { alt: text || null } });
    await recordAudit(tx, actor, { action: "product.media_updated", entityType: "Product", entityId: media.productId, before: { alt: media.alt }, after: { alt: text } });
  });
}

export async function moveMedia(actor: StaffActor, mediaId: string, direction: "up" | "down") {
  assertCan(actor, "catalog.update");
  const media = await ownedMedia(actor, mediaId);
  const all = await db.productMedia.findMany({ where: { productId: media.productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const index = all.findIndex((m) => m.id === mediaId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= all.length) return;
  [all[index], all[target]] = [all[target]!, all[index]!];
  await db.$transaction(all.map((m, i) => db.productMedia.update({ where: { id: m.id }, data: { sortOrder: i } })));
}

export async function deleteMedia(actor: StaffActor, mediaId: string) {
  assertCan(actor, "catalog.update");
  const media = await ownedMedia(actor, mediaId);
  await db.$transaction(async (tx) => {
    await tx.productMedia.delete({ where: { id: mediaId } });
    await recordAudit(tx, actor, { action: "product.media_deleted", entityType: "Product", entityId: media.productId, before: { key: media.storageKey } });
  });
  // The row is gone, so the file is unreachable; a failed delete only leaves an orphan for cleanup.
  await getStorage()
    .delete(media.storageKey)
    .catch((error: unknown) => logger.error({ err: error, key: media.storageKey }, "media file delete failed"));
}

export async function listProductMedia(actor: StaffActor, productId: string) {
  assertCan(actor, "catalog.view");
  return db.productMedia.findMany({
    where: { productId, product: { businessId: actor.businessId } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Public lookup used by the /media route: only keys recorded in the database are ever served. */
/** Product images and homepage content images (both recorded in the database) are public. */
export async function getPublicMedia(storageKey: string) {
  const select = { storageKey: true, mimeType: true } as const;
  if (storageKey.startsWith("content/")) return db.contentMedia.findUnique({ where: { storageKey }, select });
  return db.productMedia.findUnique({ where: { storageKey }, select });
}
