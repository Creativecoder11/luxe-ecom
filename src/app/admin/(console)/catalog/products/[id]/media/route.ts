import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { isSameOrigin } from "@/lib/security/same-origin";
import { addProductImages, MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES } from "@/modules/catalog/media.service";
import { CATALOG_TAG } from "@/modules/catalog/storefront";
import { getStaffActor } from "@/modules/identity/session";

const MAX_REQUEST_BYTES = MAX_FILES_PER_UPLOAD * MAX_IMAGE_BYTES + 64 * 1024;

/** Image upload for a product (multipart, field "files"). Route handler so images can exceed the 1 MB server-action limit. */
export async function POST(request: Request, { params }: RouteContext<"/admin/catalog/products/[id]/media">) {
  await connection();
  if (!isSameOrigin(request, env().APP_URL)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const actor = await getStaffActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!declared || declared > MAX_REQUEST_BYTES) return Response.json({ error: "Upload is too large (5 MB per image, 5 images at a time)." }, { status: 413 });

  const { id } = await params;
  try {
    const form = await request.formData();
    const files = await Promise.all(
      form
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .map(async (f) => ({ name: f.name.slice(0, 120), bytes: new Uint8Array(await f.arrayBuffer()) })),
    );
    const count = await addProductImages(actor, id, files);
    revalidateTag(CATALOG_TAG, { expire: 0 });
    return Response.json({ uploaded: count });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 422;
      return Response.json({ error: error.message }, { status });
    }
    logger.error({ err: error }, "image upload failed");
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
