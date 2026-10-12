import { connection } from "next/server";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { isSameOrigin } from "@/lib/security/same-origin";
import { MAX_CONTENT_IMAGE_BYTES, uploadContentImage } from "@/modules/content/content.service";
import { getStaffActor } from "@/modules/identity/session";

const MAX_REQUEST_BYTES = MAX_CONTENT_IMAGE_BYTES + 64 * 1024;

/** One banner image (multipart, field "file"). Route handler so images can exceed the 1 MB server-action limit. */
export async function POST(request: Request) {
  await connection();
  if (!isSameOrigin(request, env().APP_URL)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const actor = await getStaffActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!declared || declared > MAX_REQUEST_BYTES) return Response.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose an image." }, { status: 422 });
    const result = await uploadContentImage(actor, { name: file.name.slice(0, 120), bytes: new Uint8Array(await file.arrayBuffer()) });
    return Response.json(result);
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 422 });
    logger.error({ err: error }, "content image upload failed");
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
