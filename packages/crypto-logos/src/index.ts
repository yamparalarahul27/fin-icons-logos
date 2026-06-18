/**
 * crypto-logos — framework-agnostic core.
 *
 * Resolves a (chain, address) to a stable CDN logo URL. Thin by design: it
 * builds the URL string and hits no network, so it's safe anywhere (SSR, edge,
 * Node, browser). For guaranteed-fresh / cache-busted URLs use the JSON API.
 */

export type LogoSize = 32 | 64 | 128 | 256;

/** Square PNG sizes every logo is published at. */
export const LOGO_SIZES: readonly LogoSize[] = [32, 64, 128, 256];

/** Default public CDN base. Override via `baseUrl` to self-host a mirror. */
export const DEFAULT_BASE_URL = "https://cdn.defitriangle.xyz";

/** Reserved address for native L1 coins (BTC, ETH, DOGE, SOL, …). */
export const NATIVE_ADDRESS = "native";

/**
 * Chains whose contract addresses are lowercased in storage (EVM). Others
 * (solana, bitcoin, dogecoin) keep their source casing. Kept in sync with the
 * ingestion chain registry.
 */
const EVM_CHAINS = new Set(["ethereum", "smartchain", "polygon"]);

export interface LogoOptions {
  /** Canonical chain name, e.g. "ethereum", "solana", "dogecoin". */
  chain: string;
  /** Contract address, or "native" for L1 coins. */
  address: string;
  /** One of 32 / 64 / 128 / 256. Defaults to 256. */
  size?: LogoSize;
  /** CDN base override. Defaults to the public CDN. */
  baseUrl?: string;
}

/** Normalize an address the way storage paths do (lowercase for EVM chains). */
export function normalizeAddress(chain: string, address: string): string {
  return EVM_CHAINS.has(chain) ? address.toLowerCase() : address;
}

/**
 * Build the CDN URL for a token logo.
 *
 * @example
 * getLogoUrl({ chain: "dogecoin", address: "native" })
 * // "https://cdn.defitriangle.xyz/logos/dogecoin/native/256.png"
 */
export function getLogoUrl(options: LogoOptions): string {
  const { chain, address, size = 256, baseUrl = DEFAULT_BASE_URL } = options;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/logos/${chain}/${normalizeAddress(chain, address)}/${size}.png`;
}
