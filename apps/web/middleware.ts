import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSecret, isValidToken } from "@/lib/admin-auth";

/**
 * Gate the admin surface (SECURITY-PLAN.md §1). Protects the page and the write
 * APIs; the login page + login endpoint are exempt since they ARE the gate.
 *
 * Fail-closed: when ADMIN_SECRET is set, only a valid session cookie passes. When
 * it is NOT set, access is allowed only in development so local work isn't blocked
 * — in production an unset secret denies everything rather than reopening the hole.
 */
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (await isValidToken(token)) return NextResponse.next();

  // Unauthenticated past this point.
  if (!adminSecret() && process.env.NODE_ENV !== "production") {
    return NextResponse.next(); // dev convenience only
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
