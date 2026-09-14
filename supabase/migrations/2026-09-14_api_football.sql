-- ============================================================================
-- API-Football entegrasyonu: fikstür eşleme + Üst/Alt 2,5 oranı sütunları
-- ----------------------------------------------------------------------------
-- Neden: abone olunan akış Üst/Alt oranı vermiyor; Üst seçimleri adil oranla
-- kaydediliyordu (ROI/oran bandı ölçülemiyor). API-Football (doğrudan, Pro)
-- kimlikleri FotMob'dan farklı → eşleme tablosu. Purely additive, idempotent.
-- ============================================================================

create table if not exists public.af_fixture_map (
  fixture_id     bigint primary key,           -- FotMob / engine_predictions.fixture_id
  af_fixture_id  bigint not null,
  league_slug    text   not null,
  kickoff        timestamptz not null,
  score          numeric(4,2),
  created_at     timestamptz not null default now()
);
create index if not exists af_fixture_map_af_idx on public.af_fixture_map (af_fixture_id);
alter table public.af_fixture_map enable row level security;

alter table public.prediction_odds
  add column if not exists over25_odds  numeric(6,2),
  add column if not exists under25_odds numeric(6,2),
  add column if not exists ou_provider  text;

comment on column public.prediction_odds.over25_odds  is 'Üst 2,5 ondalık oranı (marjlı), API-Football';
comment on column public.prediction_odds.under25_odds is 'Alt 2,5 ondalık oranı (marjlı), API-Football';
comment on column public.prediction_odds.ou_provider  is 'Üst/Alt ve (akışta yoksa) KG oranının bahisçisi';
