import { apiJson, apiOptions, loadPublicAssets } from "@/lib/api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/** GET /api/v1/assets/{chain}/{address} — a single asset. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ chain: string; address: string }> },
) {
  const { chain, address } = await ctx.params;
  const decoded = decodeURIComponent(address);
  const assets = await loadPublicAssets();
  const asset = assets.find((a) => a.chain === chain && a.address === decoded);
  if (!asset) return apiJson({ error: "Asset not found." }, 404);
  return apiJson(asset);
}
