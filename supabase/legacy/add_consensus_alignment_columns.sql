-- ============================================================================
-- CONSENSUS ALIGNMENT COLUMNS
-- Agent'ların consensus'a ne kadar yakın olduğunu takip etmek için
-- ============================================================================

-- agent_predictions tablosuna consensus alignment kolonları ekle
ALTER TABLE agent_predictions
ADD COLUMN IF NOT EXISTS consensus_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_match_result_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_over_under_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_btts_alignment INTEGER DEFAULT NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_agent_predictions_consensus_alignment 
ON agent_predictions(agent_name, league, consensus_alignment)
WHERE consensus_alignment IS NOT NULL;

-- Açıklama
COMMENT ON COLUMN agent_predictions.consensus_alignment IS 'Agent''ın consensus''a ne kadar yakın olduğu (0-100, yüksek = consensus''a yakın)';
COMMENT ON COLUMN agent_predictions.consensus_match_result_alignment IS 'Match Result için consensus alignment';
COMMENT ON COLUMN agent_predictions.consensus_over_under_alignment IS 'Over/Under için consensus alignment';
COMMENT ON COLUMN agent_predictions.consensus_btts_alignment IS 'BTTS için consensus alignment';
