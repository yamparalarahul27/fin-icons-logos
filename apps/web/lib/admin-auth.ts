/**
 * Stopgap admin authentication (SECURITY-PLAN.md §1).
 *
 * A shared-secret gate that closes the live, unauthenticated admin hole until a
 * real auth provider (Cloudflare Access / Supabase Auth) lands. Pure Web Crypto +
 * `process.env` so it is safe to import from edge middleware AND node routes.
 *
 * The raw secret never touches the cookie: after login we store SHA-256 of the
 * secret and compare hashes in constant time.
 */
export const ADMIN_COOKIE = "fil_admin";

export function adminSecret(): string | undefined {
  return process.env.ADMIN_SECRET || undefined;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time compare. Inputs are fixed-length hex digests, so length never leaks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The cookie value set after a successful login (a hash of the secret, not the secret). */
export function sessionToken(secret: string): Promise<string> {
  return sha256Hex(`fil-admin:${secret}`);
}

/** Does this cookie token match the configured secret? */
export async function isValidToken(token: string | undefined): Promise<boolean> {
  const secret = adminSecret();
  if (!secret || !token) return false;
  return timingSafeEqual(token, await sessionToken(secret));
}

/** Constant-time check of a submitted password against the configured secret. */
export async function isCorrectSecret(submitted: string): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;
  // Hash both sides so the compare is over equal-length digests.
  return timingSafeEqual(await sha256Hex(submitted), await sha256Hex(secret));
}
