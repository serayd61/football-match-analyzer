-- AGENT BAZINDA ALIGNMENT DURUMU
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
