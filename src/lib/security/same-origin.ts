/**
 * CSRF defence for cookie-authenticated route handlers (server actions get Next.js's own origin check).
 * Accepts the request only when its Origin header matches the app's origin or the request host.
 */
export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(appUrl).origin]);
    const host = request.headers.get("host");
    if (host) allowed.add(`${new URL(request.url).protocol}//${host}`);
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
