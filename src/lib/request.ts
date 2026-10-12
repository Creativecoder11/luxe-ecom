import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string;
  userAgent: string | null;
}

/**
 * Client IP for rate limiting and audit. Uses the first X-Forwarded-For hop, which is only
 * trustworthy behind a proxy that overwrites the header (documented deployment requirement).
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent"),
  };
}
