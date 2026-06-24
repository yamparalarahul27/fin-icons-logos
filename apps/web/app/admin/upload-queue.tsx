"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHAINS, resolveLogo, type Asset, type LogoQuality, type LogoSet } from "@fin/shared";

type VariantTarget = "default" | "rounded" | "semi-rounded";
const VARIANT_OPTIONS: { value: VariantTarget; label: string }[] = [
  { value: "default", label: "Default logo" },
  { value: "rounded", label: "Rounded variant" },
  { value: "semi-rounded", label: "Semi-rounded variant" },
];

/** Custom dark-themed dropdown replacing the native <select> for the upload target. */
function VariantDropdown({
  value,
  onChange,
  disabled,
}: {
  value: VariantTarget;
  onChange: (v: VariantTarget) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const current = VARIANT_OPTIONS.find((o) => o.value === value) ?? VARIANT_OPTIONS[0]!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-600 focus:border-neutral-600 disabled:opacity-50"
      >
        {current.label}
        <svg
          className={`size-3.5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/95 p-1 shadow-xl backdrop-blur"
        >
          {VARIANT_OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-neutral-800 ${
                  o.value === value ? "text-neutral-100" : "text-neutral-400"
                }`}
              >
                {o.label}
                {o.value === value && <span className="text-emerald-400">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const QUALITY_LABEL: Record<LogoQuality, string> = {
  missing: "Missing",
  needs_review: "Needs review",
  ok: "OK",
  curated: "Curated",
};

const QUALITY_STYLE: Record<LogoQuality, string> = {
  missing: "bg-red-500/15 text-red-300 ring-red-500/30",
  needs_review: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  ok: "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
  curated: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

type Filter = "all" | LogoQuality;
const FILTERS: Filter[] = ["all", "missing", "needs_review", "ok", "curated"];

export function UploadQueue({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    for (const a of assets) c[a.quality] = (c[a.quality] ?? 0) + 1;
    return c;
  }, [assets]);

  const visible = filter === "all" ? assets : assets.filter((a) => a.quality === filter);

  function onUploaded(id: string, logo: LogoSet) {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, logo: { ...a.logo, override: logo }, quality: "curated" } : a,
      ),
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
              filter === f
                ? "bg-white text-neutral-900 ring-white"
                : "text-neutral-300 ring-neutral-700 hover:ring-neutral-500"
            }`}
          >
            {f === "all" ? "All" : QUALITY_LABEL[f]}
            <span className="ml-1.5 text-xs opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing in this bucket.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onUploaded={onUploaded} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  onUploaded,
}: {
  asset: Asset;
  onUploaded: (id: string, logo: LogoSet) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Which slot the upload targets: the default logo, or a shape variant.
  const [target, setTarget] = useState<VariantTarget>("default");
  const [note, setNote] = useState<string | null>(null);
  // Cache-buster so a freshly written override image replaces the old one.
  const [version, setVersion] = useState(0);

  const logo = resolveLogo(asset);
  const previewSrc = logo ? `${logo.png128}${version ? `?v=${version}` : ""}` : null;
  const chainLabel = CHAINS[asset.chain]?.label ?? asset.chain;
  const href = `/asset/${asset.chain}/${encodeURIComponent(asset.address)}`;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const body = new FormData();
      body.set("chain", asset.chain);
      body.set("address", asset.address);
      body.set("file", file);
      if (target !== "default") body.set("variant", target);

      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { logo?: LogoSet; variant?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);

      if (target === "default") {
        if (!data.logo) throw new Error("No logo returned.");
        onUploaded(asset.id, data.logo);
        setVersion((v) => v + 1);
      } else {
        setNote(`${target} variant updated ✓`);
        setTimeout(() => setNote(null), 1800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      {/* Header links to the public asset page (sizes, variants, fallback, …). */}
      <Link
        href={href}
        className="group -m-1 flex items-start gap-3 rounded-lg p-1 transition-colors hover:bg-neutral-800/40"
      >
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#262626_0_25%,#1a1a1a_0_50%)] bg-[length:14px_14px]">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={asset.symbol} className="size-12 object-contain" />
          ) : (
            <span className="text-[10px] text-neutral-500">no logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium group-hover:text-white">{asset.symbol}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${QUALITY_STYLE[asset.quality]}`}
            >
              {QUALITY_LABEL[asset.quality]}
            </span>
            <span className="ml-auto text-xs text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100">
              View ↗
            </span>
          </div>
          <p className="truncate text-sm text-neutral-400">{asset.name}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-600">
            {chainLabel}
            {logo ? ` · src ${logo.sourceWidth}×${logo.sourceHeight}` : ""}
          </p>
        </div>
      </Link>

      <VariantDropdown value={target} onChange={setTarget} disabled={busy} />

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs transition ${
          dragging
            ? "border-white bg-white/5 text-neutral-200"
            : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        {busy
          ? "Uploading…"
          : target === "default"
            ? "Drop a logo or click to upload an override"
            : `Drop a ${target} variant image`}
      </label>

      {note && <p className="text-xs text-emerald-400">{note}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </li>
  );
}
