/**
 * Returns a same-origin relative path for post-login redirects, or the fallback.
 * Rejects absolute URLs, protocol-relative ("//evil"), backslash tricks and the admin area.
 */
export function safeRedirectPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value.startsWith("/admin")) return fallback;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
