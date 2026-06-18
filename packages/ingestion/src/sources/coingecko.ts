import { CHAINS, NATIVE_ADDRESS, type ChainName } from "@fin/shared";
import type { SourceToken } from "./trustwallet.js";

/**
 * CoinGecko source (PLAN.md §4, BACKLOG.md B1).
 *
 * The discovery source: top coins by market cap, with canonical logos + rank.
 * Two free-tier endpoints joined by coin id:
 *  - /coins/markets       → id, symbol, name, large logo, market_cap_rank
 *  - /coins/list?include_platform=true → id → { cgChain: contractAddress }
 *
 * Coins with empty `platforms` are native L1 coins; tokens carry per-chain
 * contracts. We emit an asset for every (supported chain, address) we can map,
 * plus natives we recognise. This is what brings real logos for assets
 * TrustWallet's curated lists miss (e.g. the iconic Dogecoin face).
 */
const API = "https://api.coingecko.com/api/v3";

/** CoinGecko platform key → our ChainName (only chains we serve). */
const CG_CHAIN_TO_OURS: Record<string, ChainName> = {
  ethereum: "ethereum",
  "binance-smart-chain": "smartchain",
  "polygon-pos": "polygon",
  solana: "solana",
};

/** CoinGecko coin id → the chain it is the native coin of. */
const NATIVE_COIN_TO_CHAIN: Record<string, ChainName> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  dogecoin: "dogecoin",
  solana: "solana",
  binancecoin: "smartchain",
  "matic-network": "polygon",
  "polygon-ecosystem-token": "polygon",
};

interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  market_cap_rank: number | null;
}

interface ListCoin {
  id: string;
  platforms?: Record<string, string>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.warn(`  [coingecko] ${url} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`  [coingecko] fetch failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fetch the top `count` coins by market cap and expand to source tokens on the
 * chains we support. `count` is rounded up to whole 250-coin pages.
 */
export async function fetchCoinGecko(count = 250): Promise<SourceToken[]> {
  const pages = Math.max(1, Math.ceil(count / 250));
  const markets: MarketCoin[] = [];
  for (let page = 1; page <= pages; page++) {
    const batch = await fetchJson<MarketCoin[]>(
      `${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`,
    );
    if (!batch?.length) break;
    markets.push(...batch);
  }
  if (!markets.length) {
    console.warn("  [coingecko] no market data (egress blocked?) — skipping source");
    return [];
  }

  const list = await fetchJson<ListCoin[]>(`${API}/coins/list?include_platform=true`);
  const platformsById = new Map<string, Record<string, string>>();
  for (const c of list ?? []) platformsById.set(c.id, c.platforms ?? {});

  const tokens: SourceToken[] = [];
  const base = (c: MarketCoin) => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    decimals: null,
    logoUrl: c.image,
    source: "coingecko",
    verified: true, // top market-cap coins are high-trust
    rank: c.market_cap_rank,
    coingeckoId: c.id,
  });

  for (const coin of markets) {
    // Emit the native coin for recognised L1s — even when CoinGecko also lists
    // contract deployments (e.g. BNB, POL), so top L1s get canonical logos + rank.
    const nativeChain = NATIVE_COIN_TO_CHAIN[coin.id];
    if (nativeChain) tokens.push({ chain: nativeChain, address: NATIVE_ADDRESS, ...base(coin) });

    // Plus a token entry for each platform deployment on a chain we serve.
    const platforms = platformsById.get(coin.id) ?? {};
    for (const [cgChain, address] of Object.entries(platforms)) {
      if (!address) continue;
      const chain = CG_CHAIN_TO_OURS[cgChain];
      if (chain && CHAINS[chain]) tokens.push({ chain, address, ...base(coin) });
    }
  }

  console.log(`  [coingecko] ${tokens.length} assets from top ${markets.length} coins`);
  return tokens;
}
