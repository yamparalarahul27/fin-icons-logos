/**
 * Builds the admin review queue: reads the Phase-0 ingestion manifest
 * (`public/assets.json`) and layers admin overrides on top. Overrides come from
 * the pluggable repo (Supabase in prod, JSON sidecar locally) and ingestion
 * never touches them, so re-running `pnpm ingest` refreshes `logo.auto` without
 * clobbering manual curation — the override-wins model from the README.
 */
import { readFile } from "node:fs/promises";
import {
  resolveLogo,
  type Asset,
  type AssetsManifest,
  type LogoQuality,
} from "@fin/shared";
import { MANIFEST_PATH } from "./paths";
import { getOverrideRepo } from "./overrides-repo";

/** Review-queue priority: worst logos float to the top. */
const QUEUE_RANK: Record<LogoQuality, number> = {
  missing: 0,
  needs_review: 1,
  ok: 2,
  curated: 3,
};

export interface QueueManifest {
  generatedAt: string | null;
  sources: string[];
  count: number;
  assets: Asset[];
}

async function readManifest(): Promise<AssetsManifest | null> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as AssetsManifest;
  } catch {
    return null;
  }
}

export async function loadQueue(): Promise<QueueManifest> {
  const [manifest, overrides] = await Promise.all([
    readManifest(),
    getOverrideRepo().getAll(),
  ]);
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
