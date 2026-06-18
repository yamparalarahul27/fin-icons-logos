import type { SourceToken } from "./trustwallet.js";

/**
 * DefiLlama protocols source (PLAN.md v2 — protocol icons).
 *
 * /protocols returns every tracked protocol with a logo URL, category, and TVL.
 * We take the top `topN` by TVL (a relevance proxy), skipping CEXes since those
 * aren't DeFi protocols. Each becomes a `protocol:<slug>` asset.
 */
const PROTOCOLS_URL = "https://api.llama.fi/protocols";

/** Categories that aren't DeFi protocols — excluded from the icon set. */
const EXCLUDED_CATEGORIES = new Set(["CEX"]);

interface LlamaProtocol {
  name: string;
  slug?: string;
  category?: string;
  logo?: string | null;
  tvl?: number | null;
}

export async function fetchDefiLlama(topN = 300): Promise<SourceToken[]> {
  let all: LlamaProtocol[];
  try {
    const res = await fetch(PROTOCOLS_URL, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.warn(`  [defillama] HTTP ${res.status} — skipping source`);
      return [];
    }
    all = (await res.json()) as LlamaProtocol[];
  } catch (err) {
    console.warn(`  [defillama] fetch failed: ${(err as Error).message}`);
    return [];
  }

  const tokens = all
    .filter((p) => p.logo && p.slug && !EXCLUDED_CATEGORIES.has(p.category ?? ""))
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, topN)
    .map<SourceToken>((p) => ({
      chain: "protocol",
      address: p.slug!,
      symbol: p.name,
      name: p.category ?? "Protocol",
      decimals: null,
      logoUrl: p.logo!,
      source: "defillama",
      verified: true, // top-TVL, curated by DefiLlama
    }));

  console.log(`  [defillama] ${tokens.length} protocols (of ${all.length})`);
  return tokens;
}
