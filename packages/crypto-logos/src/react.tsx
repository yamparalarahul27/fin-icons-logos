"use client";

/**
 * crypto-logos/react — a tiny <TokenIcon> over getLogoUrl.
 *
 * Renders the CDN <img> and falls back to a neutral placeholder on load error
 * (e.g. an asset we don't have yet). Hook-free: it swaps the img src on error,
 * so there's no state — but it uses an event handler, so in Next's App Router
 * import it from a Client Component.
 */
import * as React from "react";
import { getLogoUrl, type LogoSize } from "./index";

/** Neutral placeholder shown when a logo fails to load. */
const FALLBACK_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="30" fill="#26262a"/>' +
      '<text x="32" y="42" font-size="28" text-anchor="middle" fill="#6b6b72" font-family="sans-serif">?</text>' +
      "</svg>",
  );

export interface TokenIconProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  /** Canonical chain name, e.g. "ethereum", "solana", "dogecoin". */
  chain: string;
  /** Contract address, or "native" for L1 coins. */
  address: string;
  /** Logo size in px (32 / 64 / 128 / 256). Defaults to 64. */
  size?: LogoSize;
  /** CDN base override. */
  baseUrl?: string;
  /** Replace the default "?" placeholder shown on load error. */
  fallbackSrc?: string;
}

export function TokenIcon({
  chain,
  address,
  size = 64,
  baseUrl,
  fallbackSrc = FALLBACK_SRC,
  alt,
  ...rest
}: TokenIconProps) {
  return (
    <img
      src={getLogoUrl({ chain, address, size, baseUrl })}
      width={size}
      height={size}
      alt={alt ?? `${chain} ${address} logo`}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== fallbackSrc) img.src = fallbackSrc;
      }}
      {...rest}
    />
  );
}
