"use client";

import { useState } from "react";

/**
 * The "sticker" fallback shape (gray gradient with a peeled corner). Inlined as a
 * background image so its internal filter/gradient ids never collide across the
 * many fallbacks that can render on one page.
 */
const STICKER_SVG =
  '<svg width="101" height="101" viewBox="0 0 101 101" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<g filter="url(#fi)"><path d="M0 55.9831C-0.00026691 22.0586 31.417 6.16749 51.5152 10.5017L90.2783 50.95C93.1496 56.7283 89.0106 99.3206 48.8119 100.765C16.6529 101.921 0 76.2071 0 55.9831Z" fill="url(#pa)"/></g>' +
  '<g filter="url(#fd)"><path d="M51.5151 26.3902C50.2591 18.8891 50.5582 13.8707 51.5153 10.5L90.2779 50.9479C88.3637 51.4294 79.6545 51.8146 71.6147 49.5033C61.5651 46.6142 53.4501 37.9468 51.5151 26.3902Z" fill="url(#pb)"/></g>' +
  '<defs>' +
  '<filter id="fi" x="0" y="6.30273" width="94.5" height="94.5" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="bg"/><feBlend mode="normal" in="SourceGraphic" in2="bg" result="shape"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha"/><feOffset dx="3.5" dy="-3.5"/><feGaussianBlur stdDeviation="4.375"/><feComposite in2="ha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.61 0"/><feBlend mode="normal" in2="shape" result="e1"/></filter>' +
  '<filter id="fd" x="33.1816" y="0" width="67.5957" height="68.8135" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="bg"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha"/><feOffset dx="-3.5" dy="3.5"/><feGaussianBlur stdDeviation="7"/><feComposite in2="ha" operator="out"/><feColorMatrix type="matrix" values="0 0 0 0 0.276461 0 0 0 0 0.276461 0 0 0 0 0.276461 0 0 0 0.77 0"/><feBlend mode="normal" in2="bg" result="e1"/><feBlend mode="normal" in="SourceGraphic" in2="e1" result="shape"/></filter>' +
  '<linearGradient id="pa" x1="0" y1="88.5007" x2="91.3868" y2="22.6415" gradientUnits="userSpaceOnUse"><stop stop-color="#C4C4C4"/><stop offset="0.713413" stop-color="#717171"/></linearGradient>' +
  '<linearGradient id="pb" x1="76.7079" y1="27.0871" x2="57.1472" y2="45.0492" gradientUnits="userSpaceOnUse"><stop offset="0.263884" stop-color="#B1B1B1"/><stop offset="0.48144" stop-color="#CECECE"/><stop offset="0.885256" stop-color="#79797B"/></linearGradient>' +
  "</defs></svg>";

const STICKER_URL = `url("data:image/svg+xml,${encodeURIComponent(STICKER_SVG)}")`;

/**
 * A logo <img> that falls back to the sticker tile (with the asset's first
 * letter) when the source fails to load — so the UI never shows a broken image.
 * Pass a null `src` to render the fallback intentionally (e.g. a showcase).
 */
export function LogoImg({
  src,
  symbol,
  alt,
  size,
  className = "",
}: {
  src: string | null | undefined;
  symbol: string;
  alt?: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt ?? symbol}
        style={{
          width: size,
          height: size,
          backgroundImage: STICKER_URL,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
        className={`relative inline-flex select-none items-center justify-center ${className}`}
      >
        <span
          style={{ fontSize: Math.round(size * 0.4), textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
          className="font-semibold leading-none text-white"
        >
          {(symbol.trim()[0] ?? "?").toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? symbol}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`object-contain ${className}`}
    />
  );
}
