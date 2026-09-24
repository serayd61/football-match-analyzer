-- ============================================================================
-- Denetim B02 (2026-09-19): ücretli motor verisi anon/authenticated ile
-- PostgREST'ten okunamasın. ELLE ÇALIŞTIRILACAK (Supabase SQL editörü).
-- Site bu tabloları yalnız sunucuda service_role ile okur (RLS baypas) → etkilenmez.
-- Canlıda doğrulandı (2026-09-19): hepsinde "SELECT USING (true)" + anon SELECT/INSERT/UPDATE grant var;
-- anon key ile /rest/v1/engine_predictions satır döndürüyor.
-- 2026-09-18_paid_tables_no_anon_read.sql taslağının üst kümesidir (o dosya ayrıca çalıştırılmaz).
-- Geri alma: create policy "<ad>" on public.<tablo> for select using (true);
--            grant select on public.<tablo> to anon, authenticated;
-- ============================================================================
do $$
declare t text; p record;
begin
  foreach t in array array['engine_predictions','engine_prediction_history','prediction_odds',
    'engine_model_versions','engine_version_pairs','engine_weekly_metrics','engine_weekly_reports',
    'engine_calibration_bins','autolearn_model','autolearn_predictions'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
