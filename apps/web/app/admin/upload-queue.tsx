"use client";

import { useMemo, useState } from "react";
import { CHAINS, resolveLogo, type Asset, type LogoQuality, type LogoSet } from "@fin/shared";

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
  // Cache-buster so a freshly written override image replaces the old one.
  const [version, setVersion] = useState(0);

  const logo = resolveLogo(asset);
  const previewSrc = logo ? `${logo.png128}${version ? `?v=${version}` : ""}` : null;
  const chainLabel = CHAINS[asset.chain]?.label ?? asset.chain;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("chain", asset.chain);
      body.set("address", asset.address);
      body.set("file", file);

      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { logo?: LogoSet; error?: string };
      if (!res.ok || !data.logo) {
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      onUploaded(asset.id, data.logo);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-start gap-3">
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
            <span className="truncate font-medium">{asset.symbol}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${QUALITY_STYLE[asset.quality]}`}
            >
              {QUALITY_LABEL[asset.quality]}
            </span>
          </div>
          <p className="truncate text-sm text-neutral-400">{asset.name}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-600">
            {chainLabel}
            {logo ? ` · src ${logo.sourceWidth}×${logo.sourceHeight}` : ""}
          </p>
        </div>
      </div>

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
        {busy ? "Uploading…" : "Drop a logo or click to upload an override"}
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </li>
  );
}
