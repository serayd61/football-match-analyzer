-- ============================================================================
-- CONSENSUS ALIGNMENT KONTROL SORGULARI
-- ============================================================================

-- 1. GENEL DURUM: Toplam tahmin sayısı ve alignment durumu
SELECT 
  COUNT(*) as total_predictions,
  COUNT(CASE WHEN consensus_alignment IS NOT NULL THEN 1 END) as with_alignment,
  COUNT(CASE WHEN consensus_alignment IS NULL THEN 1 END) as without_alignment,
  ROUND(
    COUNT(CASE WHEN consensus_alignment IS NOT NULL THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as alignment_coverage_pct
FROM agent_predictions;

-- 2. AGENT BAZINDA ALIGNMENT DURUMU
SELECT 
  agent_name,
  COUNT(*) as total_predictions,
  COUNT(CASE WHEN consensus_alignment IS NOT NULL THEN 1 END) as with_alignment,
  COUNT(CASE WHEN consensus_alignment IS NULL THEN 1 END) as without_alignment,
  ROUND(
    AVG(CASE WHEN consensus_alignment IS NOT NULL THEN consensus_alignment END)::numeric, 
    2
  ) as avg_alignment_score
FROM agent_predictions
GROUP BY agent_name
ORDER BY avg_alignment_score DESC NULLS LAST;

-- 3. SON 7 GÜNDE SETTLED OLAN AMA ALIGNMENT'I NULL OLAN TAHMİNLER
SELECT 
  fixture_id,
  agent_name,
  settled_at,
  match_result_prediction,
  over_under_prediction,
  btts_prediction,
  consensus_alignment
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND consensus_alignment IS NULL
  AND settled_at >= NOW() - INTERVAL '7 days'
ORDER BY settled_at DESC
LIMIT 20;

-- 4. ALIGNMENT SKORLARI DAĞILIMI
SELECT 
  CASE 
    WHEN consensus_alignment >= 80 THEN 'Çok Yüksek (80-100)'
    WHEN consensus_alignment >= 60 THEN 'Yüksek (60-79)'
    WHEN consensus_alignment >= 40 THEN 'Orta (40-59)'
    WHEN consensus_alignment >= 20 THEN 'Düşük (20-39)'
    ELSE 'Çok Düşük (0-19)'
  END as alignment_range,
  COUNT(*) as count,
  ROUND(AVG(consensus_alignment)::numeric, 2) as avg_score
FROM agent_predictions
WHERE consensus_alignment IS NOT NULL
GROUP BY 
  CASE 
    WHEN consensus_alignment >= 80 THEN 'Çok Yüksek (80-100)'
    WHEN consensus_alignment >= 60 THEN 'Yüksek (60-79)'
    WHEN consensus_alignment >= 40 THEN 'Orta (40-59)'
    WHEN consensus_alignment >= 20 THEN 'Düşük (20-39)'
    ELSE 'Çok Düşük (0-19)'
  END
ORDER BY avg_score DESC;

-- 5. AGENT PERFORMANCE TABLOSUNDA ALIGNMENT SKORLARI
SELECT 
  agent_name,
  league,
  total_matches,
  recent_match_result_accuracy,
  current_weight,
  consensus_alignment_score,
  ROUND(
    (consensus_alignment_score / NULLIF(total_matches, 0))::numeric, 
    2
  ) as alignment_per_match
FROM agent_performance
ORDER BY consensus_alignment_score DESC NULLS LAST
LIMIT 20;

-- 6. SON HESAPLANAN ALIGNMENT'LAR (En son güncellenenler)
SELECT 
  ap.fixture_id,
  ap.agent_name,
  ap.consensus_alignment,
  ap.settled_at,
  ua.home_team,
  ua.away_team,
  ua.match_date
FROM agent_predictions ap
LEFT JOIN unified_analysis ua ON ap.fixture_id = ua.fixture_id
WHERE ap.consensus_alignment IS NOT NULL
ORDER BY ap.settled_at DESC NULLS LAST
LIMIT 20;

-- 7. ALIGNMENT SKORU YÜKSEK OLAN AGENTLER (En tutarlı)
SELECT 
  agent_name,
  COUNT(*) as total_with_alignment,
  ROUND(AVG(consensus_alignment)::numeric, 2) as avg_alignment,
  ROUND(MIN(consensus_alignment)::numeric, 2) as min_alignment,
  ROUND(MAX(consensus_alignment)::numeric, 2) as max_alignment,
  ROUND(STDDEV(consensus_alignment)::numeric, 2) as stddev_alignment
FROM agent_predictions
WHERE consensus_alignment IS NOT NULL
GROUP BY agent_name
HAVING AVG(consensus_alignment) >= 60
ORDER BY avg_alignment DESC;

-- 8. ALIGNMENT SKORU DÜŞÜK OLAN AGENTLER (En tutarsız - dikkat edilmesi gerekenler)
SELECT 
  agent_name,
  COUNT(*) as total_with_alignment,
  ROUND(AVG(consensus_alignment)::numeric, 2) as avg_alignment,
  ROUND(MIN(consensus_alignment)::numeric, 2) as min_alignment,
  ROUND(MAX(consensus_alignment)::numeric, 2) as max_alignment
FROM agent_predictions
WHERE consensus_alignment IS NOT NULL
GROUP BY agent_name
HAVING AVG(consensus_alignment) < 40
ORDER BY avg_alignment ASC;

-- 9. FIXTURE BAZINDA ALIGNMENT KARŞILAŞTIRMASI
SELECT 
  ap.fixture_id,
  ua.home_team || ' vs ' || ua.away_team as match,
  COUNT(DISTINCT ap.agent_name) as agent_count,
  ROUND(AVG(ap.consensus_alignment)::numeric, 2) as avg_alignment,
  ROUND(MIN(ap.consensus_alignment)::numeric, 2) as min_alignment,
  ROUND(MAX(ap.consensus_alignment)::numeric, 2) as max_alignment,
  CASE 
    WHEN AVG(ap.consensus_alignment) >= 80 THEN 'Çok Uyumlu'
    WHEN AVG(ap.consensus_alignment) >= 60 THEN 'Uyumlu'
    WHEN AVG(ap.consensus_alignment) >= 40 THEN 'Orta'
    ELSE 'Düşük Uyum'
  END as alignment_status
FROM agent_predictions ap
LEFT JOIN unified_analysis ua ON ap.fixture_id = ua.fixture_id
WHERE ap.consensus_alignment IS NOT NULL
GROUP BY ap.fixture_id, ua.home_team, ua.away_team
ORDER BY avg_alignment DESC
LIMIT 20;

-- 10. ALIGNMENT HISTORY (agent_performance tablosunda)
SELECT 
  agent_name,
  league,
  consensus_alignment_score,
  alignment_history,
  jsonb_array_length(alignment_history) as history_count
FROM agent_performance
WHERE alignment_history IS NOT NULL 
  AND jsonb_array_length(alignment_history) > 0
ORDER BY consensus_alignment_score DESC NULLS LAST
LIMIT 10;
