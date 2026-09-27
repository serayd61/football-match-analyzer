-- SON 7 GÜNDE SETTLED OLAN AMA ALIGNMENT'I NULL OLAN TAHMİNLER
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
