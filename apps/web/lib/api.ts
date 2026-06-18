/**
 * Public JSON API helpers (PLAN.md §5b, BACKLOG.md B2).
 *
 * Serves the same manifest the explorer reads, as a CORS-open, paginated API for
 * programmatic consumers. Logo URLs are the override-wins (resolved) CDN paths.
 */
import { resolveLogo, type Asset } from "@fin/shared";
import { loadQueue } from "./manifest";

export interface PublicAsset {
  id: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number | null;
  rank: number | null;
  verified: boolean;
  source: string;
  firstSeenAt: string;
  updatedAt: string;
  logo: {
    svg: string | null;
    png256: string;
    png128: string;
    png64: string;
    png32: string;
  } | null;
}

function toPublicAsset(asset: Asset): PublicAsset {
  const logo = resolveLogo(asset);
  return {
    id: asset.id,
    chain: asset.chain,
    address: asset.address,
    symbol: asset.symbol,
    name: asset.name,
    decimals: asset.decimals,
    rank: asset.rank,
    verified: asset.verified,
    source: asset.source,
    firstSeenAt: asset.firstSeenAt,
    updatedAt: asset.updatedAt,
    logo: logo
      ? {
          svg: logo.svg,
          png256: logo.png256,
          png128: logo.png128,
          png64: logo.png64,
          png32: logo.png32,
        }
      : null,
  };
}

/** All assets that resolve to a logo, sorted by market-cap rank (nulls last), then symbol. */
export async function loadPublicAssets(): Promise<PublicAsset[]> {
  const { assets } = await loadQueue();
  return assets
    .filter((a) => resolveLogo(a))
    .map(toPublicAsset)
    .sort((a, b) => {
      const ra = a.rank ?? Infinity;
      const rb = b.rank ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.symbol.localeCompare(b.symbol);
    });
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

/** JSON response with CORS + a short cache hint (best-effort; see route notes). */
export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

/** Preflight handler shared by every /api/v1 route. */
export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Parse a bounded positive integer query param. */
export function intParam(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
}
