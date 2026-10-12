/**
 * Attaches the sample photos in prisma/fixtures/images to sample products that have no images
 * yet (development/E2E only). Goes through the real upload service, so files are validated by
 * content, stored under random keys and audited like any staff upload.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../src/lib/db/client";
import { addProductImages } from "../../src/modules/catalog/media.service";
import type { StaffActor } from "../../src/modules/identity/actor";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "images");

/** Product baseSku → photo file. */
const PHOTOS: Record<string, string> = {
  "LIP-VELVET": "LIP-VELVET.jpg",
  "SER-HYDRA-30": "SER-HYDRA-30.jpg",
  "CLN-GENTLE-150": "CLN-GENTLE-150.jpg",
  "KRT-CLASSIC": "KRT-CLASSIC.jpg",
  "TEE-CREW": "TEE-CREW.jpg",
  "AUD-EARBUDS-PRO": "AUD-EARBUDS-PRO.jpg",
  "WRB-BAND": "WRB-BAND.jpg",
  "HOM-MUG-4": "HOM-MUG-4.jpg",
  "HOM-CUSHION": "HOM-CUSHION.jpg",
};

export async function seedSampleProductImages(actor: StaffActor): Promise<number> {
  const products = await db.product.findMany({
    where: { businessId: actor.businessId, baseSku: { in: Object.keys(PHOTOS) }, status: { not: "ARCHIVED" }, media: { none: {} } },
    select: { id: true, baseSku: true },
  });
  for (const product of products) {
    const file = PHOTOS[product.baseSku!]!;
    await addProductImages(actor, product.id, [{ name: file, bytes: new Uint8Array(await readFile(path.join(DIR, file))) }]);
  }
  return products.length;
}
