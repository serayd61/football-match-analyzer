-- ============================================================================
-- COMPLETE MIGRATION v3 - TÜM EKSİK TABLOLAR + RLS POLICY
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştır
-- ============================================================================

-- ============================================================================
-- 0. RLS'Yİ DEVRE DIŞI BIRAK (Mevcut tablolarda)
-- ============================================================================
ALTER TABLE IF EXISTS unified_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analysis_performance DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. UNIFIED_ANALYSIS TABLOSU
-- ============================================================================
DROP TABLE IF EXISTS unified_analysis CASCADE;

CREATE TABLE unified_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  league VARCHAR(255),
  match_date TIMESTAMPTZ,
  
  -- Analysis results (stored as JSONB)
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Quick access fields
  match_result_prediction VARCHAR(10),
  match_result_confidence INTEGER DEFAULT 50,
  over_under_prediction VARCHAR(10),
  over_under_confidence INTEGER DEFAULT 50,
  btts_prediction VARCHAR(10),
  btts_confidence INTEGER DEFAULT 50,
  overall_confidence INTEGER DEFAULT 50,
  agreement INTEGER DEFAULT 0,
  risk_level VARCHAR(20),
  
  -- Best bet
  best_bet_market VARCHAR(100),
  best_bet_selection VARCHAR(100),
  best_bet_confidence INTEGER,
  best_bet_value VARCHAR(20),
  
  -- Score prediction
  score_prediction VARCHAR(10),
  expected_goals DECIMAL(4,2),
  
  -- Metadata
  processing_time INTEGER,
  models_used TEXT[],
  data_quality VARCHAR(20),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS devre dışı bırak
ALTER TABLE unified_analysis DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ua_fixture_id ON unified_analysis(fixture_id);
CREATE INDEX idx_ua_match_date ON unified_analysis(match_date);
CREATE INDEX idx_ua_created_at ON unified_analysis(created_at DESC);

-- ============================================================================
-- 2. ANALYSIS_PERFORMANCE TABLOSU
-- ============================================================================
DROP TABLE IF EXISTS analysis_performance CASCADE;

CREATE TABLE analysis_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  league VARCHAR(255),
  match_date TIMESTAMPTZ,
  
  -- Agent predictions (JSONB)
  stats_agent JSONB DEFAULT '{}'::jsonb,
  odds_agent JSONB DEFAULT '{}'::jsonb,
  deep_analysis_agent JSONB DEFAULT '{}'::jsonb,
  genius_analyst JSONB DEFAULT '{}'::jsonb,
  master_strategist JSONB DEFAULT '{}'::jsonb,
  ai_smart JSONB DEFAULT '{}'::jsonb,
  
  -- Consensus predictions
  consensus_match_result VARCHAR(10),
  consensus_over_under VARCHAR(10),
  consensus_btts VARCHAR(10),
  consensus_confidence INTEGER DEFAULT 50,
  consensus_score_prediction VARCHAR(10),
  
  -- Actual results
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  actual_match_result VARCHAR(10),
  actual_over_under VARCHAR(10),
  actual_btts VARCHAR(10),
  actual_total_goals DECIMAL(4,1),
  
  -- Settlement
  match_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  
  -- Accuracy (calculated after settlement)
  stats_agent_mr_correct BOOLEAN,
  odds_agent_mr_correct BOOLEAN,
  deep_analysis_mr_correct BOOLEAN,
  genius_analyst_mr_correct BOOLEAN,
  master_strategist_mr_correct BOOLEAN,
  ai_smart_mr_correct BOOLEAN,
  consensus_mr_correct BOOLEAN,
  
  stats_agent_ou_correct BOOLEAN,
  odds_agent_ou_correct BOOLEAN,
  deep_analysis_ou_correct BOOLEAN,
  genius_analyst_ou_correct BOOLEAN,
  master_strategist_ou_correct BOOLEAN,
  ai_smart_ou_correct BOOLEAN,
  consensus_ou_correct BOOLEAN,
  
  stats_agent_btts_correct BOOLEAN,
  odds_agent_btts_correct BOOLEAN,
  deep_analysis_btts_correct BOOLEAN,
  genius_analyst_btts_correct BOOLEAN,
  master_strategist_btts_correct BOOLEAN,
  ai_smart_btts_correct BOOLEAN,
  consensus_btts_correct BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS devre dışı bırak
ALTER TABLE analysis_performance DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ap_fixture_id ON analysis_performance(fixture_id);
CREATE INDEX idx_ap_match_settled ON analysis_performance(match_settled);
CREATE INDEX idx_ap_match_date ON analysis_performance(match_date);
CREATE INDEX idx_ap_created_at ON analysis_performance(created_at DESC);

-- ============================================================================
-- 3. TRIGGER FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ua_timestamp ON unified_analysis;
CREATE TRIGGER trigger_ua_timestamp
  BEFORE UPDATE ON unified_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_ap_timestamp ON analysis_performance;
CREATE TRIGGER trigger_ap_timestamp
  BEFORE UPDATE ON analysis_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 4. PUBLIC INSERT/SELECT/UPDATE İZNİ (Anon key için)
-- ============================================================================
GRANT ALL ON unified_analysis TO anon;
GRANT ALL ON unified_analysis TO authenticated;
GRANT ALL ON unified_analysis TO service_role;

GRANT ALL ON analysis_performance TO anon;
GRANT ALL ON analysis_performance TO authenticated;
GRANT ALL ON analysis_performance TO service_role;

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'Migration v3 completed successfully! RLS disabled, all permissions granted.' as status;
