-- ============================================================================
-- AGENT LEARNING SYSTEM - STATUS CHECK
-- Sistemin çalışıp çalışmadığını kontrol etmek için sorgular
-- ============================================================================

-- 1. AGENT PREDICTIONS - Bekleyen ve Settle Edilmiş Tahminler
-- ============================================================================
SELECT 
  '📊 AGENT PREDICTIONS ÖZET' as check_type,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE settled_at IS NOT NULL) as settled_count,
  COUNT(*) FILTER (WHERE settled_at IS NULL) as pending_count,
  COUNT(DISTINCT agent_name) as unique_agents,
  COUNT(DISTINCT fixture_id) as unique_fixtures
FROM agent_predictions;

-- 2. SON 7 GÜNDE SETTLE EDİLEN TAHMİNLER
-- ============================================================================
SELECT 
  '📅 SON 7 GÜNDE SETTLE EDİLENLER' as check_type,
  agent_name,
  COUNT(*) as settled_count,
  COUNT(*) FILTER (WHERE match_result_correct = TRUE) as mr_correct,
  COUNT(*) FILTER (WHERE over_under_correct = TRUE) as ou_correct,
  COUNT(*) FILTER (WHERE btts_correct = TRUE) as btts_correct,
  ROUND(
    (COUNT(*) FILTER (WHERE match_result_correct = TRUE)::numeric / 
     NULLIF(COUNT(*) FILTER (WHERE match_result_correct IS NOT NULL), 0)) * 100, 
    2
  ) as mr_accuracy_pct,
  MAX(settled_at) as last_settled
FROM agent_predictions
WHERE settled_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY settled_count DESC;

-- 3. BEKLEYEN TAHMİNLER (Settle Edilmemiş)
-- ============================================================================
SELECT 
  '⏳ BEKLEYEN TAHMİNLER' as check_type,
  agent_name,
  COUNT(*) as pending_count,
  MIN(match_date) as oldest_pending_date,
  MAX(match_date) as newest_pending_date
FROM agent_predictions
WHERE settled_at IS NULL
GROUP BY agent_name
ORDER BY pending_count DESC;

-- 4. AGENT PERFORMANCE - Güncel Performans Metrikleri
-- ============================================================================
SELECT 
  '🎯 AGENT PERFORMANCE' as check_type,
  agent_name,
  league,
  total_predictions,
  recent_30_count,
  recent_30_mr_accuracy,
  recent_30_ou_accuracy,
  recent_30_btts_accuracy,
  current_weight,
  last_updated_at
FROM agent_performance
ORDER BY current_weight DESC, recent_30_mr_accuracy DESC;

-- 5. SON 24 SAATTE SETTLE EDİLEN TAHMİNLER
-- ============================================================================
SELECT 
  '🕐 SON 24 SAATTE SETTLE EDİLENLER' as check_type,
  COUNT(*) as settled_last_24h,
  COUNT(DISTINCT fixture_id) as unique_fixtures,
  COUNT(DISTINCT agent_name) as unique_agents,
  MIN(settled_at) as first_settled,
  MAX(settled_at) as last_settled
FROM agent_predictions
WHERE settled_at >= NOW() - INTERVAL '24 hours';

-- 6. DÜNDEN BUGÜNE GEÇEN MAÇLAR (Settle Edilmemiş)
-- ============================================================================
SELECT 
  '📆 DÜNDEN BUGÜNE BEKLEYEN MAÇLAR' as check_type,
  fixture_id,
  agent_name,
  match_date,
  match_result_prediction,
  over_under_prediction,
  btts_prediction,
  created_at,
  NOW() - created_at as age
FROM agent_predictions
WHERE settled_at IS NULL
  AND match_date >= CURRENT_DATE - INTERVAL '1 day'
  AND match_date < CURRENT_DATE + INTERVAL '1 day'
ORDER BY match_date DESC, fixture_id, agent_name
LIMIT 50;

-- 7. AGENT WEIGHTS - Güncel Ağırlıklar
-- ============================================================================
SELECT 
  '⚖️ AGENT WEIGHTS' as check_type,
  agent_name,
  league,
  weight,
  total_predictions,
  recent_30_mr_accuracy
FROM (
  SELECT 
    agent_name,
    league,
    CASE 
      WHEN recent_30_count >= 10 THEN
        LEAST(2.0, GREATEST(0.5, 
          1.0 + (recent_30_mr_accuracy - 0.5) * 2.0 +
          (recent_30_ou_accuracy - 0.5) * 1.0 +
          (recent_30_btts_accuracy - 0.5) * 0.5
        ))
      ELSE 1.0
    END as weight,
    total_predictions,
    recent_30_mr_accuracy
  FROM agent_performance
) as weights
ORDER BY weight DESC;

-- 8. UNIFIED_ANALYSIS vs AGENT_PREDICTIONS - Karşılaştırma
-- ============================================================================
SELECT 
  '🔄 UNIFIED vs AGENT KARŞILAŞTIRMA' as check_type,
  (SELECT COUNT(*) FROM unified_analysis WHERE is_settled = TRUE) as unified_settled,
  (SELECT COUNT(*) FROM agent_predictions WHERE settled_at IS NOT NULL) as agent_settled,
  (SELECT COUNT(*) FROM unified_analysis WHERE is_settled = FALSE 
   AND match_date >= CURRENT_DATE - INTERVAL '7 days') as unified_pending,
  (SELECT COUNT(*) FROM agent_predictions WHERE settled_at IS NULL 
   AND match_date >= CURRENT_DATE - INTERVAL '7 days') as agent_pending;
