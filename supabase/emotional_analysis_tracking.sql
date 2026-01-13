-- ============================================================================
-- EMOTIONAL ANALYSIS TRACKING
-- Agent'ların duygusal analiz skorlarını takip eder
-- ============================================================================

-- Tablo oluştur
CREATE TABLE IF NOT EXISTS agent_emotional_analysis (
  id BIGSERIAL PRIMARY KEY,
  agent_name VARCHAR(50) NOT NULL,
  fixture_id INTEGER NOT NULL,
  emotional_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100: Duygusal analizin katkısı
  data_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100: Veri analizinin katkısı
  emotional_weight DECIMAL(3,2) DEFAULT 0.5, -- 0-1: Duygusal analizin ağırlığı
  data_weight DECIMAL(3,2) DEFAULT 0.5, -- 0-1: Veri analizinin ağırlığı
  emotional_factors JSONB DEFAULT '[]'::jsonb, -- Kullanılan duygusal faktörler
  prediction_correct BOOLEAN DEFAULT NULL, -- Tahmin doğru mu?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_name, fixture_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_agent ON agent_emotional_analysis(agent_name);
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_fixture ON agent_emotional_analysis(fixture_id);
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_correct ON agent_emotional_analysis(prediction_correct) WHERE prediction_correct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emotional_analysis_created ON agent_emotional_analysis(created_at);

-- View: Agent bazında duygusal analiz performansı
CREATE OR REPLACE VIEW agent_emotional_performance AS
SELECT 
  agent_name,
  COUNT(*) as total_predictions,
  COUNT(CASE WHEN prediction_correct IS NOT NULL THEN 1 END) as settled_predictions,
  COUNT(CASE WHEN prediction_correct = TRUE THEN 1 END) as correct_predictions,
  ROUND(
    AVG(CASE WHEN prediction_correct IS NOT NULL AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric,
    2
  ) as overall_accuracy,
  ROUND(AVG(emotional_weight)::numeric * 100, 2) as avg_emotional_weight,
  ROUND(AVG(data_weight)::numeric * 100, 2) as avg_data_weight,
  -- Duygusal ağırlıklı tahminlerin doğruluğu
  COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) as emotional_predictions,
  COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct = TRUE THEN 1 END) as emotional_correct,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN emotional_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) > 0
      THEN AVG(CASE WHEN emotional_weight >= 0.4 AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric
      ELSE 0
    END,
    2
  ) as emotional_accuracy,
  -- Veri ağırlıklı tahminlerin doğruluğu
  COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) as data_predictions,
  COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct = TRUE THEN 1 END) as data_correct,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN data_weight >= 0.4 AND prediction_correct IS NOT NULL THEN 1 END) > 0
      THEN AVG(CASE WHEN data_weight >= 0.4 AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric
      ELSE 0
    END,
    2
  ) as data_accuracy,
  -- Kombine kullanım (her ikisi de >= 0.3)
  COUNT(CASE WHEN emotional_weight >= 0.3 AND data_weight >= 0.3 AND prediction_correct IS NOT NULL THEN 1 END) as combined_predictions,
  COUNT(CASE WHEN emotional_weight >= 0.3 AND data_weight >= 0.3 AND prediction_correct = TRUE THEN 1 END) as combined_correct,
  ROUND(
    CASE 
      WHEN COUNT(CASE WHEN emotional_weight >= 0.3 AND data_weight >= 0.3 AND prediction_correct IS NOT NULL THEN 1 END) > 0
      THEN AVG(CASE WHEN emotional_weight >= 0.3 AND data_weight >= 0.3 AND prediction_correct = TRUE THEN 100.0 ELSE 0.0 END)::numeric
      ELSE 0
    END,
    2
  ) as combined_accuracy
FROM agent_emotional_analysis
GROUP BY agent_name;

-- RLS Policies
ALTER TABLE agent_emotional_analysis ENABLE ROW LEVEL SECURITY;

-- Service role her şeyi yapabilir
CREATE POLICY "Service role full access" ON agent_emotional_analysis
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Anon role sadece okuma yapabilir
CREATE POLICY "Anon read access" ON agent_emotional_analysis
  FOR SELECT
  USING (true);

-- Grant permissions
GRANT SELECT ON agent_emotional_analysis TO anon;
GRANT SELECT ON agent_emotional_performance TO anon;
