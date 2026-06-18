/**
 * Ingestion pipeline (PLAN.md §7, BACKLOG.md B1).
 *
 * Pull assets from TrustWallet (curated per-chain lists), xStocks (tokenized
 * equities), and CoinGecko (top coins by market cap — canonical logos + rank),
 * dedupe by (chain, address) with source priority, normalize logos to
 * 32/64/128/256 PNG with sharp, upload to R2/CDN (or local fallback), and emit
 * apps/web/public/assets.json.
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
import { fetchXStocks } from "./sources/xstocks.js";
import { fetchCoinGecko } from "./sources/coingecko.js";
import { fetchLogo } from "./normalize.js";
import { getLogoSink, loadEnv, type LogoSink } from "./storage.js";

/** How many top CoinGecko coins (by market cap) to pull logos + rank for. */
const COINGECKO_TOP = 250;

/** On a (chain, address) collision, the higher-priority source's token wins. */
const SOURCE_PRIORITY: Record<string, number> = { coingecko: 3, xstocks: 2, trustwallet: 1 };
const priorityOf = (t: SourceToken) => SOURCE_PRIORITY[t.source ?? "trustwallet"] ?? 0;

/** Per-chain token caps. `slice(0, limit)` of each TrustWallet tokenlist. */
const CHAIN_LIMITS: Record<ChainName, number> = {
  ethereum: 110,
  smartchain: 45,
  polygon: 25,
  // Solana's TrustWallet list is ~55 and includes majors (WIF, PYTH, RNDR, …)
  // past the old cap of 15. Take the whole list so they're not sliced off.
  solana: 200,
  bitcoin: 0, // native only
  dogecoin: 0, // native only
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
    coingeckoId: token.coingeckoId ?? null,
    rank: token.rank ?? null,
    source: token.source ?? "trustwallet",
    sourceUrl: token.logoUrl,
    // Issuer-curated sources self-verify; otherwise native L1 coins are trusted.
    verified: token.verified ?? address === NATIVE_ADDRESS,
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
  console.log("Fetching tokenized equities from xStocks…");
  const xstocks = await fetchXStocks();
  console.log(`Fetching top ${COINGECKO_TOP} coins from CoinGecko…`);
  const coingecko = await fetchCoinGecko(COINGECKO_TOP);

  const trustwallet = perChain.flat();
  const raw = [...trustwallet, ...xstocks, ...coingecko];

  // Dedupe by canonical id; the higher-priority source wins (CoinGecko logos +
  // rank beat TrustWallet, which fixes e.g. the plain Dogecoin mark).
  const byId = new Map<string, SourceToken>();
  for (const t of raw) {
    const info = CHAINS[t.chain];
    if (!info) continue;
    const id = `${t.chain}:${normalizeAddress(t.address, info.evm)}`;
    const current = byId.get(id);
    if (!current || priorityOf(t) > priorityOf(current)) byId.set(id, t);
  }
  const tokens = [...byId.values()];
  console.log(
    `Collected ${raw.length} raw (tw ${trustwallet.length}, xstocks ${xstocks.length}, ` +
      `cg ${coingecko.length}) → ${tokens.length} after dedupe.`,
  );

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
    sources: ["trustwallet", "xstocks", "coingecko"],
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
