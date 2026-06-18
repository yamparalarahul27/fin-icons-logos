/**
 * Rate limiting (SECURITY-PLAN.md §3). Protects the API + upload paths; images
 * and the gallery are never limited (they're cache-served and must stay open).
 *
 * Pluggable, matching the storage/override pattern: uses Upstash Redis when its
 * env vars are present (shared, atomic, survives deploys), else an in-memory
 * fixed-window fallback (per-instance, resets on deploy — fine for a first cut,
 * not production scale). Keyed by client IP for now; API-key tiers arrive in §4.
 *
 * Edge-safe: no Node APIs, Upstash loaded lazily only when configured.
 */
import type { NextRequest } from "next/server";

export interface RateResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

interface Tier {
  name: string;
  limit: number;
  windowMs: number;
}

/** Which limit applies to a path, or null to skip (no limit). */
function tierForPath(pathname: string): Tier | null {
  // Tight: the admin secret may be a low-entropy 4-digit PIN, so brute-force
  // resistance leans heavily on this limit (enable Upstash to enforce it shared).
  if (pathname === "/api/admin/login") return { name: "login", limit: 5, windowMs: 60_000 };
  if (pathname === "/api/admin/upload") return { name: "upload", limit: 20, windowMs: 60_000 };
  if (pathname.startsWith("/api/admin/")) return { name: "admin", limit: 60, windowMs: 60_000 };
  // Public JSON API (lands in a later phase) — anonymous IP tier.
  if (pathname.startsWith("/api/v1/")) return { name: "api", limit: 60, windowMs: 60_000 };
  return null;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  // On Vercel the platform sets x-forwarded-for at the edge, so the leftmost is trustworthy.
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// --- in-memory fixed-window fallback ---------------------------------------
const buckets = new Map<string, { count: number; reset: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  // Opportunistic sweep so the map can't grow unbounded on a long-lived instance.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k);
  }
  return {
    success: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.reset,
  };
}

// --- Upstash (lazy, only when configured) ----------------------------------
interface UpstashLimiter {
  limit(id: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
}
let upstashClients: Map<string, UpstashLimiter> | null = null;

async function upstashLimit(tier: Tier, key: string): Promise<RateResult> {
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);
  if (!upstashClients) upstashClients = new Map();
  let limiter = upstashClients.get(tier.name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(tier.limit, `${Math.round(tier.windowMs / 1000)} s`),
      prefix: `rl:${tier.name}`,
    }) as unknown as UpstashLimiter;
    upstashClients.set(tier.name, limiter);
  }
  const r = await limiter.limit(key);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Apply the rate limit for this request, or null if the path isn't limited. */
export async function checkRateLimit(
  req: NextRequest,
  pathname: string,
): Promise<RateResult | null> {
  const tier = tierForPath(pathname);
  if (!tier) return null;
  const key = `${tier.name}:${clientIp(req)}`;
  return upstashConfigured()
    ? upstashLimit(tier, key)
    : memoryLimit(key, tier.limit, tier.windowMs);
}

/** Standard rate-limit response headers; includes Retry-After when blocked. */
export function rateLimitHeaders(r: RateResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset / 1000)),
  };
  if (!r.success) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)));
  }
  return headers;
}
