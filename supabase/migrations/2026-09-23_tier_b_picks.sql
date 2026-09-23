-- ============================================================================
-- Kapsam dışı yüksek güven listesi ("Tier-B") — 2026-09-23
-- ----------------------------------------------------------------------------
-- Neden: beyaz liste dışı liglerde model sıralaması çalışıyor (180 gün, 9.276 maç:
-- 1X2 ≥%80 → %75, Üst ≥%85 → %76, Alt ≥%75 → %64, KG ≥%80 → %69) ama bu
-- ayaklar hiçbir yerde kayıt altına alınmıyor; ayrı karne + oran/ROI izlenemiyor.
-- Her sabah eşik üstü ayaklar dondurulur, ertesi gün sonuçlanır, admin Telegram
-- DM'ine gider. Site/sosyal yayına ÇIKMAZ (deneysel, kanıt biriktirme).
-- ============================================================================
create table if not exists public.tier_b_picks (
  id           bigserial primary key,
  pick_date    date        not null,
  fixture_id   bigint      not null,
  league_id    bigint,
  league_name  text,
  home_name    text,
  away_name    text,
  kickoff      timestamptz not null,
  market       text        not null check (market in ('1x2','ou25','btts')),
  selection    text        not null check (selection in ('1','X','2','over','under','yes','no')),
  model_p      numeric     not null,
  threshold    numeric     not null,
  odds         numeric,             -- API-Football (bet365 tercihli) kapanış öncesi oran
  odds_source  text,
  market_p     numeric,             -- marjsız piyasa olasılığı (aynı pazar)
  margin       numeric,             -- (model_p - market_p) × 100, puan
  af_fixture_id bigint,
  won          boolean,             -- null = bekliyor / void
  home_score   int,
  away_score   int,
  settled_at   timestamptz,         -- dolu + won null = void (ertelenen/iptal)
  created_at   timestamptz not null default now(),
  unique (pick_date, fixture_id)
);
create index if not exists idx_tier_b_picks_open on public.tier_b_picks (kickoff) where settled_at is null;
create index if not exists idx_tier_b_picks_date on public.tier_b_picks (pick_date desc);
alter table public.tier_b_picks enable row level security;  -- yalnız service role okur/yazar
comment on table public.tier_b_picks is 'Out-of-coverage high-confidence legs (daily frozen, admin-only). See lib/tierb.';
