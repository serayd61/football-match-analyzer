-- ============================================================================
-- AGENT PERFORMANCE TRACKING SYSTEM
-- Öğrenen ve otomatik ağırlık ayarlayan agent sistemi
-- ============================================================================

-- Agent performans tablosu - her agent için detaylı performans takibi
CREATE TABLE IF NOT EXISTS agent_performance (
  id BIGSERIAL PRIMARY KEY,
  
  -- Agent bilgisi
  agent_name TEXT NOT NULL, -- 'stats', 'odds', 'deepAnalysis', 'masterStrategist'
  league TEXT, -- Lig adı (opsiyonel - lig bazlı performans için)
  
  -- Performans metrikleri (son 30 maç için)
  total_matches INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  
  -- Market bazlı doğruluk
  match_result_accuracy DECIMAL(5,2) DEFAULT 0.0, -- % doğruluk
  over_under_accuracy DECIMAL(5,2) DEFAULT 0.0,
  btts_accuracy DECIMAL(5,2) DEFAULT 0.0,
  
  -- Son 30 maç performansı (rolling window)
  recent_match_result_accuracy DECIMAL(5,2) DEFAULT 0.0,
  recent_over_under_accuracy DECIMAL(5,2) DEFAULT 0.0,
  recent_btts_accuracy DECIMAL(5,2) DEFAULT 0.0,
  
  -- Dinamik ağırlık (otomatik hesaplanan)
  current_weight DECIMAL(5,2) DEFAULT 1.0, -- Varsayılan ağırlık
  weight_history JSONB DEFAULT '[]'::jsonb, -- Ağırlık geçmişi
  
  -- Trend analizi
  trend_direction TEXT DEFAULT 'stable', -- 'improving', 'declining', 'stable'
  trend_strength DECIMAL(5,2) DEFAULT 0.0, -- Trend gücü (-100 to +100)
  
  -- Zaman damgaları
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(agent_name, league)
);

-- Agent tahmin kayıtları - her maç için agent tahminlerini sakla
CREATE TABLE IF NOT EXISTS agent_predictions (
  id BIGSERIAL PRIMARY KEY,
  
  -- Maç bilgisi
  fixture_id BIGINT NOT NULL,
  match_date DATE NOT NULL,
  league TEXT,
  
  -- Agent tahminleri
  agent_name TEXT NOT NULL,
  
  -- Tahminler
  match_result_prediction TEXT, -- '1', 'X', '2', 'home', 'away', 'draw'
  match_result_confidence INTEGER,
  match_result_correct BOOLEAN DEFAULT NULL, -- NULL = henüz sonuçlanmadı
  
  over_under_prediction TEXT, -- 'Over', 'Under'
  over_under_confidence INTEGER,
  over_under_correct BOOLEAN DEFAULT NULL,
  
  btts_prediction TEXT, -- 'Yes', 'No'
  btts_confidence INTEGER,
  btts_correct BOOLEAN DEFAULT NULL,
  
  -- Gerçek sonuçlar (maç sonuçlandığında)
  actual_match_result TEXT,
  actual_home_goals INTEGER,
  actual_away_goals INTEGER,
  actual_total_goals INTEGER,
  actual_btts BOOLEAN,
  
  -- Zaman damgaları
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT unique_agent_fixture UNIQUE(agent_name, fixture_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_performance_league ON agent_performance(league);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_fixture ON agent_predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_agent ON agent_predictions(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_settled ON agent_predictions(settled_at) WHERE settled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_predictions_unsettled ON agent_predictions(fixture_id, agent_name) WHERE settled_at IS NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Agent performansını güncelle (maç sonuçlandığında çağrılır)
CREATE OR REPLACE FUNCTION update_agent_performance()
RETURNS TRIGGER AS $$
DECLARE
  agent_perf RECORD;
  recent_count INTEGER;
  recent_correct_mr INTEGER;
  recent_correct_ou INTEGER;
  recent_correct_btts INTEGER;
  new_weight DECIMAL(5,2);
  trend_score DECIMAL(5,2);
BEGIN
  -- Agent performans kaydını bul veya oluştur
  SELECT * INTO agent_perf
  FROM agent_performance
  WHERE agent_name = NEW.agent_name
    AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Yeni kayıt oluştur
    INSERT INTO agent_performance (agent_name, league)
    VALUES (NEW.agent_name, NEW.league)
    RETURNING * INTO agent_perf;
  END IF;
  
  -- Performans metriklerini güncelle
  UPDATE agent_performance
  SET
    total_matches = total_matches + 1,
    correct_predictions = correct_predictions + CASE 
      WHEN NEW.match_result_correct = TRUE THEN 1 ELSE 0 
    END,
    match_result_accuracy = CASE 
      WHEN total_matches > 0 THEN 
        (correct_predictions::DECIMAL + CASE WHEN NEW.match_result_correct = TRUE THEN 1 ELSE 0 END) / 
        (total_matches + 1) * 100
      ELSE 0 
    END,
    last_updated = NOW()
  WHERE id = agent_perf.id;
  
  -- Son 30 maç performansını hesapla (rolling window)
  SELECT 
    COUNT(*) INTO recent_count
  FROM agent_predictions
  WHERE agent_name = NEW.agent_name
    AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
    AND settled_at IS NOT NULL
    AND settled_at >= NOW() - INTERVAL '90 days' -- Son 90 gün (yaklaşık 30 maç)
  ORDER BY settled_at DESC
  LIMIT 30;
  
  SELECT 
    COUNT(*) FILTER (WHERE match_result_correct = TRUE) INTO recent_correct_mr,
    COUNT(*) FILTER (WHERE over_under_correct = TRUE) INTO recent_correct_ou,
    COUNT(*) FILTER (WHERE btts_correct = TRUE) INTO recent_correct_btts
  FROM agent_predictions
  WHERE agent_name = NEW.agent_name
    AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
    AND settled_at IS NOT NULL
    AND settled_at >= NOW() - INTERVAL '90 days'
  ORDER BY settled_at DESC
  LIMIT 30;
  
  -- Dinamik ağırlık hesapla (performansa göre)
  -- Formül: Base weight * (accuracy_multiplier + trend_bonus)
  -- accuracy_multiplier: %50 = 1.0, %60 = 1.2, %70 = 1.4, %40 = 0.8, %30 = 0.6
  -- trend_bonus: improving = +0.1, declining = -0.1, stable = 0
  
  DECLARE
    accuracy DECIMAL(5,2);
    accuracy_multiplier DECIMAL(5,2);
    trend_bonus DECIMAL(5,2);
  BEGIN
    -- Son 30 maç doğruluğu
    accuracy := CASE 
      WHEN recent_count > 0 THEN (recent_correct_mr::DECIMAL / recent_count) * 100
      ELSE 50.0
    END;
    
    -- Accuracy multiplier hesapla
    accuracy_multiplier := CASE
      WHEN accuracy >= 70 THEN 1.4
      WHEN accuracy >= 65 THEN 1.3
      WHEN accuracy >= 60 THEN 1.2
      WHEN accuracy >= 55 THEN 1.1
      WHEN accuracy >= 50 THEN 1.0
      WHEN accuracy >= 45 THEN 0.9
      WHEN accuracy >= 40 THEN 0.8
      WHEN accuracy >= 35 THEN 0.7
      ELSE 0.6
    END;
    
    -- Trend bonus hesapla (son 10 maç vs önceki 10 maç)
    -- TODO: Trend hesaplaması daha sonra eklenecek
    trend_bonus := 0.0;
    
    -- Yeni ağırlık hesapla (min 0.5, max 2.0)
    new_weight := GREATEST(0.5, LEAST(2.0, 1.0 * accuracy_multiplier + trend_bonus));
    
    -- Ağırlık geçmişine ekle
    UPDATE agent_performance
    SET
      recent_match_result_accuracy = accuracy,
      current_weight = new_weight,
      weight_history = weight_history || jsonb_build_object(
        'date', NOW(),
        'weight', new_weight,
        'accuracy', accuracy,
        'matches', recent_count
      ),
      last_updated = NOW()
    WHERE id = agent_perf.id;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Agent prediction settled olduğunda performansı güncelle
CREATE TRIGGER trigger_update_agent_performance
AFTER UPDATE OF settled_at ON agent_predictions
FOR EACH ROW
WHEN (OLD.settled_at IS NULL AND NEW.settled_at IS NOT NULL)
EXECUTE FUNCTION update_agent_performance();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Agent performans özeti (dashboard için)
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  agent_name,
  league,
  total_matches,
  correct_predictions,
  match_result_accuracy,
  recent_match_result_accuracy,
  current_weight,
  trend_direction,
  last_updated
FROM agent_performance
ORDER BY current_weight DESC, recent_match_result_accuracy DESC;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Agent ağırlıklarını getir (unified consensus için)
CREATE OR REPLACE FUNCTION get_agent_weights(p_league TEXT DEFAULT NULL)
RETURNS TABLE (
  agent_name TEXT,
  weight DECIMAL(5,2),
  accuracy DECIMAL(5,2),
  trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.agent_name,
    ap.current_weight,
    ap.recent_match_result_accuracy,
    ap.trend_direction
  FROM agent_performance ap
  WHERE (p_league IS NULL OR ap.league = p_league)
    AND ap.total_matches >= 5 -- En az 5 maç verisi olmalı
  ORDER BY ap.current_weight DESC;
END;
$$ LANGUAGE plpgsql;
