-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- Bu script tüm tablolarda güvenlik politikalarını etkinleştirir
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 1: TÜM TABLOLARDA RLS'Yİ ETKİNLEŞTİR
-- ═══════════════════════════════════════════════════════════════════════════

-- Kullanıcı tabloları
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_daily_usage ENABLE ROW LEVEL SECURITY;

-- Tahmin ve analiz tabloları
ALTER TABLE IF EXISTS public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prediction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.match_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.match_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.match_results ENABLE ROW LEVEL SECURITY;

-- Kupon tabloları
ALTER TABLE IF EXISTS public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coupon_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_predictions ENABLE ROW LEVEL SECURITY;

-- Performans ve istatistik tabloları
ALTER TABLE IF EXISTS public.model_performance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quad_brain_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Diğer tablolar
ALTER TABLE IF EXISTS public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ip_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 2: MEVCUT POLİTİKALARI SİL (Temiz başlangıç için)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 3: KULLANICI TABLOLARI İÇİN POLİTİKALAR
-- ═══════════════════════════════════════════════════════════════════════════

-- USERS tablosu (id = auth.uid())
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- PROFILES tablosu (id = auth.uid())
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_PROFILES tablosu (user_id = auth.uid())
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SUBSCRIPTIONS tablosu (user_id = auth.uid())
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- USER_ANALYSES tablosu (user_id = auth.uid())
CREATE POLICY "user_analyses_select_own" ON public.user_analyses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_analyses_insert_own" ON public.user_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER_DAILY_USAGE tablosu (user_id = auth.uid())
CREATE POLICY "user_daily_usage_select_own" ON public.user_daily_usage
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_daily_usage_insert_own" ON public.user_daily_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_daily_usage_update_own" ON public.user_daily_usage
    FOR UPDATE USING (auth.uid() = user_id);

-- FAVORITES tablosu (user_id = auth.uid())
CREATE POLICY "favorites_select_own" ON public.favorites
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON public.favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON public.favorites
    FOR DELETE USING (auth.uid() = user_id);

-- PAYMENTS tablosu (user_id = auth.uid())
CREATE POLICY "payments_select_own" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 4: HERKES TARAFINDAN OKUNABİLİR TABLOLAR (Public Read)
-- ═══════════════════════════════════════════════════════════════════════════

-- PREDICTIONS - Herkes okuyabilir (public leaderboard için)
CREATE POLICY "predictions_select_all" ON public.predictions
    FOR SELECT USING (true);
CREATE POLICY "predictions_insert_authenticated" ON public.predictions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- PREDICTION_RECORDS - Herkes okuyabilir
CREATE POLICY "prediction_records_select_all" ON public.prediction_records
    FOR SELECT USING (true);
CREATE POLICY "prediction_records_insert_service" ON public.prediction_records
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "prediction_records_update_service" ON public.prediction_records
    FOR UPDATE USING (auth.role() = 'service_role');

-- PREDICTION_ACCURACY - Herkes okuyabilir
CREATE POLICY "prediction_accuracy_select_all" ON public.prediction_accuracy
    FOR SELECT USING (true);
CREATE POLICY "prediction_accuracy_insert_service" ON public.prediction_accuracy
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- MATCH_RESULTS - Herkes okuyabilir
CREATE POLICY "match_results_select_all" ON public.match_results
    FOR SELECT USING (true);
CREATE POLICY "match_results_insert_service" ON public.match_results
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "match_results_update_service" ON public.match_results
    FOR UPDATE USING (auth.role() = 'service_role');

-- MATCH_ANALYSES - Herkes okuyabilir
CREATE POLICY "match_analyses_select_all" ON public.match_analyses
    FOR SELECT USING (true);
CREATE POLICY "match_analyses_insert_authenticated" ON public.match_analyses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- MATCH_ANALYSIS - Herkes okuyabilir
CREATE POLICY "match_analysis_select_all" ON public.match_analysis
    FOR SELECT USING (true);
CREATE POLICY "match_analysis_insert_authenticated" ON public.match_analysis
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- MODEL_PERFORMANCE_STATS - Herkes okuyabilir
CREATE POLICY "model_performance_stats_select_all" ON public.model_performance_stats
    FOR SELECT USING (true);
CREATE POLICY "model_performance_stats_upsert_service" ON public.model_performance_stats
    FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 5: KUPON TABLOLARI (Public Read, Authenticated Write)
-- ═══════════════════════════════════════════════════════════════════════════

-- COUPONS
CREATE POLICY "coupons_select_all" ON public.coupons
    FOR SELECT USING (true);
CREATE POLICY "coupons_insert_authenticated" ON public.coupons
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "coupons_update_own" ON public.coupons
    FOR UPDATE USING (auth.uid() = user_id);

-- DAILY_COUPONS
CREATE POLICY "daily_coupons_select_all" ON public.daily_coupons
    FOR SELECT USING (true);
CREATE POLICY "daily_coupons_manage_service" ON public.daily_coupons
    FOR ALL USING (auth.role() = 'service_role');

-- COUPON_MATCHES
CREATE POLICY "coupon_matches_select_all" ON public.coupon_matches
    FOR SELECT USING (true);
CREATE POLICY "coupon_matches_insert_authenticated" ON public.coupon_matches
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- DAILY_PICKS
CREATE POLICY "daily_picks_select_all" ON public.daily_picks
    FOR SELECT USING (true);
CREATE POLICY "daily_picks_manage_service" ON public.daily_picks
    FOR ALL USING (auth.role() = 'service_role');

-- DAILY_PREDICTIONS
CREATE POLICY "daily_predictions_select_all" ON public.daily_predictions
    FOR SELECT USING (true);
CREATE POLICY "daily_predictions_manage_service" ON public.daily_predictions
    FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 6: ÖZEL TABLOLAR
-- ═══════════════════════════════════════════════════════════════════════════

-- QUAD_BRAIN_PREDICTIONS
CREATE POLICY "quad_brain_select_all" ON public.quad_brain_predictions
    FOR SELECT USING (true);
CREATE POLICY "quad_brain_insert_authenticated" ON public.quad_brain_predictions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ANALYSIS_CACHE - Herkes okuyabilir, authenticated yazabilir
CREATE POLICY "analysis_cache_select_all" ON public.analysis_cache
    FOR SELECT USING (true);
CREATE POLICY "analysis_cache_insert_authenticated" ON public.analysis_cache
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "analysis_cache_update_authenticated" ON public.analysis_cache
    FOR UPDATE USING (auth.role() = 'authenticated');

-- IP_TRACKING - Sadece service role
CREATE POLICY "ip_tracking_manage_service" ON public.ip_tracking
    FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- ADIM 7: SERVICE ROLE BYPASS (API erişimi için zorunlu)
-- ═══════════════════════════════════════════════════════════════════════════

-- Service role tüm tablolara erişebilmeli (Backend API için)
-- Bu politikalar service_role key kullanıldığında RLS'yi bypass eder

CREATE POLICY "service_role_users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_profiles" ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_user_profiles" ON public.user_profiles
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_subscriptions" ON public.subscriptions
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_user_analyses" ON public.user_analyses
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_user_daily_usage" ON public.user_daily_usage
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_favorites" ON public.favorites
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_payments" ON public.payments
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_coupons" ON public.coupons
    FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- TAMAMLANDI!
-- ═══════════════════════════════════════════════════════════════════════════

-- Sonuç: Tüm tablolarda RLS etkinleştirildi ve güvenlik politikaları oluşturuldu
-- - Kullanıcılar sadece kendi verilerine erişebilir
-- - Public tablolar herkes tarafından okunabilir
-- - Service role tüm tablolara erişebilir (Backend API için)

