-- ============================================================================
-- AGENT PERFORMANCE TABLOSUNU DOLDUR
-- agent_predictions tablosundaki verilerden agent_performance'ı güncelle
-- ============================================================================

-- Önce mevcut verileri temizle
TRUNCATE TABLE agent_performance;

-- agent_predictions'dan hesaplayarak agent_performance'a ekle
INSERT INTO agent_performance (
  agent_name,
  league,
  total_matches,
  correct_predictions,
  match_result_accuracy,
  over_under_accuracy,
  btts_accuracy,
  recent_match_result_accuracy,
  recent_over_under_accuracy,
  recent_btts_accuracy,
  current_weight,
  trend_direction,
  last_updated
)
SELECT 
  agent_name,
  NULL as league, -- Tüm ligler için genel performans
  COUNT(*) as total_matches,
  SUM(CASE WHEN match_result_correct = true THEN 1 ELSE 0 END) +
  SUM(CASE WHEN over_under_correct = true THEN 1 ELSE 0 END) +
  SUM(CASE WHEN btts_correct = true THEN 1 ELSE 0 END) as correct_predictions,
  
  -- Match Result Accuracy
  ROUND(
    (SUM(CASE WHEN match_result_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as match_result_accuracy,
  
  -- Over/Under Accuracy
  ROUND(
    (SUM(CASE WHEN over_under_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as over_under_accuracy,
  
  -- BTTS Accuracy
  ROUND(
    (SUM(CASE WHEN btts_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as btts_accuracy,
  
  -- Recent accuracy (son 30 maç için - şimdilik aynı değerleri kullan)
  ROUND(
    (SUM(CASE WHEN match_result_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as recent_match_result_accuracy,
  
  ROUND(
    (SUM(CASE WHEN over_under_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as recent_over_under_accuracy,
  
  ROUND(
    (SUM(CASE WHEN btts_correct = true THEN 1 ELSE 0 END)::DECIMAL / 
     NULLIF(COUNT(*), 0)) * 100, 2
  ) as recent_btts_accuracy,
  
  -- Ağırlık (performansa göre hesaplanacak)
  1.0 as current_weight,
  
  -- Trend (şimdilik stable)
  'stable' as trend_direction,
  
  NOW() as last_updated

FROM agent_predictions
WHERE settled_at IS NOT NULL
GROUP BY agent_name;

-- Sonuçları kontrol et
SELECT 
  agent_name,
  total_matches,
  match_result_accuracy as mr_acc,
  over_under_accuracy as ou_acc,
  btts_accuracy as btts_acc,
  ROUND((match_result_accuracy + over_under_accuracy + btts_accuracy) / 3, 2) as avg_acc
FROM agent_performance
ORDER BY avg_acc DESC;
