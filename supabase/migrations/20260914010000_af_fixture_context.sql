-- ============================================================================
-- af_fixture_context: maç bağlamı — eksikler (sakatlık/ceza) ve açıklanan kadro
-- ----------------------------------------------------------------------------
-- Neden: model sezonluk takım gücü hesaplar, o hafta kimin eksik olduğunu
-- bilmez (2026-09-14 kaynak taraması: en büyük kör nokta). API-Football
-- /injuries?fixture ve /fixtures/lineups?fixture yanıtları sadeleştirilip
-- burada saklanır; maç sayfası "Eksikler ve kadro" bölümü buradan okur,
-- ileride motor düzeltmesi/backtest için geçmiş de burada kalır.
-- Eksikler ≤48 saat kala 6 saatte bir tazelenir, kadro ~75 dk kala bir kez
-- alınır (cron /api/cron/af-context, saat başı :25). Purely additive, idempotent.
-- ============================================================================

create table if not exists public.af_fixture_context (
  fixture_id     bigint primary key,           -- FotMob / engine_predictions.fixture_id
  af_fixture_id  bigint not null,
  kickoff        timestamptz not null,
  injuries       jsonb,                        -- [{side,team,player,type,reason}]
  injuries_at    timestamptz,
  lineups        jsonb,                        -- [{side,team,formation,coach,startXI:[...],bench:[...]}]
  lineups_at     timestamptz,
  updated_at     timestamptz not null default now()
);
create index if not exists af_fixture_context_kickoff_idx on public.af_fixture_context (kickoff);
alter table public.af_fixture_context enable row level security;

comment on table  public.af_fixture_context is 'API-Football maç bağlamı: eksikler + açıklanan kadro (site + ileride motor)';
comment on column public.af_fixture_context.injuries is 'Sadeleştirilmiş sakatlık/ceza listesi; type: Missing Fixture | Questionable';
comment on column public.af_fixture_context.lineups  is 'Açıklanan 11 + yedekler + diziliş + teknik direktör; kadro yoksa null';
