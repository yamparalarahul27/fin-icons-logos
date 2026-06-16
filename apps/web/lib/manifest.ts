/**
 * Server-side store for the admin review queue.
 *
 * Reads the Phase-0 ingestion manifest (`public/assets.json`) and merges in any
 * admin-uploaded overrides. Overrides live in a sidecar (`data/overrides.json` +
 * `public/overrides/...`) that ingestion never touches, so re-running `pnpm
 * ingest` can refresh `logo.auto` without ever clobbering manual curation —
 * exactly the override-wins model from the README.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveLogo,
  type Asset,
  type AssetsManifest,
  type LogoQuality,
  type LogoSet,
} from "@fin/shared";

/** Next runs with cwd = apps/web. */
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

export const MANIFEST_PATH = path.join(PUBLIC_DIR, "assets.json");

/** Where normalized override PNGs are written, and the URL they're served from. */
export const OVERRIDES_DIR = path.join(PUBLIC_DIR, "overrides");
export const OVERRIDES_PUBLIC_BASE = "/overrides";

/** Durable curation metadata — survives `pnpm ingest`, committed to git. */
const DATA_DIR = path.join(ROOT, "data");
const OVERRIDES_JSON = path.join(DATA_DIR, "overrides.json");

/** Review-queue priority: worst logos float to the top. */
const QUEUE_RANK: Record<LogoQuality, number> = {
  missing: 0,
  needs_review: 1,
  ok: 2,
  curated: 3,
};

export type OverrideStore = Record<string, LogoSet>;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function readOverrides(): Promise<OverrideStore> {
  return readJson<OverrideStore>(OVERRIDES_JSON, {});
}

/** Persist a single asset's override logo set, merging into the sidecar store. */
export async function saveOverride(id: string, logo: LogoSet): Promise<void> {
  const store = await readOverrides();
  store[id] = logo;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OVERRIDES_JSON, JSON.stringify(store, null, 2));
}

export interface QueueManifest {
  generatedAt: string | null;
  sources: string[];
  count: number;
  assets: Asset[];
}

/**
 * Load the ingestion manifest and layer admin overrides on top. Any asset with
 * an override is marked `curated`. Result is sorted worst-quality-first so the
 * upload queue surfaces the logos that need attention.
 */
export async function loadQueue(): Promise<QueueManifest> {
  const manifest = await readJson<AssetsManifest | null>(MANIFEST_PATH, null);
  const overrides = await readOverrides();
  const base = manifest?.assets ?? [];

  const assets: Asset[] = base.map((asset) => {
    const override = overrides[asset.id];
    if (!override) return asset;
    return { ...asset, logo: { ...asset.logo, override }, quality: "curated" };
  });

  assets.sort((a, b) => {
    const r = QUEUE_RANK[a.quality] - QUEUE_RANK[b.quality];
    if (r !== 0) return r;
    return (a.rank ?? Infinity) - (b.rank ?? Infinity);
  });

  return {
    generatedAt: manifest?.generatedAt ?? null,
    sources: manifest?.sources ?? [],
    count: assets.length,
    assets,
  };
}

/** The logo URL the public side would serve for an asset (override wins). */
export function previewUrl(asset: Asset): string | null {
  return resolveLogo(asset)?.png128 ?? null;
}
