import { CHAINS, NATIVE_ADDRESS, type ChainName } from "@fin/shared";

/**
 * TrustWallet assets source (github.com/trustwallet/assets).
 *
 * We read from raw.githubusercontent.com rather than the TrustWallet CDN
 * (assets-cdn.trustwallet.com), because only the former is reachable from this
 * environment's network egress allowlist, and it serves identical files.
 */
const RAW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

export interface SourceToken {
  chain: ChainName;
  /** Original (checksummed for EVM) address as stored in the repo, or `native`. */
  address: string;
  symbol: string;
  name: string;
  decimals: number | null;
  /** URL to the source PNG (raw.githubusercontent.com for TrustWallet). */
  logoUrl: string;
  /** Which source produced this token. Defaults to "trustwallet" in the builder. */
  source?: string;
  /** Force-verify (issuer-curated lists). Defaults to native-coin-only. */
  verified?: boolean;
  /** Market-cap rank, when the source provides one (CoinGecko). */
  rank?: number | null;
  /** CoinGecko coin id, for cross-referencing on refresh. */
  coingeckoId?: string | null;
}

interface TokenListEntry {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface TokenList {
  tokens?: TokenListEntry[];
}

/** Native coin pseudo-asset (BTC, ETH, ...) — logo lives at blockchains/<chain>/info/logo.png. */
function nativeToken(chain: ChainName): SourceToken {
  const info = CHAINS[chain]!;
  return {
    chain,
    address: NATIVE_ADDRESS,
    symbol: info.nativeSymbol,
    name: info.nativeName,
    decimals: null,
    logoUrl: `${RAW}/${info.trustwallet}/info/logo.png`,
  };
}

/**
 * Fetch up to `limit` tokens for a chain from its tokenlist.json, plus the
 * native coin. Returns the source tokens in tokenlist order (a rough relevance
 * proxy until CoinGecko rank is available).
 */
export async function fetchChainTokens(
  chain: ChainName,
  limit: number,
): Promise<SourceToken[]> {
  const info = CHAINS[chain]!;
  const tokens: SourceToken[] = [nativeToken(chain)];

  const res = await fetch(`${RAW}/${info.trustwallet}/tokenlist.json`);
  if (!res.ok) {
    console.warn(`  [${chain}] no tokenlist.json (HTTP ${res.status})`);
    return tokens;
  }

  const list = (await res.json()) as TokenList;
  for (const t of (list.tokens ?? []).slice(0, limit)) {
    tokens.push({
      chain,
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoUrl: `${RAW}/${info.trustwallet}/assets/${t.address}/logo.png`,
    });
  }
  return tokens;
}
