-- ============================================================================
-- UNIFIED ANALYSIS TABLE
-- Agent'lar ve AI'ları birleştiren unified consensus sisteminin sonuçlarını saklar
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_analysis (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER UNIQUE NOT NULL,
  
  -- Match info
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT,
  match_date DATE,
  
  -- Full analysis JSON
  analysis JSONB NOT NULL,
  
  -- Quick access fields
  match_result_prediction TEXT CHECK (match_result_prediction IN ('1', 'X', '2')),
  match_result_confidence INTEGER CHECK (match_result_confidence BETWEEN 0 AND 100),
  
  over_under_prediction TEXT CHECK (over_under_prediction IN ('Over', 'Under')),
  over_under_confidence INTEGER CHECK (over_under_confidence BETWEEN 0 AND 100),
  
  btts_prediction TEXT CHECK (btts_prediction IN ('Yes', 'No')),
  btts_confidence INTEGER CHECK (btts_confidence BETWEEN 0 AND 100),
  
  -- Best bet
  best_bet_market TEXT,
  best_bet_selection TEXT,
  best_bet_confidence INTEGER CHECK (best_bet_confidence BETWEEN 0 AND 100),
  
  -- System performance
  overall_confidence INTEGER CHECK (overall_confidence BETWEEN 0 AND 100),
  agreement INTEGER CHECK (agreement BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  data_quality TEXT CHECK (data_quality IN ('excellent', 'good', 'fair', 'poor')),
  
  -- Metadata
  processing_time INTEGER,
  systems_used TEXT[],
  
  -- Settlement (maç sonrası sonuçlar)
  is_settled BOOLEAN DEFAULT FALSE,
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  actual_total_goals INTEGER,
  actual_btts BOOLEAN,
  actual_match_result TEXT CHECK (actual_match_result IN ('1', 'X', '2')),
  
  -- Accuracy tracking
  match_result_correct BOOLEAN,
  over_under_correct BOOLEAN,
  btts_correct BOOLEAN,
  score_prediction_correct BOOLEAN,
  
  settled_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unified_analysis_fixture_id ON unified_analysis(fixture_id);
CREATE INDEX IF NOT EXISTS idx_unified_analysis_match_date ON unified_analysis(match_date);
CREATE INDEX IF NOT EXISTS idx_unified_analysis_is_settled ON unified_analysis(is_settled);
CREATE INDEX IF NOT EXISTS idx_unified_analysis_created_at ON unified_analysis(created_at);

-- Performance tracking view
CREATE OR REPLACE VIEW unified_analysis_performance AS
SELECT 
  COUNT(*) as total_analyses,
  COUNT(*) FILTER (WHERE is_settled = true) as settled_analyses,
  COUNT(*) FILTER (WHERE is_settled = true AND match_result_correct = true) as correct_match_results,
  COUNT(*) FILTER (WHERE is_settled = true AND over_under_correct = true) as correct_over_under,
  COUNT(*) FILTER (WHERE is_settled = true AND btts_correct = true) as correct_btts,
  COUNT(*) FILTER (WHERE is_settled = true AND score_prediction_correct = true) as correct_scores,
  ROUND(AVG(overall_confidence) FILTER (WHERE is_settled = true), 2) as avg_confidence,
  ROUND(AVG(agreement) FILTER (WHERE is_settled = true), 2) as avg_agreement,
  ROUND(
    COUNT(*) FILTER (WHERE is_settled = true AND match_result_correct = true)::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE is_settled = true), 0) * 100, 
    2
  ) as match_result_accuracy,
  ROUND(
    COUNT(*) FILTER (WHERE is_settled = true AND over_under_correct = true)::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE is_settled = true), 0) * 100, 
    2
  ) as over_under_accuracy,
  ROUND(
    COUNT(*) FILTER (WHERE is_settled = true AND btts_correct = true)::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE is_settled = true), 0) * 100, 
    2
  ) as btts_accuracy
FROM unified_analysis;

