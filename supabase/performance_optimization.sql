-- ============================================================================
-- PERFORMANCE PAGE OPTIMIZATION
-- Index'ler ve Materialized View'lar
-- unified_analysis tablosunu kullanır (mevcut veriler)
-- ============================================================================

-- ============================================================================
-- 1. UNIFIED_ANALYSIS TABLE - COMPOSITE INDEXES
-- ============================================================================

-- Settled + date için hızlı sorgular (en çok kullanılan pattern)
CREATE INDEX IF NOT EXISTS idx_ua_settled_date 
ON unified_analysis(is_settled, match_date DESC);

-- League + settled + date için filtreleme
CREATE INDEX IF NOT EXISTS idx_ua_league_settled_date 
ON unified_analysis(league, is_settled, match_date DESC);

-- Pending analizler için (settled = false)
CREATE INDEX IF NOT EXISTS idx_ua_pending 
ON unified_analysis(created_at DESC)
WHERE is_settled = FALSE OR is_settled IS NULL;

-- Confidence filtreleme için
CREATE INDEX IF NOT EXISTS idx_ua_confidence 
ON unified_analysis(match_result_confidence, over_under_confidence, btts_confidence)
WHERE is_settled = TRUE;

-- ============================================================================
-- 2. ANALYSIS_PERFORMANCE TABLE - COMPOSITE INDEXES (varsa)
-- ============================================================================

-- Settled + date için
CREATE INDEX IF NOT EXISTS idx_ap_settled_date 
ON analysis_performance(match_settled, match_date DESC);

-- League + settled + date
CREATE INDEX IF NOT EXISTS idx_ap_league_settled_date 
ON analysis_performance(league, match_settled, match_date DESC);

-- ============================================================================
-- 3. MATERIALIZED VIEW - AGENT PERFORMANCE STATS
-- unified_analysis tablosundan okur
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_agent_performance_stats;

CREATE MATERIALIZED VIEW mv_agent_performance_stats AS
SELECT 
  'consensus' as agent_name,
  COUNT(*) as total_matches,
  SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END) as mr_correct,
  ROUND((SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as mr_accuracy,
  SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END) as ou_correct,
  ROUND((SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as ou_accuracy,
  SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END) as btts_correct,
  ROUND((SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as btts_accuracy,
  ROUND((
    (SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END) +
     SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END) +
     SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END))::numeric / 
    NULLIF(COUNT(*) * 3, 0)
  ) * 100, 1) as overall_accuracy,
  ROUND(AVG(overall_confidence)::numeric, 1) as avg_confidence
FROM unified_analysis
WHERE is_settled = TRUE;

-- ============================================================================
-- 4. MATERIALIZED VIEW - LEAGUE PERFORMANCE STATS
-- unified_analysis tablosundan okur
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_league_performance_stats;

CREATE MATERIALIZED VIEW mv_league_performance_stats AS
SELECT 
  league,
  COUNT(*) as total_matches,
  SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END) as mr_correct,
  ROUND((SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as mr_accuracy,
  SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END) as ou_correct,
  ROUND((SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as ou_accuracy,
  SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END) as btts_correct,
  ROUND((SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as btts_accuracy,
  ROUND(AVG(overall_confidence)::numeric, 1) as avg_confidence
FROM unified_analysis
WHERE is_settled = TRUE AND league IS NOT NULL
GROUP BY league
ORDER BY total_matches DESC;

-- ============================================================================
-- 5. MATERIALIZED VIEW - DAILY PERFORMANCE TRENDS
-- unified_analysis tablosundan okur
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_daily_performance_trends;

CREATE MATERIALIZED VIEW mv_daily_performance_trends AS
SELECT 
  DATE(match_date) as match_day,
  COUNT(*) as total_matches,
  SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END) as mr_correct,
  ROUND((SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as mr_accuracy,
  SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END) as ou_correct,
  ROUND((SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as ou_accuracy,
  SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END) as btts_correct,
  ROUND((SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as btts_accuracy,
  ROUND(AVG(overall_confidence)::numeric, 1) as avg_confidence
FROM unified_analysis
WHERE is_settled = TRUE AND match_date IS NOT NULL
GROUP BY DATE(match_date)
ORDER BY match_day DESC;

-- ============================================================================
-- 6. MATERIALIZED VIEW - CONFIDENCE ACCURACY (Tarihsel Doğruluk)
-- Güven aralığına göre tarihsel doğruluk oranları
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_confidence_accuracy;

CREATE MATERIALIZED VIEW mv_confidence_accuracy AS
-- Match Result (MS) için güven aralığına göre doğruluk
-- Prediction normalize edilir: home/1 -> '1', away/2 -> '2', draw/x -> 'X'
SELECT 
  'consensus' as source,
  'mr' as market,
  CASE 
    WHEN LOWER(match_result_prediction) IN ('1', 'home') THEN '1'
    WHEN LOWER(match_result_prediction) IN ('2', 'away') THEN '2'
    WHEN LOWER(match_result_prediction) IN ('x', 'draw') THEN 'X'
    ELSE match_result_prediction
  END as prediction,
  (FLOOR(match_result_confidence / 5) * 5)::integer as conf_range_start,
  (FLOOR(match_result_confidence / 5) * 5 + 4)::integer as conf_range_end,
  COUNT(*)::integer as total_matches,
  SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END)::integer as correct,
  ROUND(100.0 * SUM(CASE WHEN match_result_correct = TRUE THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
FROM unified_analysis
WHERE is_settled = TRUE 
  AND match_result_prediction IS NOT NULL 
  AND match_result_confidence IS NOT NULL
GROUP BY 1, 2, 
  CASE 
    WHEN LOWER(match_result_prediction) IN ('1', 'home') THEN '1'
    WHEN LOWER(match_result_prediction) IN ('2', 'away') THEN '2'
    WHEN LOWER(match_result_prediction) IN ('x', 'draw') THEN 'X'
    ELSE match_result_prediction
  END,
  4, 5
HAVING COUNT(*) >= 1  -- En az 1 maç (test için düşürüldü)

UNION ALL

-- Over/Under (O/U) için güven aralığına göre doğruluk
-- Prediction normalize edilir: over/Over -> 'Over', under/Under -> 'Under'
SELECT 
  'consensus' as source,
  'ou' as market,
  CASE 
    WHEN LOWER(over_under_prediction) LIKE '%over%' THEN 'Over'
    WHEN LOWER(over_under_prediction) LIKE '%under%' THEN 'Under'
    ELSE over_under_prediction
  END as prediction,
  (FLOOR(over_under_confidence / 5) * 5)::integer as conf_range_start,
  (FLOOR(over_under_confidence / 5) * 5 + 4)::integer as conf_range_end,
  COUNT(*)::integer as total_matches,
  SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END)::integer as correct,
  ROUND(100.0 * SUM(CASE WHEN over_under_correct = TRUE THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
FROM unified_analysis
WHERE is_settled = TRUE 
  AND over_under_prediction IS NOT NULL 
  AND over_under_confidence IS NOT NULL
GROUP BY 1, 2, 
  CASE 
    WHEN LOWER(over_under_prediction) LIKE '%over%' THEN 'Over'
    WHEN LOWER(over_under_prediction) LIKE '%under%' THEN 'Under'
    ELSE over_under_prediction
  END,
  4, 5
HAVING COUNT(*) >= 1

UNION ALL

-- BTTS için güven aralığına göre doğruluk
-- Prediction normalize edilir: yes/Yes/Evet -> 'Yes', no/No/Hayır -> 'No'
SELECT 
  'consensus' as source,
  'btts' as market,
  CASE 
    WHEN LOWER(btts_prediction) IN ('yes', 'evet', 'var') THEN 'Yes'
    WHEN LOWER(btts_prediction) IN ('no', 'hayır', 'yok') THEN 'No'
    ELSE btts_prediction
  END as prediction,
  (FLOOR(btts_confidence / 5) * 5)::integer as conf_range_start,
  (FLOOR(btts_confidence / 5) * 5 + 4)::integer as conf_range_end,
  COUNT(*)::integer as total_matches,
  SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END)::integer as correct,
  ROUND(100.0 * SUM(CASE WHEN btts_correct = TRUE THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
FROM unified_analysis
WHERE is_settled = TRUE 
  AND btts_prediction IS NOT NULL 
  AND btts_confidence IS NOT NULL
GROUP BY 1, 2, 
  CASE 
    WHEN LOWER(btts_prediction) IN ('yes', 'evet', 'var') THEN 'Yes'
    WHEN LOWER(btts_prediction) IN ('no', 'hayır', 'yok') THEN 'No'
    ELSE btts_prediction
  END,
  4, 5
HAVING COUNT(*) >= 1;

-- ============================================================================
-- 7. REFRESH FUNCTION FOR MATERIALIZED VIEWS
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_agent_performance_stats;
  REFRESH MATERIALIZED VIEW mv_league_performance_stats;
  REFRESH MATERIALIZED VIEW mv_daily_performance_trends;
  REFRESH MATERIALIZED VIEW mv_confidence_accuracy;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON mv_agent_performance_stats TO anon, authenticated, service_role;
GRANT SELECT ON mv_league_performance_stats TO anon, authenticated, service_role;
GRANT SELECT ON mv_daily_performance_trends TO anon, authenticated, service_role;
GRANT SELECT ON mv_confidence_accuracy TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_performance_views() TO anon, authenticated, service_role;

-- ============================================================================
-- 9. UPDATE STATISTICS
-- ============================================================================

ANALYZE unified_analysis;
ANALYZE analysis_performance;

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'Performance optimization completed! Indexes and materialized views created (including mv_confidence_accuracy).' as status;
