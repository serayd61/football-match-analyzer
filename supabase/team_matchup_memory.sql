-- ============================================================================
-- TEAM MATCHUP MEMORY SYSTEM
-- Takım eşleşme hafızası - Ajanların öğrenmesi için
-- ============================================================================

-- 1. Ana tablo: Takım eşleşme hafızası
CREATE TABLE IF NOT EXISTS team_matchup_memory (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  
  -- Maç istatistikleri
  total_matches INTEGER DEFAULT 0,
  home_wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  away_wins INTEGER DEFAULT 0,
  
  -- Gol istatistikleri
  avg_total_goals DECIMAL(4,2) DEFAULT 0,
  btts_rate DECIMAL(5,2) DEFAULT 0,
  over_25_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Son maç bilgisi
  last_match_result VARCHAR(1), -- '1', 'X', '2'
  last_match_score VARCHAR(10), -- '2-1'
  last_match_date TIMESTAMP,
  
  -- Pattern'ler (JSON array)
  patterns JSONB DEFAULT '[]',
  
  -- Ajan bazlı doğruluk oranları (JSON)
  agent_accuracy JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(home_team_id, away_team_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_team_matchup_home ON team_matchup_memory(home_team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchup_away ON team_matchup_memory(away_team_id);
CREATE INDEX IF NOT EXISTS idx_team_matchup_updated ON team_matchup_memory(updated_at DESC);

-- 2. Takım performans hafızası (son N maç)
CREATE TABLE IF NOT EXISTS team_performance_memory (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL UNIQUE,
  team_name VARCHAR(255),
  league VARCHAR(255),
  
  -- Son 5 maç gol verileri (JSON array)
  last_5_goals JSONB DEFAULT '[]',
  last_5_conceded JSONB DEFAULT '[]',
  
  -- Hesaplanan istatistikler
  avg_goals_scored DECIMAL(4,2) DEFAULT 0,
  avg_goals_conceded DECIMAL(4,2) DEFAULT 0,
  clean_sheet_rate DECIMAL(5,2) DEFAULT 0,
  failed_to_score_rate DECIMAL(5,2) DEFAULT 0,
  over_25_rate DECIMAL(5,2) DEFAULT 0,
  btts_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Form (son 5 maç: W/D/L)
  home_form VARCHAR(10),
  away_form VARCHAR(10),
  
  -- Tespit edilen pattern'ler
  patterns JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_team_perf_team ON team_performance_memory(team_id);
CREATE INDEX IF NOT EXISTS idx_team_perf_league ON team_performance_memory(league);

-- 3. Ajan öğrenme logları
CREATE TABLE IF NOT EXISTS agent_learning_log (
  id SERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  agent_name VARCHAR(50) NOT NULL,
  
  -- Tahmin bilgileri
  prediction_type VARCHAR(20), -- 'matchResult', 'overUnder', 'btts'
  prediction VARCHAR(20),
  confidence INTEGER,
  
  -- Sonuç
  actual_result VARCHAR(20),
  was_correct BOOLEAN,
  
  -- Öğrenme context'i
  learning_context JSONB,
  
  -- Hangi pattern'ler kullanıldı
  patterns_used JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(fixture_id, agent_name, prediction_type)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_agent_learning_agent ON agent_learning_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_learning_correct ON agent_learning_log(was_correct);
CREATE INDEX IF NOT EXISTS idx_agent_learning_date ON agent_learning_log(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Takım eşleşme hafızasını güncelle (maç sonrası)
CREATE OR REPLACE FUNCTION update_team_matchup_after_match()
RETURNS TRIGGER AS $$
DECLARE
  v_home_team_id INTEGER;
  v_away_team_id INTEGER;
  v_match_result VARCHAR(1);
  v_home_goals INTEGER;
  v_away_goals INTEGER;
  v_total_goals INTEGER;
  v_btts BOOLEAN;
  v_over_25 BOOLEAN;
  v_existing RECORD;
BEGIN
  -- Sadece settled olan tahminler için çalış
  IF NEW.settled_at IS NULL OR OLD.settled_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Fixture bilgilerini al (unified_analysis'ten)
  SELECT 
    home_team_id, 
    away_team_id,
    actual_home_goals,
    actual_away_goals
  INTO v_home_team_id, v_away_team_id, v_home_goals, v_away_goals
  FROM unified_analysis
  WHERE fixture_id = NEW.fixture_id
  LIMIT 1;
  
  IF v_home_team_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Sonuçları hesapla
  v_total_goals := COALESCE(v_home_goals, 0) + COALESCE(v_away_goals, 0);
  v_btts := COALESCE(v_home_goals, 0) > 0 AND COALESCE(v_away_goals, 0) > 0;
  v_over_25 := v_total_goals > 2;
  
  IF COALESCE(v_home_goals, 0) > COALESCE(v_away_goals, 0) THEN
    v_match_result := '1';
  ELSIF COALESCE(v_home_goals, 0) < COALESCE(v_away_goals, 0) THEN
    v_match_result := '2';
  ELSE
    v_match_result := 'X';
  END IF;
  
  -- Mevcut kaydı kontrol et
  SELECT * INTO v_existing
  FROM team_matchup_memory
  WHERE home_team_id = v_home_team_id AND away_team_id = v_away_team_id;
  
  IF v_existing IS NULL THEN
    -- Yeni kayıt oluştur
    INSERT INTO team_matchup_memory (
      home_team_id, away_team_id,
      total_matches, home_wins, draws, away_wins,
      avg_total_goals, btts_rate, over_25_rate,
      last_match_result, last_match_score, last_match_date
    ) VALUES (
      v_home_team_id, v_away_team_id,
      1,
      CASE WHEN v_match_result = '1' THEN 1 ELSE 0 END,
      CASE WHEN v_match_result = 'X' THEN 1 ELSE 0 END,
      CASE WHEN v_match_result = '2' THEN 1 ELSE 0 END,
      v_total_goals,
      CASE WHEN v_btts THEN 100 ELSE 0 END,
      CASE WHEN v_over_25 THEN 100 ELSE 0 END,
      v_match_result,
      v_home_goals || '-' || v_away_goals,
      NOW()
    );
  ELSE
    -- Mevcut kaydı güncelle
    UPDATE team_matchup_memory SET
      total_matches = v_existing.total_matches + 1,
      home_wins = v_existing.home_wins + CASE WHEN v_match_result = '1' THEN 1 ELSE 0 END,
      draws = v_existing.draws + CASE WHEN v_match_result = 'X' THEN 1 ELSE 0 END,
      away_wins = v_existing.away_wins + CASE WHEN v_match_result = '2' THEN 1 ELSE 0 END,
      avg_total_goals = ((v_existing.avg_total_goals * v_existing.total_matches) + v_total_goals) / (v_existing.total_matches + 1),
      btts_rate = ((v_existing.btts_rate * v_existing.total_matches) + CASE WHEN v_btts THEN 100 ELSE 0 END) / (v_existing.total_matches + 1),
      over_25_rate = ((v_existing.over_25_rate * v_existing.total_matches) + CASE WHEN v_over_25 THEN 100 ELSE 0 END) / (v_existing.total_matches + 1),
      last_match_result = v_match_result,
      last_match_score = v_home_goals || '-' || v_away_goals,
      last_match_date = NOW(),
      updated_at = NOW()
    WHERE home_team_id = v_home_team_id AND away_team_id = v_away_team_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur
DROP TRIGGER IF EXISTS trg_update_team_matchup ON agent_predictions;
CREATE TRIGGER trg_update_team_matchup
AFTER UPDATE ON agent_predictions
FOR EACH ROW
WHEN (NEW.settled_at IS NOT NULL AND OLD.settled_at IS NULL)
EXECUTE FUNCTION update_team_matchup_after_match();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Takım eşleşme özeti view'ı
CREATE OR REPLACE VIEW v_team_matchup_summary AS
SELECT 
  tmm.*,
  CASE 
    WHEN avg_total_goals < 2.0 THEN 'LOW_SCORING'
    WHEN avg_total_goals > 3.0 THEN 'HIGH_SCORING'
    ELSE 'NORMAL'
  END as scoring_tendency,
  CASE 
    WHEN btts_rate < 30 THEN 'BTTS_UNLIKELY'
    WHEN btts_rate > 70 THEN 'BTTS_LIKELY'
    ELSE 'BTTS_NEUTRAL'
  END as btts_tendency,
  CASE 
    WHEN over_25_rate < 30 THEN 'UNDER_PRONE'
    WHEN over_25_rate > 70 THEN 'OVER_PRONE'
    ELSE 'NEUTRAL'
  END as over_under_tendency
FROM team_matchup_memory tmm
WHERE total_matches >= 2;

-- Ajan öğrenme özeti
CREATE OR REPLACE VIEW v_agent_learning_summary AS
SELECT 
  agent_name,
  prediction_type,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy,
  AVG(confidence) as avg_confidence
FROM agent_learning_log
GROUP BY agent_name, prediction_type
ORDER BY agent_name, prediction_type;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON team_matchup_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE ON team_performance_memory TO authenticated;
GRANT SELECT, INSERT ON agent_learning_log TO authenticated;
GRANT SELECT ON v_team_matchup_summary TO authenticated;
GRANT SELECT ON v_agent_learning_summary TO authenticated;

-- Sequence permissions
GRANT USAGE, SELECT ON SEQUENCE team_matchup_memory_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE team_performance_memory_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agent_learning_log_id_seq TO authenticated;

COMMENT ON TABLE team_matchup_memory IS 'Takım eşleşme hafızası - İki takım arasındaki geçmiş maç pattern''leri';
COMMENT ON TABLE team_performance_memory IS 'Takım performans hafızası - Takımın son maçlardaki performansı';
COMMENT ON TABLE agent_learning_log IS 'Ajan öğrenme logları - Hangi tahminler doğru/yanlış çıktı';
