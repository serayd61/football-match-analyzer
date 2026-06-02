-- ============================================================================
-- engine_predictions — YENİ tahmin motoru (Dixon-Coles) çıktıları
-- Eski tablolara DOKUNMAZ. Tamamen ayrı, izole tablo.
-- n8n → FastAPI predict-service → /api/v2/predictions/ingest → bu tablo → site
-- ============================================================================

create table if not exists public.engine_predictions (
  id            bigint generated always as identity primary key,

  -- maç kimliği (FotMob / Free API id'leri — fixtures ile birebir aynı)
  fixture_id    bigint      not null,
  league_id     bigint,
  league_name   text,
  home_id       bigint,
  home_name     text,
  away_id       bigint,
  away_name     text,
  kickoff       timestamptz,

  -- model olasılıkları
  p_home        numeric,
  p_draw        numeric,
  p_away        numeric,
  p_over25      numeric,
  p_btts_yes    numeric,
  lambda_home   numeric,
  lambda_away   numeric,

  -- karar
  pick          text,       -- '1' | 'X' | '2'
  confidence    numeric,    -- max(p_home,p_draw,p_away)
  rationale     text,
  model_version text        not null default 'dc-1.0',

  -- sonuç (settle sonrası)
  home_score    int,
  away_score    int,
  result        text,       -- 'H' | 'D' | 'A'
  settled       boolean     not null default false,
  correct       boolean,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (fixture_id, model_version)
);

create index if not exists idx_engine_pred_kickoff   on public.engine_predictions (kickoff desc);
create index if not exists idx_engine_pred_league     on public.engine_predictions (league_id);
create index if not exists idx_engine_pred_settled    on public.engine_predictions (settled);

-- updated_at otomatik güncelleme
create or replace function public.touch_engine_predictions()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_engine_predictions on public.engine_predictions;
create trigger trg_touch_engine_predictions
  before update on public.engine_predictions
  for each row execute function public.touch_engine_predictions();

-- RLS: herkes okuyabilir (site gösterimi), yazma yalnızca service_role (RLS'i baypas eder)
alter table public.engine_predictions enable row level security;

drop policy if exists "engine_predictions read" on public.engine_predictions;
create policy "engine_predictions read"
  on public.engine_predictions for select
  using (true);
