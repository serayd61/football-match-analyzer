-- ============================================================================
-- ADVANCED AGENT LEARNING SYSTEM (MDAW)
-- Multi-Dimensional Adaptive Weighting System
-- ============================================================================

-- ============================================================================
-- SCHEMA UPDATES
-- ============================================================================

-- 1. agent_predictions tablosuna yeni kolonlar ekle
ALTER TABLE agent_predictions 
ADD COLUMN IF NOT EXISTS predicted_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS odds_at_prediction DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS potential_roi DECIMAL(6,2);

-- 2. agent_performance tablosuna yeni kolonlar ekle
ALTER TABLE agent_performance
ADD COLUMN IF NOT EXISTS calibration_score DECIMAL(5,2) DEFAULT 50.0,
ADD COLUMN IF NOT EXISTS roi_score DECIMAL(5,2) DEFAULT 50.0,
ADD COLUMN IF NOT EXISTS momentum_factor DECIMAL(4,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS specialization_bonus DECIMAL(4,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS market_accuracies JSONB DEFAULT '{"matchResult": 50, "overUnder": 50, "btts": 50}'::jsonb,
ADD COLUMN IF NOT EXISTS recent_5_accuracy DECIMAL(5,2) DEFAULT 50.0,
ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2) DEFAULT 50.0,
ADD COLUMN IF NOT EXISTS maturity_ratio DECIMAL(4,2) DEFAULT 0.0;

-- 3. Yeni index'ler
CREATE INDEX IF NOT EXISTS idx_agent_predictions_confidence ON agent_predictions(predicted_confidence);
CREATE INDEX IF NOT EXISTS idx_agent_performance_score ON agent_performance(performance_score DESC);

-- ============================================================================
-- MDAW HELPER FUNCTIONS
-- ============================================================================

-- Performance Score hesapla (0-100 arası)
-- Formula: (0.4 × AccuracyScore) + (0.3 × CalibrationScore) + (0.3 × ROIScore)
CREATE OR REPLACE FUNCTION calculate_performance_score(
  p_accuracy DECIMAL,
  p_calibration DECIMAL,
  p_roi DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  RETURN GREATEST(0, LEAST(100, 
    (0.4 * COALESCE(p_accuracy, 50)) + 
    (0.3 * COALESCE(p_calibration, 50)) + 
    (0.3 * COALESCE(p_roi, 50))
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Performance Multiplier hesapla (dinamik aralık)
CREATE OR REPLACE FUNCTION calculate_performance_multiplier(
  p_performance_score DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  base_mult DECIMAL;
  range_mult DECIMAL;
BEGIN
  -- Performance Score'a göre multiplier aralığı
  IF p_performance_score >= 75 THEN
    -- Elit: 2.5x - 3.5x
    base_mult := 2.5;
    range_mult := (p_performance_score - 75) / 25 * 1.0;
  ELSIF p_performance_score >= 65 THEN
    -- Çok İyi: 1.8x - 2.5x
    base_mult := 1.8;
    range_mult := (p_performance_score - 65) / 10 * 0.7;
  ELSIF p_performance_score >= 55 THEN
    -- İyi: 1.2x - 1.8x
    base_mult := 1.2;
    range_mult := (p_performance_score - 55) / 10 * 0.6;
  ELSIF p_performance_score >= 45 THEN
    -- Ortalama: 0.8x - 1.2x
    base_mult := 0.8;
    range_mult := (p_performance_score - 45) / 10 * 0.4;
  ELSIF p_performance_score >= 35 THEN
    -- Zayıf: 0.4x - 0.8x
    base_mult := 0.4;
    range_mult := (p_performance_score - 35) / 10 * 0.4;
  ELSE
    -- Çok Zayıf: 0.2x - 0.4x
    base_mult := 0.2;
    range_mult := p_performance_score / 35 * 0.2;
  END IF;
  
  RETURN base_mult + range_mult;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Specialization Bonus hesapla
-- Formula: 1.0 + (LeagueExpertise × 0.3) + (MarketExpertise × 0.2)
CREATE OR REPLACE FUNCTION calculate_specialization_bonus(
  p_league_accuracy DECIMAL,
  p_global_accuracy DECIMAL,
  p_market_accuracy DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  league_expertise DECIMAL;
  market_expertise DECIMAL;
BEGIN
  -- League expertise: (league_accuracy - global_accuracy) / 10
  league_expertise := GREATEST(-2, LEAST(2, (COALESCE(p_league_accuracy, p_global_accuracy) - COALESCE(p_global_accuracy, 50)) / 10));
  
  -- Market expertise: (market_accuracy - global_accuracy) / 10
  market_expertise := GREATEST(-2, LEAST(2, (COALESCE(p_market_accuracy, p_global_accuracy) - COALESCE(p_global_accuracy, 50)) / 10));
  
  -- Final bonus: 1.0 + (league × 0.3) + (market × 0.2)
  RETURN GREATEST(0.5, LEAST(2.0, 1.0 + (league_expertise * 0.3) + (market_expertise * 0.2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Momentum Factor hesapla
-- Formula: 1.0 + ((RecentAccuracy - HistoricalAccuracy) / 50)
CREATE OR REPLACE FUNCTION calculate_momentum_factor(
  p_recent_accuracy DECIMAL,
  p_historical_accuracy DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  momentum DECIMAL;
BEGIN
  momentum := 1.0 + ((COALESCE(p_recent_accuracy, 50) - COALESCE(p_historical_accuracy, 50)) / 50);
  -- Sınırlar: 0.7x - 1.3x
  RETURN GREATEST(0.7, LEAST(1.3, momentum));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Confidence Calibration Factor hesapla
CREATE OR REPLACE FUNCTION calculate_calibration_factor(
  p_avg_confidence DECIMAL,
  p_actual_hit_rate DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  calibration_error DECIMAL;
BEGIN
  calibration_error := ABS(COALESCE(p_avg_confidence, 50) - COALESCE(p_actual_hit_rate, 50));
  
  IF calibration_error < 5 THEN
    RETURN 1.1;
  ELSIF calibration_error < 10 THEN
    RETURN 1.0;
  ELSIF calibration_error < 20 THEN
    RETURN 0.9;
  ELSE
    RETURN 0.8;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Dinamik ağırlık aralığı hesapla (maturity'ye göre)
CREATE OR REPLACE FUNCTION calculate_weight_bounds(
  p_match_count INTEGER
) RETURNS TABLE (min_weight DECIMAL, max_weight DECIMAL) AS $$
DECLARE
  maturity_ratio DECIMAL;
BEGIN
  -- MinMatches = 10, MaxMatches = 100
  maturity_ratio := LEAST(1.0, GREATEST(0, (p_match_count - 10)::DECIMAL / 90));
  
  -- MinWeight: 0.5 → 0.2 (maturity arttıkça düşer)
  min_weight := 0.5 - (maturity_ratio * 0.3);
  
  -- MaxWeight: 2.0 → 3.5 (maturity arttıkça artar)
  max_weight := 2.0 + (maturity_ratio * 1.5);
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- MAIN ADVANCED WEIGHT CALCULATION
-- ============================================================================

-- Ana gelişmiş ağırlık hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_advanced_weight(
  p_agent_name TEXT,
  p_league TEXT DEFAULT NULL,
  p_market TEXT DEFAULT 'matchResult'
) RETURNS DECIMAL AS $$
DECLARE
  v_accuracy DECIMAL;
  v_calibration DECIMAL;
  v_roi DECIMAL;
  v_performance_score DECIMAL;
  v_performance_mult DECIMAL;
  v_specialization DECIMAL;
  v_momentum DECIMAL;
  v_calibration_factor DECIMAL;
  v_global_accuracy DECIMAL;
  v_market_accuracy DECIMAL;
  v_recent_5 DECIMAL;
  v_match_count INTEGER;
  v_min_weight DECIMAL;
  v_max_weight DECIMAL;
  v_final_weight DECIMAL;
  v_perf RECORD;
BEGIN
  -- Agent performans verisini al
  SELECT * INTO v_perf
  FROM agent_performance
  WHERE agent_name = p_agent_name
    AND (league = p_league OR (p_league IS NULL AND league IS NULL))
  LIMIT 1;
  
  -- Veri yoksa varsayılan döndür
  IF NOT FOUND THEN
    RETURN 1.0;
  END IF;
  
  -- Değerleri al
  v_accuracy := COALESCE(v_perf.recent_match_result_accuracy, 50);
  v_calibration := COALESCE(v_perf.calibration_score, 50);
  v_roi := COALESCE(v_perf.roi_score, 50);
  v_recent_5 := COALESCE(v_perf.recent_5_accuracy, v_accuracy);
  v_match_count := COALESCE(v_perf.total_matches, 0);
  
  -- Global accuracy (tüm ligler için)
  SELECT AVG(recent_match_result_accuracy) INTO v_global_accuracy
  FROM agent_performance
  WHERE agent_name = p_agent_name;
  
  -- Market accuracy
  v_market_accuracy := CASE p_market
    WHEN 'matchResult' THEN v_perf.recent_match_result_accuracy
    WHEN 'overUnder' THEN v_perf.recent_over_under_accuracy
    WHEN 'btts' THEN v_perf.recent_btts_accuracy
    ELSE v_accuracy
  END;
  
  -- 1. Performance Score hesapla
  v_performance_score := calculate_performance_score(v_accuracy, v_calibration, v_roi);
  
  -- 2. Performance Multiplier
  v_performance_mult := calculate_performance_multiplier(v_performance_score);
  
  -- 3. Specialization Bonus
  v_specialization := calculate_specialization_bonus(v_accuracy, v_global_accuracy, v_market_accuracy);
  
  -- 4. Momentum Factor
  v_momentum := calculate_momentum_factor(v_recent_5, v_accuracy);
  
  -- 5. Calibration Factor
  v_calibration_factor := calculate_calibration_factor(
    (SELECT AVG(predicted_confidence) FROM agent_predictions WHERE agent_name = p_agent_name AND settled_at IS NOT NULL),
    v_accuracy
  );
  
  -- 6. Dinamik ağırlık aralığı
  SELECT * INTO v_min_weight, v_max_weight FROM calculate_weight_bounds(v_match_count);
  
  -- 7. Final Weight hesapla
  -- Formula: BaseWeight × PerformanceMultiplier × SpecializationBonus × MomentumFactor × CalibrationFactor
  v_final_weight := 1.0 * v_performance_mult * v_specialization * v_momentum * v_calibration_factor;
  
  -- Sınırları uygula
  v_final_weight := GREATEST(v_min_weight, LEAST(v_max_weight, v_final_weight));
  
  RETURN ROUND(v_final_weight, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATED TRIGGER FUNCTION
-- ============================================================================

-- Gelişmiş agent performans güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_agent_performance_advanced()
RETURNS TRIGGER AS $$
DECLARE
  v_perf RECORD;
  v_recent_count INTEGER;
  v_recent_5_count INTEGER;
  v_recent_correct_mr INTEGER;
  v_recent_correct_ou INTEGER;
  v_recent_correct_btts INTEGER;
  v_recent_5_correct INTEGER;
  v_avg_confidence DECIMAL;
  v_actual_hit_rate DECIMAL;
  v_calibration_score DECIMAL;
  v_roi_score DECIMAL;
  v_performance_score DECIMAL;
  v_momentum DECIMAL;
  v_specialization DECIMAL;
  v_new_weight DECIMAL;
  v_min_weight DECIMAL;
  v_max_weight DECIMAL;
  v_maturity DECIMAL;
BEGIN
  -- Agent performans kaydını bul veya oluştur
  SELECT * INTO v_perf
  FROM agent_performance
  WHERE agent_name = NEW.agent_name
    AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
  FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO agent_performance (agent_name, league)
    VALUES (NEW.agent_name, NEW.league)
    RETURNING * INTO v_perf;
  END IF;
  
  -- Son 30 maç performansını hesapla
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE match_result_correct = TRUE),
    COUNT(*) FILTER (WHERE over_under_correct = TRUE),
    COUNT(*) FILTER (WHERE btts_correct = TRUE),
    AVG(COALESCE(predicted_confidence, match_result_confidence))
  INTO 
    v_recent_count,
    v_recent_correct_mr,
    v_recent_correct_ou,
    v_recent_correct_btts,
    v_avg_confidence
  FROM (
    SELECT *
    FROM agent_predictions
    WHERE agent_name = NEW.agent_name
      AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
      AND settled_at IS NOT NULL
      AND settled_at >= NOW() - INTERVAL '90 days'
    ORDER BY settled_at DESC
    LIMIT 30
  ) AS recent_matches;
  
  -- Son 5 maç performansını hesapla (momentum için)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE match_result_correct = TRUE)
  INTO 
    v_recent_5_count,
    v_recent_5_correct
  FROM (
    SELECT *
    FROM agent_predictions
    WHERE agent_name = NEW.agent_name
      AND (league = NEW.league OR (league IS NULL AND NEW.league IS NULL))
      AND settled_at IS NOT NULL
    ORDER BY settled_at DESC
    LIMIT 5
  ) AS recent_5;
  
  -- Accuracy hesapla
  DECLARE
    v_accuracy DECIMAL;
    v_recent_5_accuracy DECIMAL;
    v_ou_accuracy DECIMAL;
    v_btts_accuracy DECIMAL;
  BEGIN
    v_accuracy := CASE WHEN v_recent_count > 0 THEN (v_recent_correct_mr::DECIMAL / v_recent_count) * 100 ELSE 50.0 END;
    v_recent_5_accuracy := CASE WHEN v_recent_5_count > 0 THEN (v_recent_5_correct::DECIMAL / v_recent_5_count) * 100 ELSE v_accuracy END;
    v_ou_accuracy := CASE WHEN v_recent_count > 0 THEN (v_recent_correct_ou::DECIMAL / v_recent_count) * 100 ELSE 50.0 END;
    v_btts_accuracy := CASE WHEN v_recent_count > 0 THEN (v_recent_correct_btts::DECIMAL / v_recent_count) * 100 ELSE 50.0 END;
    
    -- Calibration Score hesapla
    v_actual_hit_rate := v_accuracy;
    v_calibration_score := 100 - (ABS(COALESCE(v_avg_confidence, 50) - v_actual_hit_rate) * 2);
    v_calibration_score := GREATEST(0, LEAST(100, v_calibration_score));
    
    -- ROI Score (şimdilik basit - ileride odds ile hesaplanacak)
    v_roi_score := v_accuracy; -- Placeholder
    
    -- Performance Score
    v_performance_score := calculate_performance_score(v_accuracy, v_calibration_score, v_roi_score);
    
    -- Momentum Factor
    v_momentum := calculate_momentum_factor(v_recent_5_accuracy, v_accuracy);
    
    -- Maturity Ratio
    v_maturity := LEAST(1.0, GREATEST(0, (v_perf.total_matches + 1 - 10)::DECIMAL / 90));
    
    -- Dinamik ağırlık aralığı
    SELECT * INTO v_min_weight, v_max_weight FROM calculate_weight_bounds(v_perf.total_matches + 1);
    
    -- Yeni ağırlık hesapla (MDAW formülü)
    v_new_weight := calculate_advanced_weight(NEW.agent_name, NEW.league, 'matchResult');
    
    -- Agent performance tablosunu güncelle
    UPDATE agent_performance
    SET
      total_matches = total_matches + 1,
      correct_predictions = correct_predictions + CASE WHEN NEW.match_result_correct = TRUE THEN 1 ELSE 0 END,
      recent_match_result_accuracy = v_accuracy,
      recent_over_under_accuracy = v_ou_accuracy,
      recent_btts_accuracy = v_btts_accuracy,
      recent_5_accuracy = v_recent_5_accuracy,
      calibration_score = v_calibration_score,
      roi_score = v_roi_score,
      performance_score = v_performance_score,
      momentum_factor = v_momentum,
      maturity_ratio = v_maturity,
      market_accuracies = jsonb_build_object(
        'matchResult', v_accuracy,
        'overUnder', v_ou_accuracy,
        'btts', v_btts_accuracy
      ),
      current_weight = v_new_weight,
      weight_history = weight_history || jsonb_build_object(
        'date', NOW(),
        'weight', v_new_weight,
        'accuracy', v_accuracy,
        'matches', v_perf.total_matches + 1,
        'performance_score', v_performance_score,
        'momentum', v_momentum,
        'calibration', v_calibration_score
      ),
      last_updated = NOW()
    WHERE id = v_perf.id;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eski trigger'ı kaldır ve yenisini ekle
DROP TRIGGER IF EXISTS trigger_update_agent_performance ON agent_predictions;

CREATE TRIGGER trigger_update_agent_performance_advanced
AFTER UPDATE OF settled_at ON agent_predictions
FOR EACH ROW
WHEN (OLD.settled_at IS NULL AND NEW.settled_at IS NOT NULL)
EXECUTE FUNCTION update_agent_performance_advanced();

-- ============================================================================
-- ADVANCED WEIGHT RETRIEVAL
-- ============================================================================

-- Gelişmiş agent ağırlıklarını getir (market bazlı)
CREATE OR REPLACE FUNCTION get_advanced_agent_weights(
  p_league TEXT DEFAULT NULL,
  p_market TEXT DEFAULT 'matchResult'
) RETURNS TABLE (
  agent_name TEXT,
  weight DECIMAL,
  performance_score DECIMAL,
  momentum DECIMAL,
  calibration DECIMAL,
  accuracy DECIMAL,
  match_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.agent_name,
    calculate_advanced_weight(ap.agent_name, p_league, p_market) as weight,
    ap.performance_score,
    ap.momentum_factor as momentum,
    ap.calibration_score as calibration,
    CASE p_market
      WHEN 'matchResult' THEN ap.recent_match_result_accuracy
      WHEN 'overUnder' THEN ap.recent_over_under_accuracy
      WHEN 'btts' THEN ap.recent_btts_accuracy
      ELSE ap.recent_match_result_accuracy
    END as accuracy,
    ap.total_matches as match_count
  FROM agent_performance ap
  WHERE (p_league IS NULL OR ap.league = p_league)
    AND ap.total_matches >= 5
  ORDER BY weight DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Gelişmiş agent performans özeti
CREATE OR REPLACE VIEW agent_performance_advanced_summary AS
SELECT 
  agent_name,
  league,
  total_matches,
  correct_predictions,
  recent_match_result_accuracy,
  recent_over_under_accuracy,
  recent_btts_accuracy,
  recent_5_accuracy,
  performance_score,
  momentum_factor,
  calibration_score,
  roi_score,
  maturity_ratio,
  current_weight,
  market_accuracies,
  last_updated
FROM agent_performance
ORDER BY performance_score DESC, current_weight DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION calculate_advanced_weight IS 'MDAW (Multi-Dimensional Adaptive Weighting) ana hesaplama fonksiyonu';
COMMENT ON FUNCTION calculate_performance_score IS 'Performance Score: (0.4 × Accuracy) + (0.3 × Calibration) + (0.3 × ROI)';
COMMENT ON FUNCTION calculate_performance_multiplier IS 'Performance Score''a göre dinamik multiplier (0.2x - 3.5x)';
COMMENT ON FUNCTION calculate_specialization_bonus IS 'Lig ve market bazlı uzmanlık bonusu';
COMMENT ON FUNCTION calculate_momentum_factor IS 'Son 5 maç vs son 30 maç karşılaştırması ile ivme faktörü';
COMMENT ON FUNCTION calculate_calibration_factor IS 'Tahmin güveni ile gerçek başarı oranı uyumu';
