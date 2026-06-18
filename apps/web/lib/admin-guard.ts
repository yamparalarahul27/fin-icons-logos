import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSecret, isValidToken } from "./admin-auth";

/**
 * Defense-in-depth admin check for route handlers (SECURITY-PLAN.md §1). The
 * middleware already gates `/api/admin/*`, but a write endpoint must never rely
 * on the gate alone. Returns a 401 response to short-circuit, or null if allowed.
 *
 * Mirrors the middleware's fail-closed policy: an unset secret allows access only
 * in development.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (await isValidToken(token)) return null;
  if (!adminSecret() && process.env.NODE_ENV !== "production") return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
