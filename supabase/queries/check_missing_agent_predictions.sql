-- ============================================================================
-- EKSİK AGENT PREDICTIONS KONTROLÜ
-- unified_analysis'ta kayıt var ama agent_predictions'ta yok mu kontrol et
-- ============================================================================

-- 1. unified_analysis'ta kayıt var ama agent_predictions'ta yok olan maçlar
SELECT 
  '❌ EKSİK AGENT PREDICTIONS' as check_type,
  ua.fixture_id,
  ua.home_team,
  ua.away_team,
  ua.match_date,
  ua.created_at as unified_created_at,
  COUNT(ap.id) as agent_prediction_count
FROM unified_analysis ua
LEFT JOIN agent_predictions ap ON ua.fixture_id = ap.fixture_id
WHERE ua.match_date >= CURRENT_DATE - INTERVAL '7 days'
  AND ua.is_settled = FALSE
GROUP BY ua.fixture_id, ua.home_team, ua.away_team, ua.match_date, ua.created_at
HAVING COUNT(ap.id) = 0
ORDER BY ua.match_date DESC
LIMIT 50;

-- 2. unified_analysis'ta kayıt var ve agent_predictions'ta da var olan maçlar
SELECT 
  '✅ MEVCUT AGENT PREDICTIONS' as check_type,
  ua.fixture_id,
  ua.home_team,
  ua.away_team,
  ua.match_date,
  COUNT(DISTINCT ap.agent_name) as agent_count,
  STRING_AGG(DISTINCT ap.agent_name, ', ') as agents
FROM unified_analysis ua
INNER JOIN agent_predictions ap ON ua.fixture_id = ap.fixture_id
WHERE ua.match_date >= CURRENT_DATE - INTERVAL '7 days'
  AND ua.is_settled = FALSE
GROUP BY ua.fixture_id, ua.home_team, ua.away_team, ua.match_date
ORDER BY ua.match_date DESC
LIMIT 20;

-- 3. Son 2 günde oluşturulan unified_analysis kayıtları
SELECT 
  '📅 SON 2 GÜNDE OLUŞTURULAN ANALİZLER' as check_type,
  COUNT(*) as total_analyses,
  COUNT(DISTINCT fixture_id) as unique_fixtures,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM unified_analysis
WHERE created_at >= NOW() - INTERVAL '2 days';

-- 4. Son 2 günde oluşturulan agent_predictions kayıtları
SELECT 
  '📅 SON 2 GÜNDE OLUŞTURULAN AGENT PREDICTIONS' as check_type,
  COUNT(*) as total_predictions,
  COUNT(DISTINCT fixture_id) as unique_fixtures,
  COUNT(DISTINCT agent_name) as unique_agents,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM agent_predictions
WHERE created_at >= NOW() - INTERVAL '2 days';

-- 5. Agent bazında son 2 günde kayıt sayısı
SELECT 
  '🤖 AGENT BAZINDA SON 2 GÜN' as check_type,
  agent_name,
  COUNT(*) as prediction_count,
  COUNT(DISTINCT fixture_id) as unique_fixtures,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM agent_predictions
WHERE created_at >= NOW() - INTERVAL '2 days'
GROUP BY agent_name
ORDER BY prediction_count DESC;
