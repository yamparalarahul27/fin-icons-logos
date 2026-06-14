# Fin-Icons-Logos — Project Plan

> The always-up-to-date, openly-accessible registry of crypto **token** logos.
> Built for other products to consume trivially: CDN image URLs, a JSON API, and an npm package.

---

## 1. The problem

Crypto products constantly need token logos (BTC, ETH, USDC, SPL tokens, long-tail ERC-20s).
Today they:
- Scrape CoinGecko/CoinMarketCap (against ToS, fragile).
- Vendor a stale snapshot of TrustWallet assets that rots within weeks.
- Show broken images for any token launched after their last update.

**The valuable, hard part is not the gallery — it is freshness + coverage + zero-friction consumption.**
New tokens launch daily; the registry that stays current and is the easiest to embed wins adoption.

### Non-goals (v1)
- DeFi protocol logos, chain/network logos → deferred to v2.
- User uploads / community submissions → deferred.
- Paid tiers / auth → deferred (launch fully open).

---

## 2. Product = three layers

| Layer | What it is | Why it matters |
|---|---|---|
| **Ingestion** | Scheduled jobs that aggregate, dedupe, normalize logos from open sources | The moat. Determines coverage + freshness. |
| **Distribution** | CDN image URLs, JSON API, npm package | Drives adoption. Other products integrate in minutes. |
| **Frontend** | Next.js explorer: search, filter, copy URL/snippet, download | Discovery + marketing. A shell over the API. |

---

## 3. Data model

Canonical identity for a token = **(chain, contract_address)**, with `symbol` as a secondary lookup.
Native assets (BTC, ETH, SOL) have no contract → keyed by a reserved address like `native`.

```
asset
  id              uuid (pk)
  chain           text         -- "ethereum", "solana", "bitcoin", "base", ...
  address         text         -- contract address, lowercased; "native" for L1 coins
  symbol          text         -- "USDC"
  name            text         -- "USD Coin"
  decimals        int          -- nullable
  coingecko_id    text         -- cross-reference for refresh
  rank            int          -- market cap rank, for sorting/relevance
  logo_svg        text         -- CDN path, nullable
  logo_png_256    text         -- CDN path
  logo_png_128    text
  logo_png_64     text
  logo_png_32     text
  source          text         -- "trustwallet" | "coingecko" | "uniswap-list" | ...
  source_url      text
  verified        bool         -- on a curated allowlist / high rank
  first_seen_at   timestamptz
  updated_at      timestamptz

  unique (chain, address)
```

Image storage layout in object storage / CDN:

```
/{chain}/{address}/256.png
/{chain}/{address}/128.png
/{chain}/{address}/64.png
/{chain}/{address}/32.png
/{chain}/{address}/logo.svg        (when available)
/symbol/{symbol}.png               (alias → top-ranked asset for that symbol)
```

---

## 4. Data sources (ingestion)

Pull from open sources rather than hand-collecting. Priority order:

1. **TrustWallet assets** — github.com/trustwallet/assets. Largest community-maintained, multi-chain, predictable PNG paths keyed by contract address. Primary image source.
2. **CoinGecko API** — discovery + metadata (symbol, name, rank, chain, contract, coingecko_id) for ~10k+ assets, plus logo URLs. Free tier; respect rate limits. Primary discovery source.
3. **Token lists (per chain)** — Uniswap token lists, Solana token list, Jupiter token list. On-chain contract→logo mappings, good for long-tail and freshness.
4. **On-chain / launchpads (v2)** — detect brand-new tokens before the above index them.

### Dedupe & merge rules
- Match on `(chain, address)`. Lowercase EVM addresses.
- When multiple sources provide a logo: prefer SVG > highest-res PNG; prefer TrustWallet/curated over auto-listed.
- Keep `source` + `source_url` for provenance/attribution.

### Normalization
- Re-encode to consistent square sizes: 32 / 64 / 128 / 256 PNG, transparent background.
- Keep original SVG when source provides one (scalable, smallest).
- Reject corrupt/0-byte images; flag missing-logo assets for backfill.

---

## 5. Distribution (the adoption engine)

### a) Direct CDN image URLs (zero-integration)
```
https://cdn.<domain>/ethereum/0xa0b8.../256.png
https://cdn.<domain>/symbol/usdc.png        # convenience alias
```
- Long cache TTL, immutable per content hash; purge on logo update.
- This alone covers `<img src=...>` everywhere with no SDK.

### b) JSON API
```
GET /api/v1/assets?chain=ethereum&symbol=usdc&limit=50
GET /api/v1/assets/{chain}/{address}
GET /api/v1/search?q=usd
GET /api/v1/recent           # assets added in last 24h  ← freshness showcase
```
Returns metadata + all logo URLs. CORS-open, rate-limited, cacheable.

### c) npm package — `@<scope>/crypto-logos`
- `<TokenIcon chain="ethereum" address="0x..." size={32} />` React component.
- `getLogoUrl({ chain, address, size })` framework-agnostic helper.
- Ships either thin (resolves to CDN URLs) or with a bundled manifest for offline/SSR.
- Graceful fallback to a generic placeholder on miss.

---

## 6. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | Requested; ideal for a gallery + API routes |
| Image storage + CDN | Cloudflare R2 + Cloudflare CDN | Free egress, cheap, fast global delivery of images |
| Metadata DB | Postgres (Neon or Supabase) | Query by chain/symbol/contract; serverless-friendly |
| Ingestion | TypeScript scripts run on a schedule (GitHub Actions cron to start, dedicated worker later) | Cheap, versioned, observable |
| Image processing | `sharp` | Fast resize/re-encode to the size set |
| Frontend hosting | Vercel | Native Next.js |
| Monorepo | pnpm workspaces / Turborepo | Share types between app, api, ingestion, npm pkg |

### Proposed repo structure
```
fin-icons-logos/
├── apps/
│   └── web/                 # Next.js explorer + JSON API routes
├── packages/
│   ├── crypto-logos/        # the published npm package
│   ├── ingestion/           # source pullers, normalizer, uploader
│   └── shared/              # types, chain registry, helpers
├── PLAN.md
└── README.md
```

---

## 7. Phased roadmap

### Phase 0 — Data spike  *(prove the pipeline)*
- One script: pull top ~200 assets from CoinGecko + TrustWallet, normalize with `sharp`, dump to local `apps/web/public/logos` + a `assets.json`.
- Goal: validate the data shape and image quality. No DB, no CDN yet.

### Phase 1 — Frontend MVP  *(something to show)*
- Next.js gallery reading the local `assets.json`.
- Search, filter by chain, asset detail with copy-URL + copy-npm-snippet + download.
- Deploy to Vercel.

### Phase 2 — Real infrastructure  *(scale)*
- Images → R2 + CDN; metadata → Postgres.
- Ingestion scales to full source coverage; idempotent upserts.
- Frontend + API read from Postgres/CDN.

### Phase 3 — Distribution  *(adoption)*
- Public JSON API (`/api/v1/...`), CORS + rate limiting + caching.
- Publish `@<scope>/crypto-logos` npm package with `<TokenIcon>` + `getLogoUrl`.
- Docs page in the explorer ("Use these logos").

### Phase 4 — Freshness  *(the differentiator)*
- Daily cron: detect new/changed tokens, backfill missing logos, re-normalize.
- `/recent` endpoint + "Added in last 24h" UI section.
- Monitoring: coverage %, missing-logo count, last-sync time.

---

## 8. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| **Source ToS / rate limits** (CoinGecko) | Use for metadata within free-tier limits; lean on TrustWallet (open) for images; cache aggressively; attribute sources. |
| **Logo quality varies** | Normalize to fixed sizes; prefer SVG/high-res; manual curation allowlist for top assets. |
| **Symbol collisions** (many "USDC"-likes) | Canonical key is (chain, address); `/symbol/` alias resolves to highest-rank only. |
| **Storage/egress cost at scale** | R2 (zero egress fee) + long CDN TTLs + content-hash immutability. |
| **Staleness creep** | Phase 4 cron + visible "last synced" + missing-logo dashboard. |
| **Trademark / brand-asset usage** | Serve official logos as-is with provenance; add a takedown/attribution policy in docs. |

---

## 9. Success metrics
- **Coverage:** % of top-N (by market cap) tokens with a logo; total assets indexed.
- **Freshness:** median age of newest-token logo; % of last-24h tokens covered.
- **Adoption:** CDN requests/day, npm weekly downloads, API consumers.

---

## 10. Open decisions (revisit before Phase 2)
- Domain name + npm scope.
- DB host: Neon vs Supabase.
- Free-only vs eventual sponsor/pro tier for high-volume API consumers.
- Whether to vendor a bundled manifest in the npm package or keep it thin.
