"use client";

import { useState } from "react";

/** Deterministic gradient from a seed so each asset's fallback is stable + distinct. */
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 38) % 360;
  return `linear-gradient(140deg, hsl(${a} 52% 46%), hsl(${b} 54% 32%))`;
}

/**
 * A logo <img> that falls back to a polished letter tile when the source fails
 * to load (network hiccup, missing asset, etc.) — so the UI never shows a broken
 * image. The fallback is a deterministic gradient with the asset's first letter.
 */
export function LogoImg({
  src,
  symbol,
  alt,
  size,
  rounded = "squircle",
  className = "",
}: {
  src: string | null | undefined;
  symbol: string;
  alt?: string;
  size: number;
  rounded?: "squircle" | "full" | "none";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const radius =
    rounded === "full" ? 9999 : rounded === "none" ? 0 : Math.max(6, Math.round(size * 0.24));

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt ?? symbol}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundImage: gradientFor(symbol || "?"),
          fontSize: Math.round(size * 0.46),
        }}
        className={`inline-flex select-none items-center justify-center font-semibold leading-none text-white/95 ${className}`}
      >
        {(symbol.trim()[0] ?? "?").toUpperCase()}
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
