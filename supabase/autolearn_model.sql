-- ============================================================================
-- AUTOLEARN AGENT - Kendini Gelistiren Ajan
-- Model parametrelerini saklayan tablo ve index'ler
-- ============================================================================

-- ============================================================================
-- 1. AUTOLEARN MODEL TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS autolearn_model (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_type TEXT NOT NULL,           -- 'confidence_cal', 'agent_combo', 'league_spec', 'meta_feature', 'temporal'
  market TEXT NOT NULL,                -- 'mr', 'ou', 'btts'
  feature_key TEXT NOT NULL,           -- e.g. 'stats_agent|65-69', 'stats+deep_agree', 'premier_league|stats'
  total_matches INTEGER DEFAULT 0,
  correct_matches INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  weight DECIMAL(5,3) DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_type, market, feature_key)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_autolearn_type_market 
ON autolearn_model(model_type, market);

CREATE INDEX IF NOT EXISTS idx_autolearn_feature 
ON autolearn_model(feature_key);

CREATE INDEX IF NOT EXISTS idx_autolearn_accuracy 
ON autolearn_model(accuracy DESC);

-- ============================================================================
-- 3. AUTOLEARN PREDICTIONS LOG (izleme icin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS autolearn_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  market TEXT NOT NULL,                -- 'mr', 'ou', 'btts'
  prediction TEXT NOT NULL,            -- '1', '2', 'X', 'Over', 'Under', 'Yes', 'No'
  confidence DECIMAL(5,2) NOT NULL,
  autolearn_score DECIMAL(5,2),        -- AutoLearn'in urettigi skor
  features_used JSONB DEFAULT '{}',    -- Hangi feature'lar kullanildi
  is_correct BOOLEAN,                  -- Settlement sonrasi
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autolearn_pred_fixture 
ON autolearn_predictions(fixture_id);

CREATE INDEX IF NOT EXISTS idx_autolearn_pred_settled 
ON autolearn_predictions(is_correct) WHERE is_correct IS NOT NULL;

-- ============================================================================
-- 4. RLS POLICIES & PERMISSIONS
-- ============================================================================

-- RLS'yi devre disi birak (service_role zaten bypass eder, ama anon icin de gerekli)
ALTER TABLE autolearn_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE autolearn_predictions ENABLE ROW LEVEL SECURITY;

-- Tum roller icin tam erisim policy'leri
CREATE POLICY "autolearn_model_all" ON autolearn_model FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "autolearn_predictions_all" ON autolearn_predictions FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON autolearn_model TO anon, authenticated, service_role;
GRANT ALL ON autolearn_predictions TO anon, authenticated, service_role;

-- ============================================================================
-- DONE
-- ============================================================================
SELECT 'AutoLearn model tables created successfully.' as status;
