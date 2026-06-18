import { apiJson, apiOptions, intParam, loadPublicAssets } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/**
 * GET /api/v1/recent — newest assets by first-seen.
 *
 * NOTE: until first-seen is tracked across ingest runs (BACKLOG.md B6), every
 * asset shares the latest ingest timestamp, so this effectively falls back to
 * rank order. The endpoint contract is stable; its data sharpens once a
 * launch-date / persistent first-seen source lands.
 */
export async function GET(req: Request) {
  const limit = intParam(new URL(req.url).searchParams.get("limit"), 50, 250);
  const assets = (await loadPublicAssets())
    .slice()
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
    .slice(0, limit);
  return apiJson({ count: assets.length, assets });
}
