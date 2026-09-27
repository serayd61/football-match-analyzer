-- ============================================================================
-- confidence_calibration — dış örneklem (holdout) ölçüm sütunları (TASLAK)
-- ----------------------------------------------------------------------------
-- brier_before/brier_after eğrinin FIT EDİLDİĞİ noktalar üzerinde ölçülür
-- (eğitim ölçümü). fit-calibration cron'u artık kronolojik %20 holdout ile
-- dış örneklem etkisini de hesaplar; bu sütunlar yoksa eski şemaya düşer.
-- ============================================================================
alter table public.confidence_calibration
  add column if not exists brier_holdout_before numeric,
  add column if not exists brier_holdout_after  numeric,
  add column if not exists n_holdout            integer not null default 0,
  add column if not exists fit_from             timestamptz,
  add column if not exists fit_to               timestamptz;

comment on column public.confidence_calibration.brier_after is 'IN-SAMPLE: measured on the same rows the curve was fitted on (training-set figure).';
comment on column public.confidence_calibration.brier_holdout_after is 'OUT-OF-SAMPLE: curve fitted on the first 80% (chronological), scored on the last 20%.';

-- GERİ DÖNÜŞ
-- alter table public.confidence_calibration
--   drop column if exists brier_holdout_before, drop column if exists brier_holdout_after,
--   drop column if exists n_holdout, drop column if exists fit_from, drop column if exists fit_to;
