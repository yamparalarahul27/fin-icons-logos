import { apiJson, apiOptions, intParam, loadPublicAssets } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/** GET /api/v1/assets — filter by chain/symbol/verified, paginated. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const chain = sp.get("chain");
  const symbol = sp.get("symbol")?.toLowerCase();
  const verified = sp.get("verified");
  const limit = intParam(sp.get("limit"), 50, 250);
  const offset = intParam(sp.get("offset"), 0, 1_000_000);

  let assets = await loadPublicAssets();
  if (chain) assets = assets.filter((a) => a.chain === chain);
  if (symbol) assets = assets.filter((a) => a.symbol.toLowerCase() === symbol);
  if (verified === "true") assets = assets.filter((a) => a.verified);
  if (verified === "false") assets = assets.filter((a) => !a.verified);

  const total = assets.length;
  const page = assets.slice(offset, offset + limit);
  return apiJson({ total, limit, offset, count: page.length, assets: page });
}
