-- fin-icons-logos — initial schema (PLAN.md §3).
--
-- Apply with the Supabase CLI:
--   supabase db push
-- or paste into the Supabase SQL editor.

-- Canonical asset metadata. Images live in R2/CDN; this table holds everything
-- queryable. The app currently reads assets from the ingestion-emitted
-- assets.json; this table is the Phase-2 destination once ingestion upserts here.
create table if not exists asset (
  id            text primary key,            -- "${chain}:${address}"
  chain         text not null,
  address       text not null,               -- lowercased for EVM; "native" for L1 coins
  symbol        text not null,
  name          text not null,
  decimals      int,
  coingecko_id  text,
  rank          int,                          -- market-cap rank, null until CoinGecko is wired in
  source        text not null,
  source_url    text,
  verified      boolean not null default false,
  quality       text not null default 'missing'
                  check (quality in ('curated', 'ok', 'needs_review', 'missing')),
  logo          jsonb not null default '{"auto": null, "override": null}'::jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (chain, address)
);

create index if not exists asset_chain_idx on asset (chain);
create index if not exists asset_symbol_idx on asset (symbol);
create index if not exists asset_quality_idx on asset (quality);

-- Admin logo overrides — the durable curation record. Re-ingestion never
-- touches this, so an uploaded override always wins over the auto-fetched logo.
create table if not exists logo_overrides (
  id         text primary key,               -- "${chain}:${address}"
  logo       jsonb not null,                  -- a LogoSet (see packages/shared)
  updated_at timestamptz not null default now()
);
