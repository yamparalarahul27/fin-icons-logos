import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSecret, isCorrectSecret, sessionToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST { password } — validates the shared secret and sets the admin session cookie. */
export async function POST(req: Request) {
  const secret = adminSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Admin auth is not configured (ADMIN_SECRET unset)." },
      { status: 503 },
    );
  }

  let password = "";
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { password?: unknown };
    password = String(body.password ?? "");
  } else {
    const form = await req.formData().catch(() => null);
    password = form ? String(form.get("password") ?? "") : "";
  }

  if (!(await isCorrectSecret(password))) {
    return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await sessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

/** DELETE — log out by clearing the cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
