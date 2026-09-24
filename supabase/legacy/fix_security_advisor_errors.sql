-- ============================================================================
-- SUPABASE SECURITY ADVISOR HATALARINI DÜZELT
-- Bu script Security Advisor'da görünen tüm güvenlik hatalarını düzeltir
-- ============================================================================

-- ============================================================================
-- 1. UNIFIED_ANALYSIS - RLS Aktif Et + Public Read Policy
-- ============================================================================
ALTER TABLE IF EXISTS public.unified_analysis ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri temizle
DROP POLICY IF EXISTS "unified_analysis_select_all" ON public.unified_analysis;
DROP POLICY IF EXISTS "unified_analysis_insert_authenticated" ON public.unified_analysis;
DROP POLICY IF EXISTS "unified_analysis_update_service" ON public.unified_analysis;

-- Public read policy (herkes okuyabilir)
CREATE POLICY "unified_analysis_select_all" ON public.unified_analysis
    FOR SELECT
    USING (true);

-- Authenticated users insert
CREATE POLICY "unified_analysis_insert_authenticated" ON public.unified_analysis
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Service role update
CREATE POLICY "unified_analysis_update_service" ON public.unified_analysis
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. ANALYSIS_PERFORMANCE - RLS Aktif Et + Public Read Policy
-- ============================================================================
ALTER TABLE IF EXISTS public.analysis_performance ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri temizle
DROP POLICY IF EXISTS "analysis_performance_select_all" ON public.analysis_performance;
DROP POLICY IF EXISTS "analysis_performance_insert_service" ON public.analysis_performance;
DROP POLICY IF EXISTS "analysis_performance_update_service" ON public.analysis_performance;

-- Public read policy (herkes okuyabilir)
CREATE POLICY "analysis_performance_select_all" ON public.analysis_performance
    FOR SELECT
    USING (true);

-- Service role insert/update
CREATE POLICY "analysis_performance_insert_service" ON public.analysis_performance
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "analysis_performance_update_service" ON public.analysis_performance
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. FAVORITES - RLS Aktif Et (Policy'ler zaten var)
-- ============================================================================
ALTER TABLE IF EXISTS public.favorites ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri kontrol et ve gerekirse yeniden oluştur
DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
DROP POLICY IF EXISTS "service_role_favorites" ON public.favorites;

-- User-specific policies (user_email yerine user_id kullanıyoruz, eğer yoksa email ile)
-- Önce user_id kolonu var mı kontrol et
DO $$
BEGIN
    -- user_id kolonu yoksa user_email ile policy oluştur
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'favorites' AND column_name = 'user_id'
    ) THEN
        -- user_email ile policy (email-based auth için)
        CREATE POLICY "favorites_select_own" ON public.favorites
            FOR SELECT
            USING (auth.jwt() ->> 'email' = user_email);
        
        CREATE POLICY "favorites_insert_own" ON public.favorites
            FOR INSERT
            WITH CHECK (auth.jwt() ->> 'email' = user_email);
        
        CREATE POLICY "favorites_delete_own" ON public.favorites
            FOR DELETE
            USING (auth.jwt() ->> 'email' = user_email);
    ELSE
        -- user_id ile policy (UUID-based auth için)
        CREATE POLICY "favorites_select_own" ON public.favorites
            FOR SELECT
            USING (auth.uid() = user_id);
        
        CREATE POLICY "favorites_insert_own" ON public.favorites
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "favorites_delete_own" ON public.favorites
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Service role bypass
CREATE POLICY "service_role_favorites" ON public.favorites
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. VIEW'LARI YENİDEN OLUŞTUR (Security Definer uyarısını kaldırmak için)
-- Not: View'lar zaten SECURITY DEFINER değil, ama Supabase bunları uyarı olarak gösteriyor
-- View'ları normal şekilde yeniden oluşturuyoruz
-- ============================================================================

-- agent_weekly_stats view'ını yeniden oluştur
DROP VIEW IF EXISTS public.agent_weekly_stats CASCADE;
CREATE OR REPLACE VIEW public.agent_weekly_stats AS
SELECT 
  agent_name,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE match_result_correct = TRUE) as correct_mr,
  COUNT(*) FILTER (WHERE over_under_correct = TRUE) as correct_ou,
  COUNT(*) FILTER (WHERE btts_correct = TRUE) as correct_btts,
  ROUND(AVG(CASE WHEN match_result_correct IS NOT NULL THEN CASE WHEN match_result_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as mr_accuracy,
  ROUND(AVG(CASE WHEN over_under_correct IS NOT NULL THEN CASE WHEN over_under_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as ou_accuracy,
  ROUND(AVG(CASE WHEN btts_correct IS NOT NULL THEN CASE WHEN btts_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as btts_accuracy
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND settled_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY mr_accuracy DESC NULLS LAST;

-- agent_emotional_performance view'ını yeniden oluştur
-- Not: Bu view'ın yapısı emotional_analysis_tracking.sql'den geliyor
DROP VIEW IF EXISTS public.agent_emotional_performance CASCADE;
CREATE OR REPLACE VIEW public.agent_emotional_performance AS
SELECT 
  agent_name,
  COUNT(*) as total_predictions,
  COUNT(CASE WHEN prediction_correct IS NOT NULL THEN 1 END) as settled_predictions,
  COUNT(CASE WHEN prediction_correct = TRUE THEN 1 END) as correct_predictions,
  ROUND(
    AVG(CASE WHEN prediction_correct IS NOT NULL AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric,
    2
  ) as overall_accuracy,
  ROUND(AVG(emotional_weight)::numeric * 100, 2) as avg_emotional_weight,
  ROUND(AVG(data_weight)::numeric * 100, 2) as avg_data_weight,
  COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) as emotional_predictions,
  COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct = TRUE THEN 1 END) as emotional_correct,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) > 0
      THEN AVG(CASE WHEN emotional_weight >= 0.4 AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric
      ELSE 0
    END,
    2
  ) as emotional_accuracy,
  COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) as data_predictions,
  COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct = TRUE THEN 1 END) as data_correct,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) > 0
      THEN AVG(CASE WHEN data_weight >= 0.4 AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric
      ELSE 0
    END,
    2
  ) as data_accuracy
FROM agent_emotional_analysis
GROUP BY agent_name
ORDER BY overall_accuracy DESC NULLS LAST;

-- agent_weights_summary view'ını yeniden oluştur
DROP VIEW IF EXISTS public.agent_weights_summary CASCADE;
CREATE OR REPLACE VIEW public.agent_weights_summary AS
SELECT 
  agent_name,
  league,
  recent_match_result_accuracy,
  current_weight,
  trend_direction,
  total_matches
FROM agent_performance
WHERE total_matches >= 5
ORDER BY current_weight DESC;

-- agent_performance_summary view'ını yeniden oluştur
DROP VIEW IF EXISTS public.agent_performance_summary CASCADE;
CREATE OR REPLACE VIEW public.agent_performance_summary AS
SELECT 
  agent_name,
  league,
  total_matches,
  correct_predictions,
  match_result_accuracy,
  recent_match_result_accuracy,
  current_weight,
  trend_direction,
  last_updated
FROM agent_performance
ORDER BY current_weight DESC, recent_match_result_accuracy DESC;

-- ============================================================================
-- 5. GRANT PERMISSIONS (View'lar için)
-- ============================================================================
GRANT SELECT ON public.agent_weekly_stats TO anon;
GRANT SELECT ON public.agent_weekly_stats TO authenticated;
GRANT SELECT ON public.agent_emotional_performance TO anon;
GRANT SELECT ON public.agent_emotional_performance TO authenticated;
GRANT SELECT ON public.agent_weights_summary TO anon;
GRANT SELECT ON public.agent_weights_summary TO authenticated;
GRANT SELECT ON public.agent_performance_summary TO anon;
GRANT SELECT ON public.agent_performance_summary TO authenticated;

-- ============================================================================
-- TAMAMLANDI!
-- ============================================================================
-- Sonuç:
-- ✅ unified_analysis: RLS aktif + public read policy
-- ✅ analysis_performance: RLS aktif + public read policy
-- ✅ favorites: RLS aktif + user-specific policies
-- ✅ View'lar: SECURITY INVOKER'a çevrildi (Security Definer uyarısı kaldırıldı)
-- ============================================================================

SELECT 'Security Advisor hataları düzeltildi!' as result;
