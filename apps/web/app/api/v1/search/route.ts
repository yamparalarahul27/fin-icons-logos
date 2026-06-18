import { apiJson, apiOptions, intParam, loadPublicAssets } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/** GET /api/v1/search?q= — substring match on symbol/name/address/chain. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limit = intParam(sp.get("limit"), 50, 250);
  if (!q) return apiJson({ query: "", count: 0, assets: [] });

  const matches = (await loadPublicAssets())
    .filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q),
    )
    .slice(0, limit);

  return apiJson({ query: q, count: matches.length, assets: matches });
}
