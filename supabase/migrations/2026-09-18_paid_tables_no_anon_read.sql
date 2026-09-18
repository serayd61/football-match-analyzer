-- ============================================================================
-- Ücretli tahmin verisi: anon/authenticated doğrudan okuyamasın (TASLAK, uygulanmadı)
-- ----------------------------------------------------------------------------
-- Denetim 2026-09-18 (B02). engine_predictions "using (true)" politikası site
-- herkese açıkken yazıldı; 2026-09-08'de üyelik duvarı geldi ama politika kaldı.
-- Site bu tabloları yalnız sunucuda service_role ile okur (src/lib/site/db.ts,
-- 'server-only'); service_role RLS'i baypas ettiği için bu değişiklik siteyi
-- ETKİLEMEZ. Yeni tablolar (site_daily_picks, site_showcase_picks) zaten
-- politikasız RLS ile aynı durumda.
--
-- UYGULAMADAN ÖNCE üretimde kontrol et:
--   1) Vercel'de SUPABASE_SERVICE_ROLE_KEY dolu mu? (db.ts yoksa anon'a düşer →
--      bu migration'dan sonra site boş döner.)
--   2) select policyname, roles, cmd, qual from pg_policies
--        where tablename in ('engine_predictions','engine_prediction_history','autolearn_model','autolearn_predictions');
--   3) select grantee, privilege_type from information_schema.role_table_grants
--        where table_name in ('engine_predictions','autolearn_model','autolearn_predictions') and grantee in ('anon','authenticated');
--   4) n8n / dış araçlar bu tabloları anon key ile okuyor mu?
-- Geri alma: aşağıdaki policy'yi yeniden oluştur (supabase/engine_predictions.sql:69).
-- ============================================================================

drop policy if exists "engine_predictions read" on public.engine_predictions;
revoke select on public.engine_predictions from anon, authenticated;

-- autolearn_*: anon'a GRANT ALL + FOR ALL USING (true) → anon key'i olan herkes
-- model ağırlıklarını yazabiliyordu. Uygulama service_role kullanır.
drop policy if exists "autolearn_model_all" on public.autolearn_model;
drop policy if exists "autolearn_predictions_all" on public.autolearn_predictions;
revoke all on public.autolearn_model from anon, authenticated;
revoke all on public.autolearn_predictions from anon, authenticated;
