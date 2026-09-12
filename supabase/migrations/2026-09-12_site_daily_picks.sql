-- ============================================================================
-- Günün 3 seçimi — site_daily_picks
-- ----------------------------------------------------------------------------
-- Neden: paneldeki "Değer radarı" 1X2'de model-piyasa farkını öne çıkarıyordu;
-- 2026-09-12 backtest'i bu farkın ters sinyal olduğunu gösterdi (fark ≥+5 →
-- ROI −23). Çalışan kural gol pazarlarında modelin seviyesi + lig beyaz listesi
-- (src/lib/site/daily-picks-rule.ts). Bu tablo günün seçimlerini dondurur:
-- gün içinde model güncellense de kullanıcıya sabahki 3 seçim gösterilir ve
-- karne, o anda ne dediğimizle ölçülür (geriye dönük süsleme yok).
-- Sonuçlandırma skordan, engine_predictions ile join ederek yapılır.
-- Purely additive and idempotent.
-- ============================================================================

create table if not exists public.site_daily_picks (
  pick_date    date        not null,
  fixture_id   bigint      not null,
  market       text        not null check (market in ('btts', 'ou25')),
  selection    text        not null check (selection in ('yes', 'over')),
  model_p      numeric(5,4) not null check (model_p > 0 and model_p < 1),
  odds         numeric(6,2) not null,
  odds_source  text        not null check (odds_source in ('book', 'fair')),
  league_slug  text        not null,
  home_name    text        not null,
  away_name    text        not null,
  kickoff      timestamptz not null,
  rule_version text        not null,
  created_at   timestamptz not null default now(),
  primary key (pick_date, fixture_id)
);

create index if not exists site_daily_picks_kickoff_idx on public.site_daily_picks (kickoff);

comment on table public.site_daily_picks is
  'Panelde gösterilen günün 3 seçimi; sabah dondurulur, skordan sonuçlandırılır. Kural: daily-picks-rule.ts';

alter table public.site_daily_picks enable row level security;
