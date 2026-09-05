-- ============================================================================
-- engine_prediction_history — değişmez yayın geçmişi (TASLAK, uygulanmadı)
-- ----------------------------------------------------------------------------
-- Neden: engine_predictions (fixture_id, model_version) üzerine UPSERT yapar;
-- aynı sürüm yeniden yazılınca önceki olasılıklar kaybolur. Performans ölçümü
-- "o gün yayımlanan" değeri değil "en son yazılan" değeri görür. Bu tablo her
-- yayın olayını ekler; asla güncellenmez/silinmez. Settlement alanları BURADA
-- YOKTUR — sonuç engine_predictions'ta kalır, geçmiş tahminden ayrılır.
--
-- Uygulama sırası: (1) tablo, (2) tetikleyici, (3) opsiyonel backfill.
-- Geri dönüş: en altta.
-- ============================================================================

create table if not exists public.engine_prediction_history (
  id                  bigint generated always as identity primary key,
  prediction_id       bigint      not null,               -- engine_predictions.id (FK yok: satır silinse de tarihçe kalsın)
  fixture_id          bigint      not null,
  model_version       text        not null,
  op                  text        not null check (op in ('insert','update','backfill')),
  -- Yayın zamanı: tetikleyici için now(); backfill için NULL (bilinmiyorsa uydurulmaz).
  issued_at           timestamptz,
  -- Modelin gördüğü verinin kesim anı; ingest bunu göndermiyorsa NULL kalır (sonradan doldurulmaz).
  feature_as_of       timestamptz,
  kickoff_at_issue    timestamptz,
  calibration_version text,                               -- confidence_calibration.fitted_at / segment; NULL = bilinmiyor
  p_raw               jsonb       not null,               -- {p_home,p_draw,p_away,p_over25,p_btts_yes,lambda_home,lambda_away,pick,confidence}
  p_calibrated        jsonb,                              -- gösterim anında hesaplanıyorsa NULL; kayıt altına alınırsa {pick,ou25,btts}
  source              text        not null default 'ingest',  -- 'ingest' | 'manual' | 'backfill'
  quality_flags       jsonb       not null default '{}'::jsonb, -- {"issued_after_kickoff":bool,"backfilled":bool,"issued_at_source":"created_at|null"}
  created_at          timestamptz not null default now()
);

create index if not exists idx_eph_fixture on public.engine_prediction_history (fixture_id, model_version, created_at desc);
create index if not exists idx_eph_prediction on public.engine_prediction_history (prediction_id);

alter table public.engine_prediction_history enable row level security;
drop policy if exists "eph read" on public.engine_prediction_history;
create policy "eph read" on public.engine_prediction_history for select using (true);
-- Yazma yalnız service_role (RLS'i baypas eder). UPDATE/DELETE politikası bilinçli olarak YOK.

-- ---------------------------------------------------------------------------
-- Tetikleyici: yalnız TAHMİN sütunları değişince kayıt düşer; settlement
-- (home_score, away_score, result, correct, settled) güncellemeleri tarihçeye
-- girmez.
-- ---------------------------------------------------------------------------
create or replace function public.log_engine_prediction()
returns trigger language plpgsql as $$
declare
  v_op text := lower(tg_op);
begin
  if tg_op = 'UPDATE' then
    if new.p_home is not distinct from old.p_home
       and new.p_draw is not distinct from old.p_draw
       and new.p_away is not distinct from old.p_away
       and new.p_over25 is not distinct from old.p_over25
       and new.p_btts_yes is not distinct from old.p_btts_yes
       and new.lambda_home is not distinct from old.lambda_home
       and new.lambda_away is not distinct from old.lambda_away
       and new.pick is not distinct from old.pick
       and new.confidence is not distinct from old.confidence
       and new.model_version is not distinct from old.model_version then
      return new; -- yalnız settlement/metadata değişti
    end if;
  end if;

  insert into public.engine_prediction_history
    (prediction_id, fixture_id, model_version, op, issued_at, kickoff_at_issue, p_raw, source, quality_flags)
  values (
    new.id, new.fixture_id, new.model_version, v_op, now(), new.kickoff,
    jsonb_build_object(
      'p_home', new.p_home, 'p_draw', new.p_draw, 'p_away', new.p_away,
      'p_over25', new.p_over25, 'p_btts_yes', new.p_btts_yes,
      'lambda_home', new.lambda_home, 'lambda_away', new.lambda_away,
      'pick', new.pick, 'confidence', new.confidence),
    'ingest',
    jsonb_build_object('issued_after_kickoff', (new.kickoff is not null and now() > new.kickoff))
  );
  return new;
end $$;

drop trigger if exists trg_log_engine_prediction on public.engine_predictions;
create trigger trg_log_engine_prediction
  after insert or update on public.engine_predictions
  for each row execute function public.log_engine_prediction();

-- ---------------------------------------------------------------------------
-- Opsiyonel backfill (bir kez). issued_at bilinmediği için NULL bırakılır;
-- created_at ayrı bir bayrakla işaretlenir — geçmiş yayın zamanı UYDURULMAZ.
-- ---------------------------------------------------------------------------
-- insert into public.engine_prediction_history
--   (prediction_id, fixture_id, model_version, op, issued_at, kickoff_at_issue, p_raw, source, quality_flags, created_at)
-- select id, fixture_id, model_version, 'backfill', null, kickoff,
--   jsonb_build_object('p_home', p_home, 'p_draw', p_draw, 'p_away', p_away, 'p_over25', p_over25, 'p_btts_yes', p_btts_yes,
--                      'lambda_home', lambda_home, 'lambda_away', lambda_away, 'pick', pick, 'confidence', confidence),
--   'backfill', jsonb_build_object('backfilled', true, 'issued_at_source', null, 'row_created_at', created_at, 'row_updated_at', updated_at),
--   now()
-- from public.engine_predictions
-- where not exists (select 1 from public.engine_prediction_history h where h.prediction_id = engine_predictions.id);

-- ---------------------------------------------------------------------------
-- GERİ DÖNÜŞ
-- ---------------------------------------------------------------------------
-- drop trigger if exists trg_log_engine_prediction on public.engine_predictions;
-- drop function if exists public.log_engine_prediction();
-- drop table if exists public.engine_prediction_history;
