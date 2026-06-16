/**
 * Canonical asset + logo types shared across ingestion, the web app, and the
 * published npm package. The data model mirrors PLAN.md §3.
 */

/** Square PNG sizes we normalize every logo to. */
export const LOGO_SIZES = [256, 128, 64, 32] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];

/**
 * A resolved set of logo URLs at every size, plus an optional SVG.
 * Paths are relative to the CDN / public root, e.g. `/logos/ethereum/0x.../256.png`.
 */
export interface LogoSet {
  png256: string;
  png128: string;
  png64: string;
  png32: string;
  svg: string | null;
  /** Native pixel size of the source image, before re-encoding. Drives quality. */
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Quality state of an asset's logo. Drives the Admin review queue ordering.
 * - `curated`: a human uploaded an override; ingestion must never clobber it.
 * - `ok`: auto-fetched and good enough (source >= 128px, decoded cleanly).
 * - `needs_review`: auto-fetched but low-res / upscaled — float to top of queue.
 * - `missing`: no logo found from any source.
 */
export type LogoQuality = "curated" | "ok" | "needs_review" | "missing";

export interface Asset {
  /** Stable id: `${chain}:${address}`. */
  id: string;
  chain: string;
  /** Lowercased contract for EVM; `native` for L1 coins. */
  address: string;
  symbol: string;
  name: string;
  decimals: number | null;

  /** Cross-reference for refresh once CoinGecko is wired in. */
  coingeckoId: string | null;
  /** Market-cap rank for relevance sorting. Null until CoinGecko is available. */
  rank: number | null;

  /** Which source provided the chosen logo. */
  source: string;
  sourceUrl: string | null;
  /** On a curated allowlist / high rank. */
  verified: boolean;
  quality: LogoQuality;

  /**
   * Logo provenance split. The public resolver serves `override ?? auto` so the
   * CDN path is stable regardless of source. Re-ingestion only ever touches `auto`.
   */
  logo: {
    auto: LogoSet | null;
    override: LogoSet | null;
  };

  /** ISO timestamps. firstSeenAt powers the >=4-month age filter (needs a launch date source). */
  firstSeenAt: string;
  updatedAt: string;
}

/** Resolve the logo set the public CDN/API should serve: override wins. */
export function resolveLogo(asset: Asset): LogoSet | null {
  return asset.logo.override ?? asset.logo.auto;
}

/** The shape of the emitted assets.json manifest. */
export interface AssetsManifest {
  generatedAt: string;
  sources: string[];
  count: number;
  assets: Asset[];
}
