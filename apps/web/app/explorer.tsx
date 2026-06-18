"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CHAINS } from "@fin/shared";
import type { CatalogAsset } from "../lib/manifest";

const chainLabelOf = (chain: string) =>
  CHAINS[chain as keyof typeof CHAINS]?.label ?? chain;

export function Explorer({ assets }: { assets: CatalogAsset[] }) {
  const [query, setQuery] = useState("");
  const [chain, setChain] = useState<string>("all");

  // Chains present in the catalog, most-populated first, for the filter chips.
  const chains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) counts.set(a.chain, (counts.get(a.chain) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [assets]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (chain !== "all" && a.chain !== chain) return false;
      if (!q) return true;
      return (
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q) ||
        chainLabelOf(a.chain).toLowerCase().includes(q)
      );
    });
  }, [assets, query, chain]);

  const filtered = query.trim() !== "" || chain !== "all";

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-6 mb-6 bg-neutral-950/80 px-6 py-4 backdrop-blur">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by symbol, name, contract, or chain…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 py-3 pl-10 pr-4 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition focus:border-neutral-600"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <ChainChip label="All" count={assets.length} active={chain === "all"} onClick={() => setChain("all")} />
          {chains.map(([c, count]) => (
            <ChainChip
              key={c}
              label={chainLabelOf(c)}
              count={count}
              active={chain === c}
              onClick={() => setChain(c)}
            />
          ))}
        </div>

        <p className="mt-2 text-xs text-neutral-500">
          {results.length.toLocaleString()}
          {results.length === 1 ? " asset" : " assets"}
          {chain !== "all" ? ` on ${chainLabelOf(chain)}` : ""}
          {query.trim() ? ` matching “${query.trim()}”` : ""}
        </p>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          {filtered ? "No assets match your filters." : "No assets."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChainChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm ring-1 transition-[background-color,color,box-shadow,scale] active:scale-[0.96] ${
        active
          ? "bg-white text-neutral-900 ring-white"
          : "text-neutral-300 ring-neutral-700 hover:ring-neutral-500"
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function AssetCard({ asset }: { asset: CatalogAsset }) {
  const [copied, setCopied] = useState(false);
  const chainLabel = CHAINS[asset.chain as keyof typeof CHAINS]?.label ?? asset.chain;
  const url = asset.logo.png256;
  const href = `/asset/${asset.chain}/${encodeURIComponent(asset.address)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <li className="group relative">
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 pr-24 transition-colors hover:border-neutral-600 active:scale-[0.99]"
        style={{ transitionProperty: "border-color, scale" }}
      >
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#262626_0_25%,#1a1a1a_0_50%)] bg-[length:14px_14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.logo.png64}
            alt={asset.symbol}
            loading="lazy"
            className="size-10 object-contain outline outline-1 -outline-offset-1 outline-white/10"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{asset.symbol}</span>
            {asset.verified && (
              <svg className="size-3.5 shrink-0 text-sky-400" viewBox="0 0 20 20" fill="currentColor" aria-label="verified">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="truncate text-sm text-neutral-400">{asset.name}</p>
          <p className="truncate text-xs text-neutral-600">{chainLabel}</p>
        </div>
      </Link>

      {/* Sibling of the Link (not nested) so clicking Copy never navigates. */}
      <button
        onClick={copy}
        title={url}
        className="absolute right-3 top-1/2 grid h-10 -translate-y-1/2 place-items-center rounded-lg border border-neutral-700 px-2.5 text-xs text-neutral-300 opacity-0 transition-colors hover:border-neutral-500 hover:text-neutral-100 focus-visible:opacity-100 group-hover:opacity-100 active:scale-[0.96]"
        style={{ transitionProperty: "border-color, color, scale, opacity" }}
      >
        {copied ? "Copied ✓" : "Copy URL"}
      </button>
    </li>
  );
}
