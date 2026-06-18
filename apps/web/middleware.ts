import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSecret, isValidToken } from "@/lib/admin-auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * Single middleware pass (SECURITY-PLAN.md §1 + §3):
 *  1. Rate-limit API routes (never images or the gallery).
 *  2. Gate the admin surface behind the shared-secret cookie.
 *
 * Fail-closed admin: with ADMIN_SECRET set only a valid cookie passes; unset
 * denies in production but allows in dev so local work isn't blocked.
 */
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Rate limiting — API paths only. Returns null for unlimited paths.
  let rate = null;
  if (pathname.startsWith("/api/")) {
    rate = await checkRateLimit(req, pathname);
    if (rate && !rate.success) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
  }

  // 2) Admin gate — admin page + admin APIs, except the login page/endpoint.
  const isAdminPath =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const isLogin = pathname === "/admin/login" || pathname === "/api/admin/login";

  if (isAdminPath && !isLogin) {
    const authed = await isValidToken(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!authed) {
      const devOpen = !adminSecret() && process.env.NODE_ENV !== "production";
      if (!devOpen) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const url = req.nextUrl.clone();
        url.pathname = "/admin/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  // 3) Allow, surfacing rate-limit headers so good clients can self-throttle.
  const res = NextResponse.next();
  if (rate) {
    for (const [k, v] of Object.entries(rateLimitHeaders(rate))) res.headers.set(k, v);
  }
  return res;
}
