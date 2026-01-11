-- ============================================================================
-- DATABASE SCHEMA OPTIMIZATION
-- Index analizi ve performans iyileştirmeleri
-- ============================================================================

-- ============================================================================
-- ANALİZ EDİLEN QUERY PATTERN'LERİ:
-- 1. fixture_id ile sorgular (en çok kullanılan)
-- 2. is_settled ile filtreleme + date sıralama
-- 3. League filtreleme
-- 4. Boolean field'lar ile filtreleme (btts_correct, match_result_correct)
-- 5. Date range sorguları (created_at, match_date)
-- ============================================================================

-- ============================================================================
-- 1. AGENT_ANALYSIS TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler:
-- - idx_agent_analysis_fixture_id (fixture_id)
-- - idx_agent_analysis_analyzed_at (analyzed_at DESC)
-- - idx_agent_analysis_settled (is_settled) WHERE is_settled = FALSE

-- ✅ Eklenmesi önerilen index'ler:

-- Composite index: settled + date (en çok kullanılan query pattern)
CREATE INDEX IF NOT EXISTS idx_agent_analysis_settled_date 
ON agent_analysis(is_settled, analyzed_at DESC)
WHERE is_settled = TRUE; -- Partial index (sadece settled olanlar için)

-- Composite index: league + date (league filtreleme ile tarih sıralama)
CREATE INDEX IF NOT EXISTS idx_agent_analysis_league_date 
ON agent_analysis(league, analyzed_at DESC);

-- Index: risk_level (filtering için)
CREATE INDEX IF NOT EXISTS idx_agent_analysis_risk_level 
ON agent_analysis(risk_level)
WHERE risk_level IN ('low', 'medium'); -- Partial index (yüksek risk olmayanlar için)

-- Composite index: overall_confidence + agreement (analytics için)
CREATE INDEX IF NOT EXISTS idx_agent_analysis_confidence 
ON agent_analysis(overall_confidence DESC, agreement DESC)
WHERE is_settled = TRUE; -- Sadece settled olanlar için analytics

-- JSONB index: agent_results (JSON query'ler için)
CREATE INDEX IF NOT EXISTS idx_agent_analysis_agent_results_gin 
ON agent_analysis USING GIN (agent_results);

-- ============================================================================
-- 2. SMART_ANALYSIS TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler:
-- - idx_smart_analysis_fixture_id (fixture_id)
-- - idx_smart_analysis_match_date (match_date)
-- - idx_smart_analysis_is_settled (is_settled)
-- - idx_smart_analysis_created_at (created_at DESC)

-- ✅ Eklenmesi önerilen index'ler:

-- Composite index: settled + match_date (en çok kullanılan)
CREATE INDEX IF NOT EXISTS idx_smart_analysis_settled_date 
ON smart_analysis(is_settled, match_date DESC)
WHERE is_settled = TRUE;

-- Composite index: league + match_date (league filtreleme)
CREATE INDEX IF NOT EXISTS idx_smart_analysis_league_date 
ON smart_analysis(league, match_date DESC);

-- Composite index: data_quality + overall_confidence (analytics)
CREATE INDEX IF NOT EXISTS idx_smart_analysis_quality_confidence 
ON smart_analysis(data_quality, overall_confidence DESC)
WHERE is_settled = TRUE;

-- JSONB index: analysis (JSON query'ler için)
CREATE INDEX IF NOT EXISTS idx_smart_analysis_analysis_gin 
ON smart_analysis USING GIN (analysis);

-- Composite index: prediction fields (filtering için)
CREATE INDEX IF NOT EXISTS idx_smart_analysis_predictions 
ON smart_analysis(match_result_prediction, btts_prediction, over_under_prediction)
WHERE is_settled = FALSE; -- Sadece pending olanlar için

-- ============================================================================
-- 3. UNIFIED_ANALYSIS TABLE OPTIMIZATION
-- ============================================================================

-- ⚠️ unified_analysis tablosu için mevcut index'leri kontrol etmek gerekir
-- Bu tablo en çok kullanılan tablolardan biri

-- Önerilen index'ler:

-- Primary lookup: fixture_id (muhtemelen zaten var)
CREATE INDEX IF NOT EXISTS idx_unified_analysis_fixture_id 
ON unified_analysis(fixture_id);

-- Composite: settled + match_date (en çok kullanılan query pattern)
CREATE INDEX IF NOT EXISTS idx_unified_analysis_settled_date 
ON unified_analysis(is_settled, match_date DESC)
WHERE is_settled = TRUE;

-- Composite: settled + created_at (recent predictions)
CREATE INDEX IF NOT EXISTS idx_unified_analysis_settled_created 
ON unified_analysis(is_settled, created_at DESC)
WHERE is_settled = FALSE; -- Sadece pending olanlar için

-- Composite: league + match_date (league filtreleme)
CREATE INDEX IF NOT EXISTS idx_unified_analysis_league_date 
ON unified_analysis(league, match_date DESC)
WHERE league IS NOT NULL;

-- Boolean field combinations (accuracy queries için)
CREATE INDEX IF NOT EXISTS idx_unified_analysis_correctness 
ON unified_analysis(match_result_correct, over_under_correct, btts_correct)
WHERE is_settled = TRUE; -- Sadece settled olanlar için analytics

-- JSONB index: analysis JSON (eğer JSONB field varsa)
-- CREATE INDEX IF NOT EXISTS idx_unified_analysis_analysis_gin 
-- ON unified_analysis USING GIN (analysis);

-- ============================================================================
-- 4. PREDICTION_SESSIONS TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler (enhanced_prediction_tracking.sql'den):
-- - idx_sessions_fixture (fixture_id)
-- - idx_sessions_date (match_date)
-- - idx_sessions_source (prediction_source)
-- - idx_sessions_settled (is_settled)
-- - idx_sessions_created (created_at DESC)

-- ✅ Eklenmesi önerilen index'ler:

-- Composite: settled + date + source (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_sessions_settled_date_source 
ON prediction_sessions(is_settled, match_date DESC, prediction_source)
WHERE is_settled = TRUE;

-- Composite: source + date (model performance queries)
CREATE INDEX IF NOT EXISTS idx_sessions_source_date 
ON prediction_sessions(prediction_source, match_date DESC);

-- Boolean combinations (accuracy analysis)
CREATE INDEX IF NOT EXISTS idx_sessions_correctness 
ON prediction_sessions(btts_correct, over_under_correct, match_result_correct)
WHERE is_settled = TRUE;

-- Unique constraint zaten var: UNIQUE(fixture_id, prediction_source)
-- Bu da bir index oluşturur

-- ============================================================================
-- 5. AI_MODEL_PREDICTIONS TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler:
-- - idx_model_preds_session (session_id)
-- - idx_model_preds_model (model_name)
-- - idx_model_preds_created (created_at DESC)

-- ✅ Eklenmesi önerilen index'ler:

-- Composite: model + correctness (model performance)
CREATE INDEX IF NOT EXISTS idx_model_preds_model_correctness 
ON ai_model_predictions(model_name, btts_correct, over_under_correct, match_result_correct);

-- Composite: session + model (lookup için)
CREATE INDEX IF NOT EXISTS idx_model_preds_session_model 
ON ai_model_predictions(session_id, model_name);

-- JSONB index: raw_response (eğer query edilmesi gerekiyorsa)
CREATE INDEX IF NOT EXISTS idx_model_preds_raw_response_gin 
ON ai_model_predictions USING GIN (raw_response);

-- ============================================================================
-- 6. PROFESSIONAL_MARKET_PREDICTIONS TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler:
-- - idx_pro_market_fixture (fixture_id)
-- - idx_pro_market_date (match_date)
-- - idx_pro_market_settled (is_settled)
-- - idx_pro_market_created (created_at DESC)

-- ✅ Eklenmesi önerilen index'ler:

-- Composite: settled + date (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_pro_market_settled_date 
ON professional_market_predictions(is_settled, match_date DESC)
WHERE is_settled = TRUE;

-- Composite: safe bets correctness (analytics)
CREATE INDEX IF NOT EXISTS idx_pro_market_safe_bets 
ON professional_market_predictions(safe_bet_1_correct, safe_bet_2_correct)
WHERE is_settled = TRUE;

-- ============================================================================
-- 7. DAILY_MODEL_SUMMARY TABLE OPTIMIZATION
-- ============================================================================

-- Mevcut index'ler:
-- - idx_daily_date (summary_date DESC)
-- - idx_daily_model (model_name)

-- ✅ Eklenmesi önerilen index'ler:

-- Composite: date + model (en çok kullanılan query)
CREATE INDEX IF NOT EXISTS idx_daily_date_model 
ON daily_model_summary(summary_date DESC, model_name);

-- Composite: model + accuracy (leaderboard queries)
CREATE INDEX IF NOT EXISTS idx_daily_model_accuracy 
ON daily_model_summary(model_name, daily_accuracy DESC)
WHERE summary_date >= CURRENT_DATE - INTERVAL '30 days'; -- Partial index (son 30 gün)

-- ============================================================================
-- 8. TABLE STATISTICS UPDATE
-- ============================================================================

-- PostgreSQL'in query planner'ına yardımcı olmak için statistics güncelle
-- Büyük tablolarda performansı artırır

-- ANALYZE komutları (en çok kullanılan tablolar için)
ANALYZE agent_analysis;
ANALYZE smart_analysis;
ANALYZE unified_analysis;
ANALYZE prediction_sessions;
ANALYZE ai_model_predictions;
ANALYZE professional_market_predictions;
ANALYZE daily_model_summary;

-- ============================================================================
-- 9. PARTIAL INDEX BEST PRACTICES
-- ============================================================================

-- Partial index'ler daha küçük ve hızlıdır
-- WHERE clause ile sadece ilgili row'ları index'ler

-- Örnek: Sadece unsettled predictions için index
-- CREATE INDEX idx_unified_analysis_pending 
-- ON unified_analysis(fixture_id, created_at DESC)
-- WHERE is_settled = FALSE;

-- Örnek: Sadece yüksek güven için index
-- CREATE INDEX idx_unified_analysis_high_confidence 
-- ON unified_analysis(fixture_id, overall_confidence)
-- WHERE overall_confidence >= 70;

-- ============================================================================
-- 10. QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Yavaş query'leri tespit etmek için (pg_stat_statements extension gerekir)
-- Bu extension'ı enable etmek için:

-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- SELECT pg_reload_conf();

-- Yavaş query'leri görüntüle:
-- SELECT query, calls, total_exec_time, mean_exec_time
-- FROM pg_stat_statements
-- WHERE mean_exec_time > 100 -- 100ms'den yavaş query'ler
-- ORDER BY mean_exec_time DESC
-- LIMIT 20;

-- ============================================================================
-- 11. VACUUM & MAINTENANCE
-- ============================================================================

-- Büyük tablolarda VACUUM ve ANALYZE düzenli yapılmalı
-- Supabase otomatik yapıyor ama manuel de yapılabilir:

-- VACUUM ANALYZE agent_analysis;
-- VACUUM ANALYZE smart_analysis;
-- VACUUM ANALYZE unified_analysis;

-- ============================================================================
-- 12. CONNECTION POOLING RECOMMENDATIONS
-- ============================================================================

-- Supabase connection pooling kullanılıyorsa:
-- - Transaction mode: Genel kullanım için
-- - Session mode: Supabase client'lar için

-- Connection limit'leri:
-- - Free tier: 50 connections
-- - Pro tier: 200 connections
-- - Team tier: Custom

-- ============================================================================
-- ÖZET
-- ============================================================================

-- ✅ Öncelikli index'ler:
-- 1. Composite index: is_settled + date (tüm ana tablolar için)
-- 2. Composite index: league + date (filtreleme için)
-- 3. Partial index'ler: WHERE clause ile optimize edilmiş
-- 4. JSONB GIN index'ler: JSON field query'leri için

-- ⚠️ Dikkat:
-- - Her index INSERT/UPDATE'i yavaşlatır
-- - Index sayısını minimize etmeye çalış
-- - Composite index'ler tekli index'lerden genelde daha iyi
-- - Partial index'ler daha küçük ve hızlı

-- 📊 Monitoring:
-- - pg_stat_statements ile yavaş query'leri izle
-- - Index kullanımını pg_stat_user_indexes ile kontrol et
-- - UNUSED index'leri kaldır

-- ============================================================================
-- DONE!
-- ============================================================================
