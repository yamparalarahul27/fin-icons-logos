import type { ChainName } from "@fin/shared";
import type { SourceToken } from "./trustwallet.js";

/**
 * xStocks source (Backed Finance).
 *
 * Tokenized US equities + ETFs (AAPLx, TSLAx, SPYx, …) and a handful of pre-IPO
 * names (SpaceX `SPCXx`). The public assets endpoint needs no auth and returns
 * the symbol, name, a logo URL, and a per-chain deployment list. Docs:
 * https://docs.xstocks.fi/developers
 */
const ASSETS_URL = "https://api.backed.fi/api/v2/public/assets";

/** Map Backed/xStocks `deployments[].network` names to our canonical ChainName. */
const NETWORK_TO_CHAIN: Record<string, ChainName> = {
  Solana: "solana",
  Ethereum: "ethereum",
  Polygon: "polygon",
  BNB: "smartchain",
  "BNB Chain": "smartchain",
  "BNB Smart Chain": "smartchain",
};

/**
 * An xStock deploys the same asset to several chains under distinct addresses.
 * We anchor each asset to one chain to avoid near-duplicate entries; Solana is
 * the flagship xStocks chain, so prefer it, then fall back down the list.
 */
const CHAIN_PREFERENCE: ChainName[] = ["solana", "ethereum", "smartchain", "polygon"];

interface Deployment {
  network: string;
  address: string;
}

interface BackedAsset {
  id: string;
  name: string;
  symbol: string;
  logo: string | null;
  deployments?: Deployment[];
}

interface AssetsPage {
  nodes?: BackedAsset[];
  page?: { currentPage: number; hasNextPage: boolean };
}

/** Hard stop so a misbehaving `hasNextPage` can never loop forever. */
const MAX_PAGES = 20;

/**
 * Walk the 0-indexed `?page=N` pagination until `hasNextPage` is false,
 * accumulating every asset node. Tolerates a bare array on the first page.
 */
async function fetchAllAssets(): Promise<BackedAsset[]> {
  const all: BackedAsset[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${ASSETS_URL}?page=${page}`);
    if (!res.ok) {
      console.warn(`  [xstocks] page ${page}: HTTP ${res.status}`);
      break;
    }
    const json = (await res.json()) as AssetsPage | BackedAsset[];
    if (Array.isArray(json)) return json; // un-paginated fallback
    all.push(...(json.nodes ?? []));
    if (!json.page?.hasNextPage) break;
  }
  return all;
}

/**
 * Fetch tokenized equities from xStocks, anchored to one supported chain each.
 * `limit` (optional) caps the count for spike runs.
 */
export async function fetchXStocks(limit?: number): Promise<SourceToken[]> {
  const assets = await fetchAllAssets();
  const tokens: SourceToken[] = [];

  for (const a of assets) {
    if (!a.logo) continue;

    // Collect the first address per supported chain, then pick by preference.
    const byChain = new Map<ChainName, string>();
    for (const d of a.deployments ?? []) {
      const chain = NETWORK_TO_CHAIN[d.network];
      if (chain && d.address && !byChain.has(chain)) byChain.set(chain, d.address);
    }
    const chain = CHAIN_PREFERENCE.find((c) => byChain.has(c));
    if (!chain) continue; // deployed only on chains we don't track yet

    tokens.push({
      chain,
      address: byChain.get(chain)!,
      symbol: a.symbol,
      name: a.name,
      decimals: null, // not exposed by this endpoint
      logoUrl: a.logo!,
      source: "xstocks",
      verified: true, // issuer-curated, regulated assets
    });
  }

  const sliced = limit ? tokens.slice(0, limit) : tokens;
  console.log(`  [xstocks] ${sliced.length} tokenized assets (of ${assets.length} from API)`);
  return sliced;
}
