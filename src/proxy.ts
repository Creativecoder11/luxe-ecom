import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isKnownShellPath, PUBLIC_ADMIN_PATHS } from "@/config/modules";

/**
 * Runs before rendering:
 *  1. Unknown or unreleased /admin and /account paths get a real HTTP 404 (D-020).
 *  2. Requests without a session cookie are redirected to the right sign-in page.
 * This is an optimistic check only; every page and service re-validates the session
 * and permissions server-side.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isKnownShellPath(pathname)) {
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: "ucp" }));
  if (!hasSession) {
    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    if (isAdmin && !PUBLIC_ADMIN_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (pathname === "/account" || pathname.startsWith("/account/")) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
