"use client";

import Link from "next/link";
import { useState } from "react";
import { CHAINS } from "@fin/shared";
import type { CatalogAsset } from "../../../../lib/manifest";
import { QuickSearch } from "../../../quick-search";
import { LogoImg } from "../../../logo-img";

/** The three visible sizes in the showcase ladder (px). 256 stays in the URL list. */
const SHOWCASE = [128, 64, 32] as const;

/** Public app origin, for absolute variant (icon) URLs other apps can hotlink. */
const APP_ORIGIN = "https://icons.hirahul.xyz";

export function AssetDetail({ asset }: { asset: CatalogAsset }) {
  const chainLabel = CHAINS[asset.chain as keyof typeof CHAINS]?.label ?? asset.chain;
  const isNative = asset.address === "native";
  const sizeUrls: Record<number, string> = {
    256: asset.logo.png256,
    128: asset.logo.png128,
    64: asset.logo.png64,
    32: asset.logo.png32,
  };
  const imgSnippet = `<img src="${asset.logo.png64}" width="32" height="32" alt="${asset.symbol}" />`;
  const iconPath = `/api/icon/${asset.chain}/${encodeURIComponent(asset.address)}`;
  const iconBase = `${APP_ORIGIN}${iconPath}`;
  const variantUrl = `${iconBase}?shape=rounded&size=256`;
  const semiVariantUrl = `${iconBase}?shape=semi-rounded&size=256`;

  // Composite badge demo: a token badged with its chain's native coin (always
  // present). Not shown for native coins / protocols / networks / wallets.
  const showBadge = !["protocol", "network", "wallet"].includes(asset.chain) && !isNative;
  const badgeTarget = `${asset.chain}:native`;
  const badgedPreview = `${iconPath}?shape=rounded&badge=${badgeTarget}&size=128`;
  const badgedUrl = `${iconBase}?shape=rounded&badge=${badgeTarget}&size=256`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-5">
        <QuickSearch />
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <span aria-hidden>←</span> All logos
      </Link>

      {/* Header */}
      <header className="mt-6 flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[repeating-conic-gradient(#262626_0_25%,#1a1a1a_0_50%)] bg-[length:18px_18px] p-2">
          <LogoImg
            src={asset.logo.png256}
            symbol={asset.symbol}
            alt={asset.symbol}
            size={64}
            className="outline outline-1 -outline-offset-1 outline-white/10"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{asset.symbol}</h1>
            {asset.verified && (
              <svg
                className="size-4 shrink-0 text-sky-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-label="verified"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="truncate text-neutral-400">{asset.name}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{chainLabel}</p>
        </div>
      </header>

      {/* Sizes ladder */}
      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Sizes</h2>
        <ul className="mt-3 flex flex-wrap items-end gap-3">
          {SHOWCASE.map((size) => (
            <li
              key={size}
              className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="flex h-32 items-center justify-center">
                <LogoImg
                  src={sizeUrls[size]!}
                  symbol={asset.symbol}
                  alt={`${asset.symbol} ${size}px`}
                  size={size}
                  className="outline outline-1 -outline-offset-1 outline-white/10"
                />
              </div>
              <CopyChip label={`${size}px`} value={sizeUrls[size]!} />
            </li>
          ))}
        </ul>
      </section>

      {/* Badge — composite variant (primary + corner badge). */}
      {showBadge && (
        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Badge</h2>
          <div className="mt-3 flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgedPreview}
              alt={`${asset.symbol} with a corner badge`}
              width={64}
              height={64}
              className="size-16 shrink-0"
            />
            <p className="text-sm text-neutral-400">
              Overlay any logo in the corner — here {asset.symbol} badged with its chain coin.
              Set <code className="rounded bg-neutral-800 px-1">?badge=chain:address</code> to any
              asset (token, network, or coin).
            </p>
          </div>
          <div className="mt-2">
            <CopyRow label="Badged (rounded)" value={badgedUrl} />
          </div>
        </section>
      )}

      {/* Fallback — shown so consumers know a graceful placeholder exists. */}
      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Fallback</h2>
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <LogoImg src={null} symbol={asset.symbol} alt={`${asset.symbol} fallback`} size={56} />
          <p className="text-sm text-neutral-400">
            If the logo can&apos;t load, this sticker tile with the asset&apos;s
            initial is shown automatically, so the UI never breaks.
          </p>
        </div>
      </section>

      {/* Information */}
      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Information
        </h2>
        <dl className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800">
          <Row label="Chain" value={chainLabel} />
          <Row label="Symbol" value={asset.symbol} />
          <Row label="Name" value={asset.name} />
          <Row
            label="Contract"
            value={isNative ? "Native coin" : asset.address}
            mono={!isNative}
            copy={isNative ? undefined : asset.address}
          />
          <Row label="Verified" value={asset.verified ? "Yes" : "No"} />
        </dl>
      </section>

      {/* Use it */}
      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Use it</h2>
        <div className="mt-3 space-y-2">
          {asset.logo.svg && <CopyRow label="SVG (vector)" value={asset.logo.svg} />}
          <CopyRow label="CDN URL (256px)" value={asset.logo.png256} />
          <CopyRow label="HTML" value={imgSnippet} />
          <CopyRow label="Rounded variant" value={variantUrl} />
          <CopyRow label="Semi-rounded variant" value={semiVariantUrl} />
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          {asset.logo.svg ? "Vector SVG, plus PNG at " : "PNG at "}
          256 / 128 / 64 / 32 px — swap the size in the path. Variants take any
          <code className="mx-1 rounded bg-neutral-800 px-1">?size=</code>.
        </p>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-neutral-500">{label}</dt>
      <dd
        className={`flex min-w-0 items-center gap-2 text-sm text-neutral-200 ${mono ? "font-mono" : ""}`}
      >
        <span className="truncate">{value}</span>
        {copy && <CopyIcon value={copy} />}
      </dd>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => doCopy(value, setCopied)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-left transition-colors hover:border-neutral-600 active:scale-[0.99]"
      style={{ transitionProperty: "border-color, scale" }}
    >
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
        <span className="block truncate font-mono text-sm text-neutral-200">{value}</span>
      </span>
      <span className="shrink-0 text-xs text-neutral-400 group-hover:text-neutral-200">
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}

/** A pill that copies its value; shows a confirmation. Used under each size tile. */
function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => doCopy(value, setCopied)}
      title={value}
      className="rounded-md px-2 py-1 text-xs tabular-nums text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 active:scale-[0.96]"
      style={{ transitionProperty: "background-color, color, scale" }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function CopyIcon({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => doCopy(value, setCopied)}
      aria-label="Copy"
      className="relative grid size-6 shrink-0 place-items-center rounded text-neutral-500 transition-colors hover:text-neutral-200 active:scale-[0.96] before:absolute before:-inset-2 before:content-['']"
      style={{ transitionProperty: "color, scale" }}
    >
      {copied ? (
        <span className="text-xs text-emerald-400">✓</span>
      ) : (
        <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 3.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
    </button>
  );
}

async function doCopy(value: string, setCopied: (v: boolean) => void) {
  try {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  } catch {
    /* clipboard unavailable */
  }
}
