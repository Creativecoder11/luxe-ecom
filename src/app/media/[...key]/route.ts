import { connection } from "next/server";
import { getStorage, isValidStorageKey } from "@/lib/storage";
import { getPublicMedia } from "@/modules/catalog/media.service";

/** Serves stored product and content images. Only keys recorded in the database are served, with locked-down headers. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  await connection();
  const key = (await params).key.join("/");
  if (!isValidStorageKey(key)) return new Response("Not found", { status: 404 });
  const media = await getPublicMedia(key);
  if (!media) return new Response("Not found", { status: 404 });
  const bytes = await getStorage().get(media.storageKey);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(bytes.byteLength),
      // Keys are random and never reused, so files can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
