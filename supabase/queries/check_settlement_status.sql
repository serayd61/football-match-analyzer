-- ============================================================================
-- SETTLEMENT DURUMU KONTROLÜ
-- Neden maçlar settle edilmiyor kontrol et
-- ============================================================================

-- 1. Bekleyen maçlar (settle edilmemiş)
SELECT 
  '⏳ BEKLEYEN MAÇLAR' as check_type,
  fixture_id,
  home_team,
  away_team,
  match_date,
  created_at,
  NOW() - created_at::timestamp as age,
  CASE 
    WHEN match_date < CURRENT_DATE THEN 'DÜN VEYA ÖNCESİ'
    WHEN match_date = CURRENT_DATE THEN 'BUGÜN'
    ELSE 'GELECEKTE'
  END as date_status
FROM unified_analysis
WHERE is_settled = FALSE
  AND match_date <= CURRENT_DATE
ORDER BY match_date DESC, fixture_id
LIMIT 20;

-- 2. Son 7 günde oluşturulan ama settle edilmemiş analizler
SELECT 
  '📅 SON 7 GÜNDE OLUŞTURULAN (SETTLE EDİLMEMİŞ)' as check_type,
  COUNT(*) as count,
  MIN(match_date) as oldest_match_date,
  MAX(match_date) as newest_match_date,
  MIN(created_at) as oldest_created,
  MAX(created_at) as newest_created
FROM unified_analysis
WHERE is_settled = FALSE
  AND created_at >= NOW() - INTERVAL '7 days'
  AND match_date <= CURRENT_DATE;

-- 3. Agent predictions - Settle edilmemiş olanlar
SELECT 
  '🤖 AGENT PREDICTIONS - BEKLEYEN' as check_type,
  COUNT(*) as total_pending,
  COUNT(DISTINCT fixture_id) as unique_fixtures,
  COUNT(DISTINCT agent_name) as unique_agents,
  MIN(match_date) as oldest_match_date,
  MAX(match_date) as newest_match_date
FROM agent_predictions
WHERE settled_at IS NULL
  AND match_date <= CURRENT_DATE;

-- 4. Maç tarihi vs bugün karşılaştırması
SELECT 
  '📊 TARİH ANALİZİ' as check_type,
  COUNT(*) FILTER (WHERE match_date < CURRENT_DATE - INTERVAL '1 day') as dunden_eski,
  COUNT(*) FILTER (WHERE match_date = CURRENT_DATE - INTERVAL '1 day') as dun,
  COUNT(*) FILTER (WHERE match_date = CURRENT_DATE) as bugun,
  COUNT(*) FILTER (WHERE match_date > CURRENT_DATE) as gelecek
FROM unified_analysis
WHERE is_settled = FALSE;

-- 5. Settlement için uygun maçlar (2.5 saat geçmiş, 7 günden eski değil)
SELECT 
  '✅ SETTLEMENT İÇİN UYGUN MAÇLAR' as check_type,
  fixture_id,
  home_team,
  away_team,
  match_date,
  created_at,
  NOW() - created_at::timestamp as age
FROM unified_analysis
WHERE is_settled = FALSE
  AND match_date >= CURRENT_DATE - INTERVAL '7 days'
  AND match_date <= CURRENT_DATE
  AND created_at <= NOW() - INTERVAL '2.5 hours'
ORDER BY match_date DESC
LIMIT 20;
