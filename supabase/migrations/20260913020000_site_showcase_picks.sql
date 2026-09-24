-- ============================================================================
-- Vitrin seçimi — site_showcase_picks (kural E, src/lib/site/showcase-rule.ts)
-- ----------------------------------------------------------------------------
-- Neden: aylık 1X2 isabeti (%43) müşteri vitrini olarak ürkütücü; backtest
-- 2026-09-13 (231 oranlı maç) birleşik kuralın (gol pazarı önce, 1X2 yalnız
-- fark < +5, zayıf liglerde 1X2 yok) %62 tuttuğunu gösterdi. Bu tablo maç
-- başına vitrin seçimini tutar: saatlik cron son oranla yeniden hesaplar,
-- başlamaya 3 saat kala dondurur; karne dondurulmuş satırlarla ölçülür.
-- Motorun ham çıktısı (engine_predictions) değişmez. Purely additive, idempotent.
-- ============================================================================

create table if not exists public.site_showcase_picks (
  fixture_id    bigint      primary key,
  kickoff       timestamptz not null,
  league_slug   text        not null,
  home_name     text        not null,
  away_name     text        not null,
  market        text        check (market in ('1x2', 'ou25', 'btts')),
  selection     text        check (selection in ('1', 'X', '2', 'over', 'yes')),
  model_p       numeric(5,4),
  edge_1x2      numeric(6,4),
  market_phase  text,
  reason        text        not null,
  rule_version  text        not null,
  frozen        boolean     not null default false,
  frozen_at     timestamptz,
  computed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists site_showcase_picks_kickoff_idx on public.site_showcase_picks (kickoff);

comment on table public.site_showcase_picks is
  'Vitrin seçimi (kural E): saatlik yeniden hesap, kickoff-3s dondurma, skordan sonuçlandırma. Kural: showcase-rule.ts';

alter table public.site_showcase_picks enable row level security;
