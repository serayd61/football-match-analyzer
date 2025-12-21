-- ============================================================================
-- SMART ANALYSIS TABLE
-- Yeni basitleştirilmiş analiz sistemi için tablo
-- ============================================================================

-- Drop if exists
DROP TABLE IF EXISTS smart_analysis;

-- Create table
CREATE TABLE smart_analysis (
  id BIGSERIAL PRIMARY KEY,
  fixture_id BIGINT UNIQUE NOT NULL,
  
  -- Match info
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT,
  match_date DATE,
  
  -- Full analysis JSON
  analysis JSONB NOT NULL,
  
  -- Quick access fields
  btts_prediction TEXT CHECK (btts_prediction IN ('yes', 'no')),
  btts_confidence INTEGER CHECK (btts_confidence BETWEEN 0 AND 100),
  
  over_under_prediction TEXT CHECK (over_under_prediction IN ('over', 'under')),
  over_under_confidence INTEGER CHECK (over_under_confidence BETWEEN 0 AND 100),
  
  match_result_prediction TEXT CHECK (match_result_prediction IN ('home', 'draw', 'away')),
  match_result_confidence INTEGER CHECK (match_result_confidence BETWEEN 0 AND 100),
  
  -- Scoring
  agreement INTEGER CHECK (agreement BETWEEN 0 AND 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  overall_confidence INTEGER CHECK (overall_confidence BETWEEN 0 AND 100),
  
  -- Performance
  processing_time INTEGER,
  models_used TEXT[],
  
  -- Settlement
  is_settled BOOLEAN DEFAULT FALSE,
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  btts_correct BOOLEAN,
  over_under_correct BOOLEAN,
  match_result_correct BOOLEAN,
  settled_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_smart_analysis_fixture_id ON smart_analysis(fixture_id);
CREATE INDEX idx_smart_analysis_match_date ON smart_analysis(match_date);
CREATE INDEX idx_smart_analysis_is_settled ON smart_analysis(is_settled);
CREATE INDEX idx_smart_analysis_created_at ON smart_analysis(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_smart_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smart_analysis_updated_at
  BEFORE UPDATE ON smart_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_smart_analysis_updated_at();

-- RLS Policies (eğer RLS aktifse)
ALTER TABLE smart_analysis ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read" ON smart_analysis
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Allow service role all" ON smart_analysis
  FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE smart_analysis IS 'Yeni Smart Analyzer sistemi için analiz sonuçları';
COMMENT ON COLUMN smart_analysis.agreement IS 'Claude ve DeepSeek arasındaki uyum yüzdesi (0-100)';
COMMENT ON COLUMN smart_analysis.risk_level IS 'Tahmin risk seviyesi: low (yüksek uyum), medium, high (düşük uyum)';

