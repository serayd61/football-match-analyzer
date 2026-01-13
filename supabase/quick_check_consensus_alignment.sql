-- HIZLI KONTROL: Consensus Alignment Genel Durum
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
