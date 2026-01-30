-- ============================================================================
-- MIGRATION: unified_analysis → Learning System
-- Mevcut verileri yeni öğrenme sistemine aktar
-- ============================================================================

-- 1. Önce tabloların var olduğundan emin ol
-- (team_matchup_memory.sql dosyasını önce çalıştırın)

-- ============================================================================
-- STEP 1: team_matchup_memory tablosunu doldur
-- unified_analysis'teki settled maçlardan takım eşleşme verilerini çıkar
-- ============================================================================

INSERT INTO team_matchup_memory (
  home_team_id,
  away_team_id,
  total_matches,
  home_wins,
  draws,
  away_wins,
  avg_total_goals,
  btts_rate,
  over_25_rate,
  last_match_result,
  last_match_score,
  last_match_date,
  patterns,
  agent_accuracy,
  created_at,
  updated_at
)
SELECT 
  home_team_id,
  away_team_id,
  COUNT(*) as total_matches,
  SUM(CASE WHEN actual_home_goals > actual_away_goals THEN 1 ELSE 0 END) as home_wins,
  SUM(CASE WHEN actual_home_goals = actual_away_goals THEN 1 ELSE 0 END) as draws,
  SUM(CASE WHEN actual_home_goals < actual_away_goals THEN 1 ELSE 0 END) as away_wins,
  AVG(COALESCE(actual_home_goals, 0) + COALESCE(actual_away_goals, 0)) as avg_total_goals,
  100.0 * SUM(CASE WHEN actual_home_goals > 0 AND actual_away_goals > 0 THEN 1 ELSE 0 END) / COUNT(*) as btts_rate,
  100.0 * SUM(CASE WHEN (COALESCE(actual_home_goals, 0) + COALESCE(actual_away_goals, 0)) > 2 THEN 1 ELSE 0 END) / COUNT(*) as over_25_rate,
  -- Son maç bilgisi (subquery ile)
  (SELECT 
    CASE 
      WHEN u2.actual_home_goals > u2.actual_away_goals THEN '1'
      WHEN u2.actual_home_goals < u2.actual_away_goals THEN '2'
      ELSE 'X'
    END
   FROM unified_analysis u2 
   WHERE u2.home_team_id = unified_analysis.home_team_id 
     AND u2.away_team_id = unified_analysis.away_team_id
     AND u2.settled_at IS NOT NULL
   ORDER BY u2.match_date DESC LIMIT 1
  ) as last_match_result,
  (SELECT u2.actual_home_goals || '-' || u2.actual_away_goals
   FROM unified_analysis u2 
   WHERE u2.home_team_id = unified_analysis.home_team_id 
     AND u2.away_team_id = unified_analysis.away_team_id
     AND u2.settled_at IS NOT NULL
   ORDER BY u2.match_date DESC LIMIT 1
  ) as last_match_score,
  MAX(match_date) as last_match_date,
  '[]'::jsonb as patterns,
  '{}'::jsonb as agent_accuracy,
  NOW() as created_at,
  NOW() as updated_at
FROM unified_analysis
WHERE settled_at IS NOT NULL
  AND home_team_id IS NOT NULL
  AND away_team_id IS NOT NULL
  AND actual_home_goals IS NOT NULL
  AND actual_away_goals IS NOT NULL
GROUP BY home_team_id, away_team_id
ON CONFLICT (home_team_id, away_team_id) 
DO UPDATE SET
  total_matches = EXCLUDED.total_matches,
  home_wins = EXCLUDED.home_wins,
  draws = EXCLUDED.draws,
  away_wins = EXCLUDED.away_wins,
  avg_total_goals = EXCLUDED.avg_total_goals,
  btts_rate = EXCLUDED.btts_rate,
  over_25_rate = EXCLUDED.over_25_rate,
  last_match_result = EXCLUDED.last_match_result,
  last_match_score = EXCLUDED.last_match_score,
  last_match_date = EXCLUDED.last_match_date,
  updated_at = NOW();

-- Kaç kayıt eklendi?
SELECT 'team_matchup_memory' as table_name, COUNT(*) as record_count FROM team_matchup_memory;

-- ============================================================================
-- STEP 2: team_performance_memory tablosunu doldur
-- Her takım için son maçlardaki performansı hesapla
-- ============================================================================

-- Ev sahibi takımlar için
INSERT INTO team_performance_memory (
  team_id,
  team_name,
  league,
  last_5_goals,
  last_5_conceded,
  avg_goals_scored,
  avg_goals_conceded,
  clean_sheet_rate,
  failed_to_score_rate,
  over_25_rate,
  btts_rate,
  home_form,
  away_form,
  patterns,
  created_at,
  updated_at
)
SELECT DISTINCT ON (home_team_id)
  home_team_id as team_id,
  home_team as team_name,
  league,
  (SELECT jsonb_agg(COALESCE(actual_home_goals, 0) ORDER BY match_date DESC)
   FROM (SELECT actual_home_goals, match_date FROM unified_analysis u2 
         WHERE u2.home_team_id = ua.home_team_id AND u2.settled_at IS NOT NULL 
         ORDER BY match_date DESC LIMIT 5) sub
  ) as last_5_goals,
  (SELECT jsonb_agg(COALESCE(actual_away_goals, 0) ORDER BY match_date DESC)
   FROM (SELECT actual_away_goals, match_date FROM unified_analysis u2 
         WHERE u2.home_team_id = ua.home_team_id AND u2.settled_at IS NOT NULL 
         ORDER BY match_date DESC LIMIT 5) sub
  ) as last_5_conceded,
  AVG(COALESCE(actual_home_goals, 0)) as avg_goals_scored,
  AVG(COALESCE(actual_away_goals, 0)) as avg_goals_conceded,
  100.0 * SUM(CASE WHEN actual_away_goals = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as clean_sheet_rate,
  100.0 * SUM(CASE WHEN actual_home_goals = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as failed_to_score_rate,
  100.0 * SUM(CASE WHEN (COALESCE(actual_home_goals, 0) + COALESCE(actual_away_goals, 0)) > 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as over_25_rate,
  100.0 * SUM(CASE WHEN actual_home_goals > 0 AND actual_away_goals > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as btts_rate,
  NULL as home_form,
  NULL as away_form,
  '[]'::jsonb as patterns,
  NOW() as created_at,
  NOW() as updated_at
FROM unified_analysis ua
WHERE settled_at IS NOT NULL
  AND home_team_id IS NOT NULL
  AND actual_home_goals IS NOT NULL
GROUP BY home_team_id, home_team, league
ON CONFLICT (team_id) 
DO UPDATE SET
  team_name = EXCLUDED.team_name,
  league = EXCLUDED.league,
  last_5_goals = EXCLUDED.last_5_goals,
  last_5_conceded = EXCLUDED.last_5_conceded,
  avg_goals_scored = EXCLUDED.avg_goals_scored,
  avg_goals_conceded = EXCLUDED.avg_goals_conceded,
  clean_sheet_rate = EXCLUDED.clean_sheet_rate,
  failed_to_score_rate = EXCLUDED.failed_to_score_rate,
  over_25_rate = EXCLUDED.over_25_rate,
  btts_rate = EXCLUDED.btts_rate,
  updated_at = NOW();

-- Deplasman takımları için de ekle
INSERT INTO team_performance_memory (
  team_id,
  team_name,
  league,
  last_5_goals,
  last_5_conceded,
  avg_goals_scored,
  avg_goals_conceded,
  clean_sheet_rate,
  failed_to_score_rate,
  over_25_rate,
  btts_rate,
  home_form,
  away_form,
  patterns,
  created_at,
  updated_at
)
SELECT DISTINCT ON (away_team_id)
  away_team_id as team_id,
  away_team as team_name,
  league,
  (SELECT jsonb_agg(COALESCE(actual_away_goals, 0) ORDER BY match_date DESC)
   FROM (SELECT actual_away_goals, match_date FROM unified_analysis u2 
         WHERE u2.away_team_id = ua.away_team_id AND u2.settled_at IS NOT NULL 
         ORDER BY match_date DESC LIMIT 5) sub
  ) as last_5_goals,
  (SELECT jsonb_agg(COALESCE(actual_home_goals, 0) ORDER BY match_date DESC)
   FROM (SELECT actual_home_goals, match_date FROM unified_analysis u2 
         WHERE u2.away_team_id = ua.away_team_id AND u2.settled_at IS NOT NULL 
         ORDER BY match_date DESC LIMIT 5) sub
  ) as last_5_conceded,
  AVG(COALESCE(actual_away_goals, 0)) as avg_goals_scored,
  AVG(COALESCE(actual_home_goals, 0)) as avg_goals_conceded,
  100.0 * SUM(CASE WHEN actual_home_goals = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as clean_sheet_rate,
  100.0 * SUM(CASE WHEN actual_away_goals = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as failed_to_score_rate,
  100.0 * SUM(CASE WHEN (COALESCE(actual_home_goals, 0) + COALESCE(actual_away_goals, 0)) > 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as over_25_rate,
  100.0 * SUM(CASE WHEN actual_home_goals > 0 AND actual_away_goals > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as btts_rate,
  NULL as home_form,
  NULL as away_form,
  '[]'::jsonb as patterns,
  NOW() as created_at,
  NOW() as updated_at
FROM unified_analysis ua
WHERE settled_at IS NOT NULL
  AND away_team_id IS NOT NULL
  AND actual_away_goals IS NOT NULL
GROUP BY away_team_id, away_team, league
ON CONFLICT (team_id) 
DO UPDATE SET
  team_name = COALESCE(EXCLUDED.team_name, team_performance_memory.team_name),
  league = COALESCE(EXCLUDED.league, team_performance_memory.league),
  last_5_goals = EXCLUDED.last_5_goals,
  last_5_conceded = EXCLUDED.last_5_conceded,
  avg_goals_scored = (team_performance_memory.avg_goals_scored + EXCLUDED.avg_goals_scored) / 2,
  avg_goals_conceded = (team_performance_memory.avg_goals_conceded + EXCLUDED.avg_goals_conceded) / 2,
  updated_at = NOW();

-- Kaç kayıt eklendi?
SELECT 'team_performance_memory' as table_name, COUNT(*) as record_count FROM team_performance_memory;

-- ============================================================================
-- STEP 3: agent_learning_log tablosunu doldur
-- agent_predictions'tan öğrenme loglarını oluştur
-- ============================================================================

-- Match Result logs
INSERT INTO agent_learning_log (
  fixture_id,
  agent_name,
  prediction_type,
  prediction,
  confidence,
  actual_result,
  was_correct,
  learning_context,
  patterns_used,
  created_at
)
SELECT 
  fixture_id,
  agent_name,
  'matchResult' as prediction_type,
  match_result_prediction as prediction,
  match_result_confidence as confidence,
  actual_match_result as actual_result,
  match_result_correct as was_correct,
  jsonb_build_object(
    'league', league,
    'homeGoals', actual_home_goals,
    'awayGoals', actual_away_goals
  ) as learning_context,
  '[]'::jsonb as patterns_used,
  settled_at as created_at
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND match_result_prediction IS NOT NULL
  AND actual_match_result IS NOT NULL
ON CONFLICT (fixture_id, agent_name, prediction_type) DO NOTHING;

-- Over/Under logs
INSERT INTO agent_learning_log (
  fixture_id,
  agent_name,
  prediction_type,
  prediction,
  confidence,
  actual_result,
  was_correct,
  learning_context,
  patterns_used,
  created_at
)
SELECT 
  fixture_id,
  agent_name,
  'overUnder' as prediction_type,
  over_under_prediction as prediction,
  over_under_confidence as confidence,
  CASE WHEN actual_total_goals > 2.5 THEN 'Over' ELSE 'Under' END as actual_result,
  over_under_correct as was_correct,
  jsonb_build_object(
    'league', league,
    'totalGoals', actual_total_goals
  ) as learning_context,
  '[]'::jsonb as patterns_used,
  settled_at as created_at
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND over_under_prediction IS NOT NULL
  AND actual_total_goals IS NOT NULL
ON CONFLICT (fixture_id, agent_name, prediction_type) DO NOTHING;

-- BTTS logs
INSERT INTO agent_learning_log (
  fixture_id,
  agent_name,
  prediction_type,
  prediction,
  confidence,
  actual_result,
  was_correct,
  learning_context,
  patterns_used,
  created_at
)
SELECT 
  fixture_id,
  agent_name,
  'btts' as prediction_type,
  btts_prediction as prediction,
  btts_confidence as confidence,
  CASE WHEN actual_btts THEN 'Yes' ELSE 'No' END as actual_result,
  btts_correct as was_correct,
  jsonb_build_object(
    'league', league,
    'homeGoals', actual_home_goals,
    'awayGoals', actual_away_goals
  ) as learning_context,
  '[]'::jsonb as patterns_used,
  settled_at as created_at
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND btts_prediction IS NOT NULL
  AND actual_btts IS NOT NULL
ON CONFLICT (fixture_id, agent_name, prediction_type) DO NOTHING;

-- Kaç kayıt eklendi?
SELECT 'agent_learning_log' as table_name, COUNT(*) as record_count FROM agent_learning_log;

-- ============================================================================
-- STEP 4: Pattern'leri güncelle
-- ============================================================================

-- team_matchup_memory için pattern'leri hesapla
UPDATE team_matchup_memory SET
  patterns = (
    SELECT jsonb_agg(pattern)
    FROM (
      SELECT DISTINCT pattern FROM (
        SELECT 
          CASE 
            WHEN avg_total_goals < 2.0 THEN 'LOW_SCORING_MATCHUP'
            WHEN avg_total_goals > 3.0 THEN 'HIGH_SCORING_MATCHUP'
            ELSE NULL
          END as pattern
        FROM team_matchup_memory tmm2 WHERE tmm2.id = team_matchup_memory.id
        UNION ALL
        SELECT 
          CASE 
            WHEN btts_rate < 30 THEN 'BTTS_UNLIKELY'
            WHEN btts_rate > 70 THEN 'BTTS_LIKELY'
            ELSE NULL
          END
        FROM team_matchup_memory tmm2 WHERE tmm2.id = team_matchup_memory.id
        UNION ALL
        SELECT 
          CASE 
            WHEN over_25_rate < 30 THEN 'UNDER_PRONE'
            WHEN over_25_rate > 70 THEN 'OVER_PRONE'
            ELSE NULL
          END
        FROM team_matchup_memory tmm2 WHERE tmm2.id = team_matchup_memory.id
        UNION ALL
        SELECT 
          CASE 
            WHEN draws::float / NULLIF(total_matches, 0) > 0.4 THEN 'DRAW_PRONE'
            ELSE NULL
          END
        FROM team_matchup_memory tmm2 WHERE tmm2.id = team_matchup_memory.id
      ) patterns
      WHERE pattern IS NOT NULL
    ) filtered
  )
WHERE total_matches >= 2;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '=== MIGRATION COMPLETE ===' as status;

SELECT 
  'team_matchup_memory' as table_name, 
  COUNT(*) as total_records,
  COUNT(CASE WHEN total_matches >= 3 THEN 1 END) as with_3plus_matches
FROM team_matchup_memory
UNION ALL
SELECT 
  'team_performance_memory', 
  COUNT(*),
  COUNT(CASE WHEN avg_goals_scored > 0 THEN 1 END)
FROM team_performance_memory
UNION ALL
SELECT 
  'agent_learning_log', 
  COUNT(*),
  COUNT(CASE WHEN was_correct THEN 1 END)
FROM agent_learning_log;

-- Ajan doğruluk özeti
SELECT 
  agent_name,
  prediction_type,
  COUNT(*) as total,
  SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct,
  ROUND(100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as accuracy_pct
FROM agent_learning_log
GROUP BY agent_name, prediction_type
ORDER BY agent_name, prediction_type;
