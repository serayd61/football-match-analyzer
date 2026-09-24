-- ============================================================================
-- ANALYSIS PERFORMANCE TRACKING TABLE
-- Tracks all match analyses and their accuracy after matches are settled
-- ============================================================================

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS analysis_performance CASCADE;

-- Create the main table
CREATE TABLE analysis_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL UNIQUE, -- Unique constraint to prevent duplicates
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  league VARCHAR(255),
  match_date TIMESTAMPTZ,
  
  -- ============================================================================
  -- AGENT PREDICTIONS (stored as JSONB for flexibility)
  -- Each contains: matchResult, overUnder, btts, confidence, reasoning
  -- ============================================================================
  stats_agent JSONB DEFAULT '{}'::jsonb,
  odds_agent JSONB DEFAULT '{}'::jsonb,
  deep_analysis_agent JSONB DEFAULT '{}'::jsonb,
  genius_analyst JSONB DEFAULT '{}'::jsonb,
  master_strategist JSONB DEFAULT '{}'::jsonb,
  ai_smart JSONB DEFAULT '{}'::jsonb, -- Claude + DeepSeek combined
  
  -- ============================================================================
  -- CONSENSUS PREDICTIONS (final combined prediction)
  -- ============================================================================
  consensus_match_result VARCHAR(10), -- '1', 'X', '2'
  consensus_over_under VARCHAR(10),   -- 'Over', 'Under'
  consensus_btts VARCHAR(10),         -- 'Yes', 'No'
  consensus_confidence INTEGER DEFAULT 50,
  consensus_score_prediction VARCHAR(10), -- e.g., '1-1', '2-1'
  
  -- ============================================================================
  -- ACTUAL RESULTS (filled after match is settled)
  -- ============================================================================
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  actual_match_result VARCHAR(10),   -- Calculated: '1', 'X', '2'
  actual_over_under VARCHAR(10),     -- Calculated: 'Over', 'Under'
  actual_btts VARCHAR(10),           -- Calculated: 'Yes', 'No'
  actual_total_goals DECIMAL(4,1),   -- e.g., 2.5, 3.0
  
  -- Settlement status
  match_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  
  -- ============================================================================
  -- ACCURACY SCORES (calculated after settlement)
  -- ============================================================================
  -- Match Result accuracy for each agent
  stats_agent_mr_correct BOOLEAN,
  odds_agent_mr_correct BOOLEAN,
  deep_analysis_mr_correct BOOLEAN,
  genius_analyst_mr_correct BOOLEAN,
  master_strategist_mr_correct BOOLEAN,
  ai_smart_mr_correct BOOLEAN,
  consensus_mr_correct BOOLEAN,
  
  -- Over/Under accuracy
  stats_agent_ou_correct BOOLEAN,
  odds_agent_ou_correct BOOLEAN,
  deep_analysis_ou_correct BOOLEAN,
  genius_analyst_ou_correct BOOLEAN,
  master_strategist_ou_correct BOOLEAN,
  ai_smart_ou_correct BOOLEAN,
  consensus_ou_correct BOOLEAN,
  
  -- BTTS accuracy
  stats_agent_btts_correct BOOLEAN,
  odds_agent_btts_correct BOOLEAN,
  deep_analysis_btts_correct BOOLEAN,
  genius_analyst_btts_correct BOOLEAN,
  master_strategist_btts_correct BOOLEAN,
  ai_smart_btts_correct BOOLEAN,
  consensus_btts_correct BOOLEAN,
  
  -- ============================================================================
  -- METADATA
  -- ============================================================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_ap_fixture_id ON analysis_performance(fixture_id);
CREATE INDEX idx_ap_match_settled ON analysis_performance(match_settled);
CREATE INDEX idx_ap_match_date ON analysis_performance(match_date);
CREATE INDEX idx_ap_league ON analysis_performance(league);
CREATE INDEX idx_ap_created_at ON analysis_performance(created_at DESC);

-- ============================================================================
-- TRIGGER for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_analysis_performance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analysis_performance_timestamp
  BEFORE UPDATE ON analysis_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_performance_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE analysis_performance IS 'Tracks all match analyses and their accuracy after matches are settled';
COMMENT ON COLUMN analysis_performance.fixture_id IS 'Sportmonks fixture ID - unique identifier';
COMMENT ON COLUMN analysis_performance.match_settled IS 'True when actual results have been fetched and compared';
COMMENT ON COLUMN analysis_performance.consensus_mr_correct IS 'True if consensus match result prediction was correct';

