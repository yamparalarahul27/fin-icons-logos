/**
 * Phase 0 data spike (PLAN.md §7).
 *
 * Pull ~200 assets from TrustWallet, normalize logos to 32/64/128/256 PNG with
 * sharp, and emit apps/web/public/{logos,assets.json}. No DB, no CDN — the goal
 * is to validate the data shape + image quality before building any UI.
 *
 * CoinGecko (rank, launch date for the >=4-month age filter) is deferred: its
 * host is not in this environment's network egress allowlist. Those fields are
 * present in the schema but null for now.
 */
import { writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAINS,
  NATIVE_ADDRESS,
  normalizeAddress,
  type Asset,
  type AssetsManifest,
  type ChainName,
  type LogoQuality,
} from "@fin/shared";
import { fetchChainTokens, type SourceToken } from "./sources/trustwallet.js";
import { fetchLogo } from "./normalize.js";
import { getLogoSink, loadEnv, type LogoSink } from "./storage.js";

/** Per-chain token caps, tuned to land near ~200 total. */
const CHAIN_LIMITS: Record<ChainName, number> = {
  ethereum: 110,
  smartchain: 45,
  polygon: 25,
  solana: 15,
  bitcoin: 0, // native only
};

/** Source images smaller than this on their longest edge get flagged for review. */
const MIN_QUALITY_PX = 128;
const CONCURRENCY = 8;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PUBLIC_DIR = path.join(REPO_ROOT, "apps/web/public");
const LOGOS_DIR = path.join(PUBLIC_DIR, "logos");
const PUBLIC_BASE = "/logos";

/** Run an async mapper over items with a fixed concurrency ceiling. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function buildAsset(token: SourceToken, sink: LogoSink, now: string): Promise<Asset> {
  const info = CHAINS[token.chain]!;
  const address = normalizeAddress(token.address, info.evm);
  const id = `${token.chain}:${address}`;

  const raw = await fetchLogo(token.logoUrl);
  let quality: LogoQuality = "missing";
  let auto = null;

  if (raw) {
    const longest = Math.max(raw.width, raw.height);
    quality = longest >= MIN_QUALITY_PX ? "ok" : "needs_review";
    auto = await sink.put(token.chain, address, raw);
  }

  return {
    id,
    chain: token.chain,
    address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    coingeckoId: null,
    rank: null,
    source: "trustwallet",
    sourceUrl: token.logoUrl,
    // Native L1 coins are inherently trustworthy; treat as verified.
    verified: address === NATIVE_ADDRESS,
    quality,
    logo: { auto, override: null },
    firstSeenAt: now,
    updatedAt: now,
  };
}

async function main() {
  const now = new Date().toISOString();

  loadEnv(REPO_ROOT);
  const sink = getLogoSink({ outDir: LOGOS_DIR, publicBase: PUBLIC_BASE });
  console.log(
    sink.kind === "r2"
      ? `Logo sink: R2 → ${process.env.R2_PUBLIC_BASE_URL}`
      : "Logo sink: local public/ (no R2 creds — set apps/web/.env.local to upload)",
  );

  console.log("Fetching token lists from TrustWallet…");
  const chains = Object.keys(CHAIN_LIMITS) as ChainName[];
  const perChain = await pool(chains, chains.length, (c) =>
    fetchChainTokens(c, CHAIN_LIMITS[c]!),
  );
  const tokens = perChain.flat();
  console.log(`Collected ${tokens.length} candidate tokens across ${chains.length} chains.`);

  await mkdir(PUBLIC_DIR, { recursive: true });
  // Fresh local output each run so deletions upstream don't leave stale files.
  if (sink.kind === "local") {
    await rm(LOGOS_DIR, { recursive: true, force: true });
  }

  console.log(`Fetching + normalizing logos (concurrency ${CONCURRENCY})…`);
  const assets = await pool(tokens, CONCURRENCY, (t) => buildAsset(t, sink, now));

  const withLogo = assets.filter((a) => a.quality !== "missing");
  const manifest: AssetsManifest = {
    generatedAt: now,
    sources: ["trustwallet"],
    count: withLogo.length,
    assets: withLogo,
  };
  await writeFile(path.join(PUBLIC_DIR, "assets.json"), JSON.stringify(manifest, null, 2));

  const counts = {
    total: assets.length,
    withLogo: withLogo.length,
    missing: assets.length - withLogo.length,
    needsReview: assets.filter((a) => a.quality === "needs_review").length,
  };
  console.log("\nDone.");
  console.table(counts);
  console.log(`Manifest: ${path.relative(REPO_ROOT, path.join(PUBLIC_DIR, "assets.json"))}`);
  console.log(`Logos:    ${path.relative(REPO_ROOT, LOGOS_DIR)}/<chain>/<address>/<size>.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
