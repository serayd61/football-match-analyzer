-- ============================================================================
-- Hangi migration canlıda uygulanmış? (SALT OKUMA — Supabase SQL editöründe çalıştır)
-- Her migration'ın bıraktığı bir "imza" nesnesini (tablo/sütun/fonksiyon/tetikleyici/
-- kısıt) kontrol eder. applied=false olanlar henüz çalıştırılmamış demektir.
-- Supabase CLI'ye geçerken applied=true olanları şu komutla işaretle:
--   supabase migration repair --status applied <version>
-- ============================================================================
with sig(version, name, applied) as (values
  ('20260905010000', 'confidence_calibration_holdout',
     exists (select 1 from information_schema.columns where table_schema='public' and table_name='confidence_calibration' and column_name='brier_holdout_after')),
  ('20260905020000', 'engine_prediction_history',
     exists (select 1 from pg_trigger where tgname='trg_log_engine_prediction')),
  ('20260907010000', 'engine_model_versions',
     to_regclass('public.engine_model_versions') is not null),
  ('20260907020000', 'engine_predictions_market_scores',
     exists (select 1 from information_schema.columns where table_schema='public' and table_name='engine_predictions' and column_name='ll_1x2')),
  ('20260907030000', 'engine_weekly_review',
     to_regclass('public.engine_learning_log') is not null),
  ('20260912010000', 'site_daily_picks',
     to_regclass('public.site_daily_picks') is not null),
  ('20260913010000', 'prediction_odds_btts',
     exists (select 1 from information_schema.columns where table_schema='public' and table_name='prediction_odds' and column_name='btts_yes_odds')),
  ('20260913020000', 'site_showcase_picks',
     to_regclass('public.site_showcase_picks') is not null),
  ('20260914010000', 'af_fixture_context',
     to_regclass('public.af_fixture_context') is not null),
  ('20260914020000', 'api_football',
     to_regclass('public.af_fixture_map') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='prediction_odds' and column_name='over25_odds')),
  ('20260917010000', 'social_posts',
     to_regclass('public.social_posts') is not null),
  ('20260918010000', 'paid_tables_no_anon_read',
     not has_table_privilege('anon', 'public.engine_predictions', 'select')),
  ('20260918020000', 'showcase_frozen_guard',
     exists (select 1 from pg_trigger where tgname='trg_showcase_frozen_guard')),
  ('20260919010000', 'activate_engine_version_rpc',
     exists (select 1 from pg_proc where proname='activate_engine_version')),
  ('20260919020000', 'paid_engine_tables_no_anon',
     not has_table_privilege('anon', 'public.prediction_odds', 'select')),
  ('20260922010000', 'league_coverage',
     to_regclass('public.league_coverage') is not null),
  ('20260923010000', 'tier_b_picks',
     to_regclass('public.tier_b_picks') is not null),
  ('20260924010000', 'league_coverage_hidden',
     exists (select 1 from pg_constraint where conname='league_coverage_status_check'
             and pg_get_constraintdef(oid) like '%hidden%'))
)
select version, name, applied from sig order by version;
