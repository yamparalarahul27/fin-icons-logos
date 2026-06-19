"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CHAINS, kindOf, type AssetKind } from "@fin/shared";
import type { CatalogAsset } from "../lib/manifest";

/** How many cards to show before "Load more". */
const PAGE_SIZE = 60;

const chainLabelOf = (chain: string) =>
  CHAINS[chain as keyof typeof CHAINS]?.label ?? chain;

type KindFilter = "all" | AssetKind;
const KIND_LABEL: Record<AssetKind, string> = {
  token: "Tokens",
  protocol: "Protocols",
  network: "Networks",
  wallet: "Wallets",
};

export function Explorer({ assets }: { assets: CatalogAsset[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [chain, setChain] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Category counts for the top-level switcher (only kinds that are present).
  const kinds = useMemo(() => {
    const counts = new Map<AssetKind, number>();
    for (const a of assets) {
      const k = kindOf(a.chain);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return (["token", "protocol", "network", "wallet"] as AssetKind[])
      .filter((k) => counts.has(k))
      .map((k) => [k, counts.get(k)!] as const);
  }, [assets]);

  // Token chains, most-populated first — shown only when viewing Tokens.
  const chains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      if (kindOf(a.chain) !== "token") continue;
      counts.set(a.chain, (counts.get(a.chain) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [assets]);

  const showChains = kind === "token";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (kind !== "all" && kindOf(a.chain) !== kind) return false;
      if (showChains && chain !== "all" && a.chain !== chain) return false;
      if (!q) return true;
      return (
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q) ||
        chainLabelOf(a.chain).toLowerCase().includes(q)
      );
    });
  }, [assets, query, kind, chain, showChains]);

  // Any change to the active filters resets the page back to the first batch.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, kind, chain]);

  function selectKind(k: KindFilter) {
    setKind(k);
    setChain("all"); // chain sub-filter only applies within Tokens
  }

  const filtered = query.trim() !== "" || kind !== "all" || chain !== "all";

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

        {/* Category switcher */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="All" count={assets.length} active={kind === "all"} onClick={() => selectKind("all")} />
          {kinds.map(([k, count]) => (
            <Chip
              key={k}
              label={KIND_LABEL[k]}
              count={count}
              active={kind === k}
              onClick={() => selectKind(k)}
            />
          ))}
        </div>

        {/* Chain sub-filter — only within Tokens */}
        {showChains && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip label="All chains" count={chains.reduce((n, [, c]) => n + c, 0)} active={chain === "all"} onClick={() => setChain("all")} subtle />
            {chains.map(([c, count]) => (
              <Chip key={c} label={chainLabelOf(c)} count={count} active={chain === c} onClick={() => setChain(c)} subtle />
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-neutral-500">
          {results.length.toLocaleString()}
          {results.length === 1 ? " asset" : " assets"}
          {kind !== "all" ? ` · ${KIND_LABEL[kind as AssetKind]}` : ""}
          {showChains && chain !== "all" ? ` on ${chainLabelOf(chain)}` : ""}
          {query.trim() ? ` matching “${query.trim()}”` : ""}
        </p>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          {filtered
            ? "No logos match your filters. Try a different symbol or chain."
            : "No logos yet."}
        </p>
      ) : (
        <>
          {/* Continuous shelves: column-gap is 0 so each card's base ledge
              abuts its neighbour and reads as one shelf per row. */}
          <ul className="grid grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {results.slice(0, visible).map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </ul>

          {visible < results.length && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-300 transition-[border-color,color,scale] hover:border-neutral-500 hover:text-neutral-100 active:scale-[0.97]"
              >
                Load more logos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  subtle,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  subtle?: boolean;
}) {
  // `subtle` gives the chain sub-filter a lighter weight than the kind tabs.
  const size = subtle ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";
  const inactive = subtle
    ? "text-neutral-400 ring-neutral-800 hover:ring-neutral-600"
    : "text-neutral-300 ring-neutral-700 hover:ring-neutral-500";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full ring-1 transition-[background-color,color,box-shadow,scale] active:scale-[0.96] ${size} ${
        active ? "bg-white text-neutral-900 ring-white" : inactive
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function AssetCard({ asset }: { asset: CatalogAsset }) {
  // The icon is the primary action: click copies the PNG to the clipboard, the
  // card blurs, and an "Icon Copied" overlay confirms before reverting.
  const [imgState, setImgState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const href = `/asset/${asset.chain}/${encodeURIComponent(asset.address)}`;

  async function copyImage() {
    if (imgState === "busy") return;
    setImgState("busy");
    try {
      const res = await fetch(
        `/api/image?chain=${encodeURIComponent(asset.chain)}&address=${encodeURIComponent(asset.address)}&size=256`,
      );
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      setImgState("done");
    } catch {
      setImgState("error");
    } finally {
      setTimeout(() => setImgState("idle"), 1300);
    }
  }

  const copied = imgState === "done";
  const failed = imgState === "error";

  return (
    <li className="group relative flex flex-col">
      <div
        className={`relative mx-1.5 flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border px-3 py-6 transition-colors ${
          copied || failed
            ? "border-neutral-600 bg-neutral-900/70"
            : "border-transparent bg-neutral-900/40"
        }`}
      >
        {/* Card content — lifts on hover to make room for "View", and blurs
            behind the copied/failed overlay. */}
        <div
          className={`flex flex-col items-center transition duration-300 ease-out group-hover:-translate-y-3 ${
            copied || failed ? "blur-[2px]" : ""
          }`}
        >
          <button
            onClick={copyImage}
            aria-label={`Copy ${asset.symbol} icon`}
            title="Click to copy icon"
            className="grid size-16 cursor-copy place-items-center overflow-hidden rounded-xl bg-[repeating-conic-gradient(#262626_0_25%,#1a1a1a_0_50%)] bg-[length:14px_14px] transition-transform active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.logo.png64}
              alt={asset.symbol}
              loading="lazy"
              className="size-12 object-contain"
            />
          </button>

          <div className="mt-3 flex items-center gap-1 text-center">
            <p className="max-w-[9rem] truncate text-sm font-medium text-neutral-100">
              {asset.name}
            </p>
            {asset.verified && (
              <svg
                className="size-3.5 shrink-0 text-sky-400"
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
          <p className="text-xs uppercase tracking-wide text-neutral-500">({asset.symbol})</p>
        </div>

        {/* "View" rides in from below on hover — no empty space reserved. */}
        <Link
          href={href}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-2 rounded-full px-2.5 py-1 text-xs text-neutral-300 opacity-0 transition duration-300 ease-out hover:text-neutral-100 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
        >
          View →
        </Link>

        {/* Copy confirmation overlay. */}
        {(copied || failed) && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-neutral-950/40">
            <span
              className={`text-xs font-medium ${copied ? "text-emerald-400" : "text-red-400"}`}
            >
              {copied ? "✓ Icon Copied" : "Copy failed"}
            </span>
          </div>
        )}
      </div>

      {/* Contact shadow — grounds the tile onto the shelf. */}
      <div className="mx-auto mt-3 h-2.5 w-1/2 rounded-[50%] bg-black/45 blur-md" />

      {/* Shelf — a lit front lip, a hint of surface depth, and a cast shadow.
          Column-gap is 0 so each card's full-width shelf abuts its neighbour
          into one continuous ledge per row. */}
      <div className="-mt-1 w-full">
        <div className="h-px w-full bg-white/30" />
        <div className="h-2 w-full bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="h-5 w-full bg-gradient-to-b from-black/55 to-transparent" />
      </div>
    </li>
  );
}
