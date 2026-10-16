-- ============================================================================
-- engine_intel: Claude istihbarat ajanının (engine/intel_agent.py) ÇIPA + İSİMLİ SAPMA kayıtları.
-- ----------------------------------------------------------------------------
-- Neden ayrı tablo: match_intelligence legacy Dolphin/önizleme şeması; burada amaç LLM katmanının
-- katkısını ÖLÇMEK → baseline (motor) ve final (sapma sonrası) yan yana, settle ile Brier/LL.
-- Protokol: .claude/skills/fa-prediction-lab/references/match-analysis.md
-- ELLE ÇALIŞTIRILACAK (Supabase SQL editörü). Purely additive, idempotent.
-- RLS: yazma/okuma yalnız service_role (paid_engine_tables_no_anon ile aynı ilke). Public site okumaz.
-- ============================================================================

create table if not exists public.engine_intel (
  id                   bigint generated always as identity primary key,

  -- kimlik (engine_predictions ile aynı FotMob id evreni)
  fixture_id           bigint      not null,
  agent_version        text        not null default 'intel-1.0',
  model_version        text        not null,            -- çıpa: engine_predictions.model_version
  league_id            bigint,
  league_name          text,
  home_id              bigint,
  home_name            text,
  away_id              bigint,
  away_name            text,
  kickoff              timestamptz,

  -- çıpa ve sonuç (olasılıklar 0–1)
  baseline             jsonb       not null,            -- {home,draw,away,over25,btts,lambdaHome,lambdaAway,modelVersion}
  deviations           jsonb       not null default '[]'::jsonb,  -- uygulanan, KIRPILMIŞ sapmalar
  final                jsonb       not null,            -- {home,draw,away}
  goals                jsonb,                           -- {lambdaHome,lambdaAway,over25,btts,adjusted}
  pick                 text        check (pick in ('1','X','2')),
  confidence           text        check (confidence in ('low','medium','high')),
  data_completeness    numeric(4,2),
  key_factors          jsonb,
  narrative            text,
  lang                 text        default 'tr',
  intel                jsonb,                           -- injuries/lineupNews/context/sources (model çıktısı)
  unverified           jsonb,
  sources              jsonb,                           -- web araması kaynakları [{url,title,age}]
  warnings             jsonb,                           -- kural kırpmaları (model sınır aştıysa iz)

  -- maliyet / izlenebilirlik
  usage                jsonb,                           -- jeton sayıları, arama sayısı, stop_reason, fallback
  cost_usd             numeric(8,5),
  llm_model            text,
  issued_after_kickoff boolean     not null default false,  -- karneye GİRMEZ
  analyzed_at          timestamptz not null default now(),

  -- settle (engine_predictions sonucuyla)
  settled              boolean     not null default false,
  settled_at           timestamptz,
  home_score           int,
  away_score           int,
  result               text        check (result in ('H','D','A')),
  brier_baseline       numeric(8,5),
  brier_final          numeric(8,5),
  ll_baseline          numeric(8,5),
  ll_final             numeric(8,5),
  brier_ou25_baseline  numeric(8,5),
  brier_ou25_final     numeric(8,5),
  brier_btts_baseline  numeric(8,5),
  brier_btts_final     numeric(8,5),
  grade                text        check (grade in ('correct','partial','wrong')),
  critique             jsonb,                           -- retrospektif (adım 3, Batch)

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (fixture_id, agent_version)
);

create index if not exists idx_engine_intel_kickoff  on public.engine_intel (kickoff desc);
create index if not exists idx_engine_intel_settle   on public.engine_intel (settled, kickoff);
create index if not exists idx_engine_intel_league   on public.engine_intel (league_id);

create or replace function public.touch_engine_intel()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_engine_intel on public.engine_intel;
create trigger trg_touch_engine_intel
  before update on public.engine_intel
  for each row execute function public.touch_engine_intel();

alter table public.engine_intel enable row level security;
revoke all on public.engine_intel from anon, authenticated;
-- (Bilinçli olarak policy YOK: yalnız service_role — ajan ve sunucu tarafı dashboard rotası.)

comment on table  public.engine_intel is 'Claude istihbarat ajanı: motor çıpası + isimli sapma; baseline vs final Brier karnesi (LLM katkısı ölçümü)';
comment on column public.engine_intel.deviations is 'Kod tarafından kırpılmış sapmalar: faktör başına ≤ ±0.08 (overwhelming ≤ ±0.12), toplam 0';
comment on column public.engine_intel.issued_after_kickoff is 'true ise karneye girmez (publishedAfterKickoff kuralı)';
