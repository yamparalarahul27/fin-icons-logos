import type { SourceToken } from "./trustwallet.js";

/**
 * DefiLlama chains source — network/L1-L2 logos (PLAN.md v2).
 *
 * /v2/chains lists every tracked chain with TVL + native token symbol. Logos
 * live at icons.llama.fi/chains/rsz_<slug>.jpg where slug is the lowercased,
 * hyphenated name. We take the top `topN` by TVL; a few slug mismatches 404 and
 * are dropped downstream (their logo simply won't resolve). Keyed `network:<slug>`.
 */
const CHAINS_URL = "https://api.llama.fi/v2/chains";

interface LlamaChain {
  name?: string;
  tvl?: number | null;
  tokenSymbol?: string | null;
}

export async function fetchNetworks(topN = 100): Promise<SourceToken[]> {
  let all: LlamaChain[];
  try {
    const res = await fetch(CHAINS_URL, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.warn(`  [networks] HTTP ${res.status} — skipping source`);
      return [];
    }
    all = (await res.json()) as LlamaChain[];
  } catch (err) {
    console.warn(`  [networks] fetch failed: ${(err as Error).message}`);
    return [];
  }

  const tokens = all
    .filter((c) => c.name)
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, topN)
    .map<SourceToken>((c) => {
      const slug = c.name!.toLowerCase().replace(/\s+/g, "-");
      return {
        chain: "network",
        address: slug,
        symbol: c.name!,
        name: c.tokenSymbol ?? "Network",
        decimals: null,
        logoUrl: `https://icons.llama.fi/chains/rsz_${slug}.jpg`,
        source: "defillama",
        verified: true,
      };
    });

  console.log(`  [networks] ${tokens.length} chains (of ${all.length})`);
  return tokens;
}
