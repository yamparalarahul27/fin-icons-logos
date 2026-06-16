# fin-icons-logos

> The always-up-to-date, openly-accessible registry of crypto **token** logos.
> Built for other products to consume trivially: CDN image URLs, a JSON API, and an npm package.

See [`PLAN.md`](./PLAN.md) for the full product plan, data sources, and roadmap.

---

## Status

| Phase | Goal | State |
|---|---|---|
| **0 — Data spike** | Prove the pull → normalize → emit pipeline | ✅ **Done** |
| 1 — Frontend MVP | Public Next.js gallery over `assets.json` | ⏭️ Next |
| 2 — Infrastructure | R2 + CDN, Postgres, scaled ingestion | ⬜ |
| 3 — Distribution | JSON API + `@<scope>/crypto-logos` npm package | ⬜ |
| 4 — Freshness | Daily cron, `/recent`, coverage monitoring | ⬜ |

**Phase 0** ingests **182 assets** across 5 chains (Bitcoin, Ethereum, BNB Smart
Chain, Polygon, Solana) from [TrustWallet assets](https://github.com/trustwallet/assets),
normalizes each logo to 32/64/128/256 transparent PNGs with `sharp`, and emits a
local `assets.json` + image tree. No DB, no CDN yet — the goal was to validate the
data shape and image quality.

---

## The two faces (product shape)

- **Public** — search, filter by chain, view an asset, copy CDN URL / npm snippet,
  download. A discovery + marketing shell over the data. (Phase 1)
- **Admin** — a **review & curation queue on top of automated ingestion**, *not* a
  manual sourcing tool. The scheduled job auto-fetches a candidate logo; when it's
  low quality the admin uploads a proper one that meets iconography guidelines. The
  queue is sorted by `quality` so low-res / missing logos float to the top.

### Override-wins logo model

Each asset stores its logo provenance split in two:

- `logo.auto` — whatever ingestion pulled. May be low-res or missing.
- `logo.override` — what an admin uploads. Optional.

The resolver (`resolveLogo`) serves **`override ?? auto`**, so the public CDN path
is stable regardless of source, and **re-ingestion never clobbers manual curation**.
A `quality` state drives the review queue:

| State | Meaning |
|---|---|
| `curated` | A human uploaded an override — ingestion must never touch it. |
| `ok` | Auto-fetched, source ≥ 128px, decoded cleanly. |
| `needs_review` | Auto-fetched but low-res / upscaled — top of the queue. |
| `missing` | No logo found from any source. |

---

## Repo layout

```
fin-icons-logos/
├── apps/
│   └── web/                 # Next.js app (App Router) — admin upload queue
│       ├── app/admin/       #   review queue + logo upload UI
│       ├── app/api/admin/   #   assets (GET) + upload (POST) routes
│       ├── data/overrides.json   # durable curation record (committed)
│       └── public/          # Phase 0 spike output (gitignored, regenerable)
│           ├── assets.json  #   the manifest
│           └── logos/<chain>/<address>/<size>.png
├── packages/
│   ├── shared/              # canonical Asset/LogoSet types, chain registry, resolver
│   └── ingestion/           # source pullers, sharp normalizer, spike script
├── PLAN.md
└── README.md
```

---

## Getting started

Requires Node ≥ 22 and pnpm.

```bash
pnpm install
pnpm ingest        # runs the Phase 0 data spike
```

Output lands in `apps/web/public/`:

- `assets.json` — the [`AssetsManifest`](./packages/shared/src/asset.ts) (metadata + logo URLs per asset).
- `logos/<chain>/<address>/<size>.png` — normalized images.

Both are **gitignored** — they're build artifacts; regenerate with `pnpm ingest`.

### Admin upload UI

A Next.js app at `apps/web` provides the **review & curation queue**:

```bash
pnpm ingest                       # populate assets.json first
pnpm --filter @fin/web dev        # http://localhost:3000/admin
```

The `/admin` queue lists every asset sorted worst-quality-first (`missing` →
`needs_review` → `ok` → `curated`). Drop or pick a logo on any card to upload an
**override**: it's normalized to the canonical 32/64/128/256 PNGs with `sharp`,
written under `public/overrides/<chain>/<address>/`, and recorded in
`apps/web/data/overrides.json`. Per the override-wins model, this only sets
`logo.override` and flips `quality` to `curated` — `logo.auto` is untouched, so
re-running `pnpm ingest` refreshes the source logo without clobbering curation.

### Storage backends (R2 + Supabase)

The admin write path has two pluggable backends, selected by env vars at
runtime. With **none** set, everything falls back to local disk so the app runs
with zero cloud credentials:

| Concern | Cloud backend | Env vars | Local fallback |
|---|---|---|---|
| Logo image bytes | **Cloudflare R2** (S3-compatible, zero egress) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | `public/overrides/` served by `/overrides/[...]` |
| Override records | **Supabase Postgres** (`logo_overrides`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `data/overrides.json` (committed) |

R2 holds the bytes because this is a read-heavy image CDN and R2 has **zero
egress fees**; Supabase/Postgres holds the queryable records. See
[`apps/web/.env.example`](./apps/web/.env.example) for the full list and
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) for
the schema (`PLAN.md §3` `asset` table + `logo_overrides`). Apply it with
`supabase db push` or the Supabase SQL editor.

```bash
cp apps/web/.env.example apps/web/.env.local   # then fill in R2 + Supabase
```

> Free to launch: R2 (10 GB + zero egress) + Supabase free Postgres. Until the
> env is configured, override images sit in the (gitignored) `public/overrides/`
> tree and records in the committed `overrides.json`.

---

## Network constraints (this environment)

Outbound access is governed by the environment's egress allowlist:

- ✅ `raw.githubusercontent.com` (TrustWallet) — the Phase 0 image + metadata source.
- ❌ `api.coingecko.com` — **blocked**. So market-cap **rank** and token **launch
  date** are unavailable, which means the **≥4-month age filter cannot run yet**.
  Those fields (`rank`, `firstSeenAt`) exist in the schema but are null/placeholder.
  To enable: add `api.coingecko.com` to the environment's
  [network egress settings](https://code.claude.com/docs/en/claude-code-on-the-web),
  then CoinGecko becomes the primary discovery source per `PLAN.md` §4.

---

## Scope

v1 is **token logos only**. DeFi protocol logos, chain/network logos, user uploads,
and paid/auth tiers are deferred (see `PLAN.md` §1 non-goals).
