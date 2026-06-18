# Security & abuse-prevention plan

> Companion to [`PLAN.md`](./PLAN.md). Covers protecting an **open-source,
> openly-accessible** registry from cost abuse and tampering **without breaking
> the "consume trivially" promise**. Nothing here is implemented yet — this is
> the build order and design for later.

## Guiding principle

The product mission is *openly accessible, consume trivially*. So the goal is
**not** to lock things down — it's to **separate three audiences** and treat each
correctly:

| Audience | What they get | How we protect cost |
|---|---|---|
| Casual / browser | Public gallery + CDN images, always open | CDN caching (origin barely touched) |
| Programmatic consumers | JSON API, anonymous low-rate or API-key high-rate | Rate limits + sanctioned bulk path (npm) |
| Admins | Review/upload queue | Hard authentication gate |

Hard-blocking bots fights the mission; the strategy is **abuse prevention + a
sanctioned bulk path**, not prohibition.

## Threat / cost model (where money actually leaks)

1. **Admin write path is currently unauthenticated** — `/admin`,
   `/api/admin/assets`, `/api/admin/upload`. Anyone can upload arbitrary
   overrides (defacement of well-known token logos) and force `sharp` to process
   attacker-supplied bytes on every call. **Highest priority — this is live.**
2. **`/overrides/[...path]` streams through the Node server with
   `Cache-Control: no-store`** (`apps/web/app/overrides/[...path]/route.ts:37`).
   Every image fetch is origin compute + bandwidth on our host — the real
   current cost leak. CDN egress was already designed to be free (R2); we're
   bypassing that by serving bytes from the app with no caching.
3. **No rate limiting anywhere** — the (future) JSON API and the upload endpoint
   can be hammered.
4. **No sanctioned bulk path** — heavy consumers have no option but to scrape.

Note: R2 was chosen for **zero egress**, so CDN *image bytes* are cheap by
design. Do **not** rate-limit images — one gallery page is 100+ logo requests.
The cost vectors are origin compute (uploads, the no-store image route) and the
queryable API (Supabase reads), not CDN bytes.

---

## 1. Gate the admin surface  *(do first — closes the live hole)*

**Recommendation:** depends on hosting.
- **If the Next app is proxied through Cloudflare** → use **Cloudflare Access**
  in front of `/admin*` and `/api/admin/*`. Zero app code, real SSO, email
  allowlist, no secret to leak. Config lives in the CF Zero Trust dashboard.
- **If not / unsure** → **Supabase Auth + email allowlist** (we already depend on
  Supabase, portable across any host).
- **Stopgap today:** a shared-secret check in `middleware.ts` (env
  `ADMIN_SECRET`) — 10 minutes, closes the hole until the real gate lands.

### Implementation sketch (app-level path)

- Add `apps/web/middleware.ts` with a matcher for `/admin/:path*` and
  `/api/admin/:path*`.
- Stopgap: compare a cookie/header against `ADMIN_SECRET` (constant-time);
  401/redirect on mismatch.
- Real: verify a Supabase session JWT, then check the email against
  `ADMIN_ALLOWLIST` (comma-separated env). Reject otherwise.
- Defense in depth: re-check auth **inside** `api/admin/upload/route.ts` too —
  never rely on middleware alone for a write endpoint.
- New env (add to `apps/web/.env.example`): `ADMIN_SECRET` (stopgap) or
  `ADMIN_ALLOWLIST` + Supabase auth keys.

---

## 2. Fix image delivery caching + cost  *(low effort, immediate win)*

Independent of rate limiting and worth doing early.

- In `apps/web/app/overrides/[...path]/route.ts`, replace
  `Cache-Control: no-store` with
  `public, max-age=31536000, immutable` for image responses. Override paths are
  content-addressed by `<chain>/<address>/<size>.png`; a curated logo is stable,
  so long-lived immutable caching is safe and slashes origin hits.
- Phase 2 proper: serve override bytes straight from **R2 + CDN** (as already
  planned) so the app is out of the image path entirely. The dynamic route stays
  only as the local-dev fallback.
- Add `ETag`/`Last-Modified` so even cache revalidation is a cheap 304.

---

## 3. Rate limiting  *(middleware, applies to API + uploads — NOT images)*

**Recommendation:** **Upstash Redis** (free tier, host-agnostic, atomic
counters / sliding window). If the app later sits behind Cloudflare, add CF
native rate limiting as a cheaper edge first-line in front of this.

### Design

- A single `apps/web/middleware.ts` pass handles **both** rate limiting and
  API-key tiering (see §4), so the request is classified once.
- Limit by **API key if present, else client IP** (read the real IP from the
  platform's forwarded header; don't trust raw `x-forwarded-for`).
- Sliding-window counters in Upstash (`@upstash/ratelimit` + `@upstash/redis`).
- Tiers:

  | Caller | Suggested limit | Scope |
  |---|---|---|
  | Anonymous (IP) | e.g. 60 req/min | JSON API |
  | API key — free | e.g. 1,000 req/min | JSON API |
  | API key — partner | negotiated | JSON API |
  | Upload (admin, post-auth) | e.g. 20 req/min | abuse backstop on `sharp` |

- Always return `429` with `Retry-After` + `X-RateLimit-*` headers so good
  clients back off instead of retry-storming.
- **Exclude the image/CDN paths from rate limiting** — they're cache-served and
  must stay open.
- New env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Start-simple fallback: an in-memory per-instance limiter if Upstash isn't
  wired yet (resets on deploy, not shared across instances — fine for a first
  cut, not for production scale).

---

## 4. App-access tier — API keys for large fetches  *(the keystone)*

Turns "scraping" into a supported, observable relationship.

### Data model (Supabase)

New migration `supabase/migrations/0002_api_keys.sql`:

- `api_keys`: `id`, `key_hash` (store a **hash**, e.g. SHA-256 — never the raw
  key), `prefix` (first chars, for display), `owner_email`, `app_name`,
  `tier` (`free` | `partner`), `status` (`active` | `revoked`), `created_at`,
  `last_used_at`.
- `api_key_requests` (the "request app access" flow): `id`, `email`, `app_name`,
  `use_case`, `expected_volume`, `status` (`pending`|`approved`|`denied`),
  `created_at`.

### Flow

1. Public **"Request app access"** form → inserts an `api_key_requests` row.
2. Admin approves in the (now-gated) admin UI → generates a key, stores only its
   hash, shows the raw key **once**.
3. Consumer sends `Authorization: Bearer <key>`; middleware hashes it, looks it
   up, attaches `tier` → drives the §3 rate limit; bump `last_used_at`.
4. Revocation = flip `status`.

### Reduce the need to fetch at all

Push heavy consumers to the **`@<scope>/crypto-logos` npm package** (PLAN.md
Phase 3) so they vendor the data instead of hammering the API. The package +
immutable CDN URLs are the "bulk" answer; API keys cover dynamic/large queries.

---

## 5. Discourage abusive crawling  *(cheap, do alongside §2)*

- `apps/web/app/robots.txt` (or `robots.ts`): allow the public gallery, but
  `Disallow` the search/query endpoints and deep image trees so crawlers don't
  enumerate every URL. Point well-behaved bots at the API/npm package instead.
- Optional: a `Sitemap` for the curated gallery pages we *do* want indexed.
- This is best-effort (ignored by bad actors) — the real backstop is §3 rate
  limits. Do not add hard bot-blocking that would break legitimate programmatic
  consumers; that contradicts the product mission.

---

## Build order

1. **Gate admin** (§1) — stopgap secret now, real auth next. *Closes the live hole.*
2. **Image cache headers + robots.txt** (§2, §5) — minutes of work, immediate cost win.
3. **Rate-limit middleware** (§3) — protects API + upload.
4. **API-key access tier** (§4) — DB + request flow + tier-aware limits.

## New env vars (summary, add to `apps/web/.env.example`)

```
# Admin gating (pick one)
ADMIN_SECRET=                 # stopgap shared secret
ADMIN_ALLOWLIST=              # comma-separated admin emails (Supabase Auth path)

# Rate limiting (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
