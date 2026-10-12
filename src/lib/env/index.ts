import "server-only";
import { parseServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/** Validated server environment. Parsed once, on first use. */
export function env(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/**
 * Whether unauthenticated /admin and /account shells may render (D-010).
 * Read from process.env directly so the check stays a predictable value during prerendering.
 */
export function shellPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SHELL_PREVIEW === "true";
}
