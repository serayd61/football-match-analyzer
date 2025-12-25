-- ============================================================================
-- AGENT ANALYSIS TABLE
-- Heurist Blockchain Agents analiz sonuçlarını saklar
-- ============================================================================

-- Table oluştur
CREATE TABLE IF NOT EXISTS public.agent_analysis (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Agent sonuçları (JSON)
  agent_results JSONB,
  
  -- Predictions
  btts_prediction TEXT,
  btts_confidence INTEGER,
  btts_reasoning TEXT,
  
  over_under_prediction TEXT,
  over_under_confidence INTEGER,
  over_under_reasoning TEXT,
  
  match_result_prediction TEXT,
  match_result_confidence INTEGER,
  match_result_reasoning TEXT,
  
  -- Corners (optional)
  corners_prediction TEXT,
  corners_confidence INTEGER,
  corners_reasoning TEXT,
  corners_line NUMERIC,
  
  -- YENİ: İlk Yarı Gol Tahmini (Agent özel)
  half_time_goals_prediction TEXT,
  half_time_goals_confidence INTEGER,
  half_time_goals_reasoning TEXT,
  half_time_goals_line NUMERIC,
  half_time_goals_expected NUMERIC,
  
  -- YENİ: İlk Yarı / Maç Sonucu Kombinasyonu (Agent özel)
  half_time_full_time_prediction TEXT,
  half_time_full_time_confidence INTEGER,
  half_time_full_time_reasoning TEXT,
  
  -- YENİ: Detaylı Maç Sonucu Oranları (Agent özel)
  match_result_odds_home INTEGER,
  match_result_odds_draw INTEGER,
  match_result_odds_away INTEGER,
  match_result_odds_reasoning TEXT,
  
  -- Summary
  best_bet_market TEXT,
  best_bet_selection TEXT,
  best_bet_confidence INTEGER,
  best_bet_reason TEXT,
  
  agreement INTEGER,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  overall_confidence INTEGER,
  data_quality TEXT CHECK (data_quality IN ('good', 'minimal', 'no_data')),
  processing_time INTEGER,
  
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Settlement fields
  is_settled BOOLEAN DEFAULT FALSE,
  actual_btts TEXT,
  actual_total_goals INTEGER,
  actual_match_result TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_analysis_fixture_id ON public.agent_analysis(fixture_id);
CREATE INDEX IF NOT EXISTS idx_agent_analysis_analyzed_at ON public.agent_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_analysis_settled ON public.agent_analysis(is_settled) WHERE is_settled = FALSE;

-- RLS Policies
ALTER TABLE public.agent_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON public.agent_analysis;
DROP POLICY IF EXISTS "Service role full access" ON public.agent_analysis;

-- Public read access
CREATE POLICY "Public read access" ON public.agent_analysis
  FOR SELECT
  TO public
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON public.agent_analysis
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_agent_analysis_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_agent_analysis_updated_at ON public.agent_analysis;

-- Create trigger
CREATE TRIGGER trigger_agent_analysis_updated_at
  BEFORE UPDATE ON public.agent_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_analysis_updated_at();

