"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHAINS } from "@fin/shared";
import { LogoImg } from "./logo-img";

interface Hit {
  id: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  logo: { png64: string } | null;
}

const hrefFor = (h: Hit) => `/asset/${h.chain}/${encodeURIComponent(h.address)}`;
const chainLabelOf = (chain: string) => CHAINS[chain as keyof typeof CHAINS]?.label ?? chain;

/**
 * Debounced typeahead over /api/v1/search. Clicking (or Enter on) a result jumps
 * to that asset's detail page — so you can hop logo-to-logo without going back.
 */
export function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { assets?: Hit[] };
        setHits(data.assets ?? []);
        setOpen(true);
      } catch {
        /* aborted or failed — leave prior hits */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(h: Hit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    router.push(hrefFor(h));
  }

  return (
    <div ref={boxRef} className="relative">
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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) go(hits[0]);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search another logo…"
        aria-label="Search logos"
        className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-600"
      />

      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/95 p-1 shadow-xl backdrop-blur">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => go(h)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-800/70"
              >
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[repeating-conic-gradient(#262626_0_25%,#1a1a1a_0_50%)] bg-[length:10px_10px]">
                  <LogoImg src={h.logo?.png64 ?? null} symbol={h.symbol} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-100">{h.symbol}</span>
                  <span className="block truncate text-xs text-neutral-500">{h.name}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-600">{chainLabelOf(h.chain)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
