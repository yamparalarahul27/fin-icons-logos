# Backlog

Pickup list for fin-icons-logos. Companion to [`PLAN.md`](./PLAN.md) (product) and
[`SECURITY-PLAN.md`](./SECURITY-PLAN.md) (hardening). Two sections: **operator
setup** (things only you can do — accounts, env vars) and **build backlog**
(code work). Last updated 2026-06-18.

---

## A. Operator setup (your end)

External services + environment variables. The code is already pluggable for all
of these — each feature falls back gracefully until you wire it up.

### A1. `ADMIN_SECRET` in Vercel — **required**
- **Why:** the admin gate ([`apps/web/middleware.ts`](apps/web/middleware.ts)) is
  fail-closed. If `ADMIN_SECRET` isn't set in Vercel, `/admin` is denied in
  production and you can't log in.
- **Do:** Vercel → Project → Settings → Environment Variables → add `ADMIN_SECRET`
  (same value as local `.env.local`), then redeploy.
- **Status:** verify it's set. If you added it when the gate shipped, done.

### A2. Supabase — when you curate on the live site
- **Why:** admin logo **overrides** need a real datastore. Vercel's filesystem is
  read-only/ephemeral, so the local JSON sidecar fallback silently won't persist.
  Uploading an override on the deployed site needs **both** `ADMIN_SECRET` (A1)
  **and** Supabase.
- **Do:** create a Supabase project → run
  [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) →
  add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role, server-only) to
  `.env.local` and Vercel.
- **Status:** parked. Only needed for live curation.

### A3. Upstash Redis — optional (real rate limiting)
- **Why:** rate limiting ([`apps/web/lib/rate-limit.ts`](apps/web/lib/rate-limit.ts))
  works today via an in-memory fallback, but that's per-edge-instance and resets
  on deploy. Upstash makes it shared + durable.
- **Do:** create an Upstash Redis DB (free tier) → add `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and Vercel.
- **Status:** optional, not blocking.

### A4. R2 + CDN — done
- `R2_*` provisioned; `cdn.defitriangle.xyz` serves images with immutable cache.
  No action.

---

## B. Build backlog (code work)

Roughly in recommended order.

### B1. Coverage: discovery source (CoinGecko / Jupiter) — **highest product value**
- **Why:** coverage is currently bounded by TrustWallet's curated lists + per-chain
  caps. Popular assets that aren't listed simply don't exist (already hit this with
  DOGE/WIF). This is the core "always up-to-date, comprehensive" promise.
- **Scope:** add a discovery source — CoinGecko (top-N by market cap, ~10k assets +
  logos + `rank`) and/or Jupiter (comprehensive Solana). Populate `rank`/`coingeckoId`
  in the schema (already present, currently null). Dedupe by `(chain, address)`.
- **Blocker:** these APIs were **not reachable** from the dev environment
  (CoinGecko egress-blocked, Jupiter returned HTTP 000). Needs confirmed network
  egress or a CI/server runner for ingestion.

### B2. Public JSON API (`/api/v1/...`) — PLAN.md §5b
- **Why:** sanctioned programmatic access; prerequisite for B3 (API keys).
- **Scope:** `GET /api/v1/assets`, `/assets/{chain}/{address}`, `/search`, `/recent`.
  CORS-open, cacheable. Rate limiting already has an `/api/v1/*` tier wired in.

### B3. API-key access tier — SECURITY-PLAN.md §4
- **Why:** turns scraping into an observable relationship; high-volume consumers.
- **Depends on:** B2 (the API must exist first).
- **Scope:** `0002_api_keys.sql` migration (`api_keys`, `api_key_requests`), a
  "request app access" form, admin approval flow, `Authorization: Bearer` lookup
  feeding the rate-limit tier. Store only key **hashes**.

### B4. npm package `@<scope>/crypto-logos` — PLAN.md §5c / Phase 3
- **Why:** best DX for frontend consumers; the "bulk" answer that reduces API load.
- **Scope:** `<TokenIcon>` component + `getLogoUrl()` helper resolving to CDN URLs.

### B5. Real admin auth (replace shared-secret stopgap) — SECURITY-PLAN.md §1
- **Why:** the current gate is a stopgap. Replace with Cloudflare Access (if the app
  is CF-proxied) or Supabase Auth + email allowlist.
- **Scope:** swap the cookie/secret check in `middleware.ts` for session/JWT
  verification; keep the in-route `requireAdmin()` defense-in-depth.

### B6. Smaller follow-ups
- Manifest → Supabase `asset` table once `assets.json` outgrows being committed
  (PLAN.md Phase 2; migration already exists).
- `"Added in last 24h"` / `/recent` freshness surface (PLAN.md Phase 4) — needs a
  launch-date source.
- Sitemap for curated gallery pages (SECURITY-PLAN.md §5, optional).
- Chain filter chips on the explorer.
