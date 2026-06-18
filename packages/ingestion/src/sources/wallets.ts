import type { SourceToken } from "./trustwallet.js";

/**
 * Wallet logos via the WalletConnect / Reown explorer registry (PLAN.md v2).
 *
 * Requires a free project id (env WALLETCONNECT_PROJECT_ID). Without it the
 * source is a no-op, matching the pluggable pattern of the other backends. The
 * project id is only used to fetch logos at ingest time — it never lands in the
 * manifest (final URLs are CDN paths). Keyed `wallet:<slug>`.
 */
const API = "https://explorer-api.walletconnect.com/v3";
const PAGE_SIZE = 100;

interface Listing {
  id: string;
  name: string;
  slug?: string;
  image_id?: string;
}
interface WalletsPage {
  listings?: Record<string, Listing>;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function fetchWallets(topN = 200): Promise<SourceToken[]> {
  const projectId = process.env.WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    console.log("  [wallets] WALLETCONNECT_PROJECT_ID unset — skipping source");
    return [];
  }

  const out: SourceToken[] = [];
  const seen = new Set<string>();

  for (let page = 1; out.length < topN; page++) {
    let listings: Record<string, Listing> = {};
    try {
      const res = await fetch(
        `${API}/wallets?projectId=${projectId}&entries=${PAGE_SIZE}&page=${page}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        console.warn(`  [wallets] page ${page}: HTTP ${res.status}`);
        break;
      }
      listings = ((await res.json()) as WalletsPage).listings ?? {};
    } catch (err) {
      console.warn(`  [wallets] fetch failed: ${(err as Error).message}`);
      break;
    }

    const rows = Object.values(listings);
    if (rows.length === 0) break; // no more pages

    for (const w of rows) {
      if (!w.image_id || !w.name) continue;
      const slug = w.slug || slugify(w.name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        chain: "wallet",
        address: slug,
        symbol: w.name,
        name: "Wallet",
        decimals: null,
        logoUrl: `${API}/logo/lg/${w.image_id}?projectId=${projectId}`,
        source: "walletconnect",
        verified: true,
      });
      if (out.length >= topN) break;
    }
  }

  console.log(`  [wallets] ${out.length} wallets`);
  return out;
}
