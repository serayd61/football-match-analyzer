-- ═══════════════════════════════════════════════════════════════════════════
-- ENHANCED PREDICTION TRACKING SYSTEM
-- Professional-grade AI prediction analytics
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS ai_model_predictions CASCADE;
DROP TABLE IF EXISTS prediction_sessions CASCADE;
DROP TABLE IF EXISTS model_accuracy_stats CASCADE;
DROP TABLE IF EXISTS market_performance CASCADE;
DROP TABLE IF EXISTS daily_model_summary CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PREDICTION SESSIONS - Ana tahmin kaydı (her maç için tek kayıt)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE prediction_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Match Info
    fixture_id BIGINT NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    league VARCHAR(255),
    match_date TIMESTAMPTZ NOT NULL,
    
    -- Session Info
    prediction_source VARCHAR(50) NOT NULL, -- 'quad_brain', 'ai_agents', 'consensus'
    session_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'daily_coupon', 'auto'
    
    -- Consensus Results (Combined decision)
    consensus_btts VARCHAR(10), -- 'yes', 'no'
    consensus_btts_confidence DECIMAL(5,2),
    consensus_over_under VARCHAR(20), -- 'over', 'under'
    consensus_over_under_line DECIMAL(3,1) DEFAULT 2.5,
    consensus_over_under_confidence DECIMAL(5,2),
    consensus_match_result VARCHAR(10), -- 'home', 'draw', 'away'
    consensus_match_result_confidence DECIMAL(5,2),
    
    -- Best Bets (Ordered recommendations)
    best_bet_1_market VARCHAR(50),
    best_bet_1_selection VARCHAR(50),
    best_bet_1_confidence DECIMAL(5,2),
    best_bet_2_market VARCHAR(50),
    best_bet_2_selection VARCHAR(50),
    best_bet_2_confidence DECIMAL(5,2),
    best_bet_3_market VARCHAR(50),
    best_bet_3_selection VARCHAR(50),
    best_bet_3_confidence DECIMAL(5,2),
    
    -- Risk Assessment
    risk_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
    
    -- Actual Results (filled after match)
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    actual_btts VARCHAR(10), -- 'yes', 'no'
    actual_over_under VARCHAR(20), -- 'over', 'under'
    actual_match_result VARCHAR(10), -- 'home', 'draw', 'away'
    
    -- Settlement
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    result_source VARCHAR(100), -- Which API provided the result
    
    -- Accuracy Results
    btts_correct BOOLEAN,
    over_under_correct BOOLEAN,
    match_result_correct BOOLEAN,
    best_bet_1_correct BOOLEAN,
    best_bet_2_correct BOOLEAN,
    best_bet_3_correct BOOLEAN,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate predictions for same match + source
    CONSTRAINT unique_match_prediction UNIQUE(fixture_id, prediction_source)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AI MODEL PREDICTIONS - Her AI modelinin bireysel tahminleri
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE ai_model_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES prediction_sessions(id) ON DELETE CASCADE,
    
    -- Model Info
    model_name VARCHAR(50) NOT NULL, -- 'claude', 'gpt4', 'gemini', 'perplexity', 'stats_agent', 'deep_analysis_agent', etc.
    model_type VARCHAR(50) NOT NULL, -- 'llm', 'agent', 'ensemble'
    model_version VARCHAR(50), -- Optional version info
    
    -- Individual Predictions
    btts_prediction VARCHAR(10), -- 'yes', 'no'
    btts_confidence DECIMAL(5,2),
    btts_reasoning TEXT,
    
    over_under_prediction VARCHAR(20), -- 'over', 'under'
    over_under_line DECIMAL(3,1) DEFAULT 2.5,
    over_under_confidence DECIMAL(5,2),
    over_under_reasoning TEXT,
    
    match_result_prediction VARCHAR(10), -- 'home', 'draw', 'away'
    match_result_confidence DECIMAL(5,2),
    match_result_reasoning TEXT,
    
    -- Additional Predictions (optional)
    corners_prediction VARCHAR(50),
    corners_confidence DECIMAL(5,2),
    cards_prediction VARCHAR(50),
    cards_confidence DECIMAL(5,2),
    
    -- Model's Best Pick
    primary_recommendation_market VARCHAR(50),
    primary_recommendation_selection VARCHAR(50),
    primary_recommendation_confidence DECIMAL(5,2),
    
    -- Processing Info
    response_time_ms INTEGER,
    tokens_used INTEGER,
    raw_response JSONB, -- Store full response for debugging
    
    -- Accuracy (filled after settlement)
    btts_correct BOOLEAN,
    over_under_correct BOOLEAN,
    match_result_correct BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate model entries per session
    CONSTRAINT unique_model_per_session UNIQUE(session_id, model_name)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. MODEL ACCURACY STATS - Her modelin istatistikleri (auto-calculated)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE model_accuracy_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(50) NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- BTTS Stats
    btts_total INTEGER DEFAULT 0,
    btts_correct INTEGER DEFAULT 0,
    btts_accuracy DECIMAL(5,2),
    btts_avg_confidence DECIMAL(5,2),
    
    -- Over/Under Stats
    over_under_total INTEGER DEFAULT 0,
    over_under_correct INTEGER DEFAULT 0,
    over_under_accuracy DECIMAL(5,2),
    over_under_avg_confidence DECIMAL(5,2),
    
    -- Match Result Stats
    match_result_total INTEGER DEFAULT 0,
    match_result_correct INTEGER DEFAULT 0,
    match_result_accuracy DECIMAL(5,2),
    match_result_avg_confidence DECIMAL(5,2),
    
    -- Overall Stats
    total_predictions INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    overall_accuracy DECIMAL(5,2),
    overall_avg_confidence DECIMAL(5,2),
    
    -- Profit/Loss (if odds tracked)
    theoretical_profit DECIMAL(10,2),
    roi_percentage DECIMAL(5,2),
    
    -- Best Performing Market
    best_market VARCHAR(50),
    best_market_accuracy DECIMAL(5,2),
    
    -- Worst Performing Market
    worst_market VARCHAR(50),
    worst_market_accuracy DECIMAL(5,2),
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_model_period UNIQUE(model_name, period_type, period_start)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. MARKET PERFORMANCE - Pazar bazlı performans
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE market_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_type VARCHAR(50) NOT NULL, -- 'btts', 'over_under_25', 'match_result', etc.
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- General Stats
    total_predictions INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2),
    avg_confidence DECIMAL(5,2),
    
    -- Breakdown by Selection
    selection_1_name VARCHAR(50), -- e.g., 'yes' for BTTS
    selection_1_total INTEGER DEFAULT 0,
    selection_1_correct INTEGER DEFAULT 0,
    selection_1_accuracy DECIMAL(5,2),
    
    selection_2_name VARCHAR(50), -- e.g., 'no' for BTTS
    selection_2_total INTEGER DEFAULT 0,
    selection_2_correct INTEGER DEFAULT 0,
    selection_2_accuracy DECIMAL(5,2),
    
    selection_3_name VARCHAR(50), -- e.g., 'draw' for match result
    selection_3_total INTEGER DEFAULT 0,
    selection_3_correct INTEGER DEFAULT 0,
    selection_3_accuracy DECIMAL(5,2),
    
    -- Best Model for this Market
    best_model VARCHAR(50),
    best_model_accuracy DECIMAL(5,2),
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_market_period UNIQUE(market_type, period_type, period_start)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DAILY MODEL SUMMARY - Günlük özet (hızlı erişim için)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE daily_model_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE NOT NULL,
    model_name VARCHAR(50) NOT NULL,
    
    -- Counts
    predictions_made INTEGER DEFAULT 0,
    predictions_settled INTEGER DEFAULT 0,
    predictions_correct INTEGER DEFAULT 0,
    predictions_pending INTEGER DEFAULT 0,
    
    -- Accuracy
    daily_accuracy DECIMAL(5,2),
    
    -- By Market
    btts_predictions INTEGER DEFAULT 0,
    btts_correct INTEGER DEFAULT 0,
    over_under_predictions INTEGER DEFAULT 0,
    over_under_correct INTEGER DEFAULT 0,
    match_result_predictions INTEGER DEFAULT 0,
    match_result_correct INTEGER DEFAULT 0,
    
    -- Confidence Tracking
    avg_confidence DECIMAL(5,2),
    high_confidence_correct INTEGER DEFAULT 0, -- confidence > 70%
    high_confidence_total INTEGER DEFAULT 0,
    low_confidence_correct INTEGER DEFAULT 0, -- confidence < 60%
    low_confidence_total INTEGER DEFAULT 0,
    
    -- Streak Tracking
    current_streak INTEGER DEFAULT 0, -- positive = win streak, negative = loss streak
    best_streak INTEGER DEFAULT 0,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_daily_model UNIQUE(summary_date, model_name)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES for Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- prediction_sessions indexes
CREATE INDEX idx_sessions_fixture ON prediction_sessions(fixture_id);
CREATE INDEX idx_sessions_date ON prediction_sessions(match_date);
CREATE INDEX idx_sessions_source ON prediction_sessions(prediction_source);
CREATE INDEX idx_sessions_settled ON prediction_sessions(is_settled);
CREATE INDEX idx_sessions_created ON prediction_sessions(created_at DESC);

-- ai_model_predictions indexes
CREATE INDEX idx_model_preds_session ON ai_model_predictions(session_id);
CREATE INDEX idx_model_preds_model ON ai_model_predictions(model_name);
CREATE INDEX idx_model_preds_created ON ai_model_predictions(created_at DESC);

-- model_accuracy_stats indexes
CREATE INDEX idx_accuracy_model ON model_accuracy_stats(model_name);
CREATE INDEX idx_accuracy_period ON model_accuracy_stats(period_type, period_start);

-- market_performance indexes
CREATE INDEX idx_market_type ON market_performance(market_type);
CREATE INDEX idx_market_period ON market_performance(period_type, period_start);

-- daily_model_summary indexes
CREATE INDEX idx_daily_date ON daily_model_summary(summary_date DESC);
CREATE INDEX idx_daily_model ON daily_model_summary(model_name);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to check if prediction already exists
CREATE OR REPLACE FUNCTION check_duplicate_prediction(
    p_fixture_id BIGINT,
    p_source VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM prediction_sessions 
        WHERE fixture_id = p_fixture_id 
        AND prediction_source = p_source
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update model stats after settlement
CREATE OR REPLACE FUNCTION update_model_stats_after_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_model_name VARCHAR(50);
    v_today DATE;
BEGIN
    IF NEW.is_settled = TRUE AND OLD.is_settled = FALSE THEN
        v_today := CURRENT_DATE;
        
        -- Update individual model predictions accuracy
        UPDATE ai_model_predictions
        SET 
            btts_correct = (btts_prediction = NEW.actual_btts),
            over_under_correct = (over_under_prediction = NEW.actual_over_under),
            match_result_correct = (match_result_prediction = NEW.actual_match_result)
        WHERE session_id = NEW.id;
        
        -- Update daily summary for each model
        FOR v_model_name IN 
            SELECT DISTINCT model_name FROM ai_model_predictions WHERE session_id = NEW.id
        LOOP
            INSERT INTO daily_model_summary (summary_date, model_name, predictions_settled, predictions_correct)
            VALUES (v_today, v_model_name, 1, 
                CASE WHEN EXISTS (
                    SELECT 1 FROM ai_model_predictions 
                    WHERE session_id = NEW.id 
                    AND model_name = v_model_name 
                    AND (btts_correct = TRUE OR over_under_correct = TRUE OR match_result_correct = TRUE)
                ) THEN 1 ELSE 0 END
            )
            ON CONFLICT (summary_date, model_name) 
            DO UPDATE SET 
                predictions_settled = daily_model_summary.predictions_settled + 1,
                predictions_correct = daily_model_summary.predictions_correct + EXCLUDED.predictions_correct,
                updated_at = NOW();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating stats
DROP TRIGGER IF EXISTS trigger_update_model_stats ON prediction_sessions;
CREATE TRIGGER trigger_update_model_stats
    AFTER UPDATE ON prediction_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_model_stats_after_settlement();

-- Function to calculate accuracy
CREATE OR REPLACE FUNCTION calculate_accuracy(correct INTEGER, total INTEGER)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF total = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND((correct::DECIMAL / total::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Auto update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sessions_updated ON prediction_sessions;
CREATE TRIGGER trigger_sessions_updated
    BEFORE UPDATE ON prediction_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE prediction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_accuracy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_model_summary ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access - sessions" ON prediction_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - model_preds" ON ai_model_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - accuracy" ON model_accuracy_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - market" ON market_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - daily" ON daily_model_summary FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Auth read - sessions" ON prediction_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read - model_preds" ON ai_model_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read - accuracy" ON model_accuracy_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read - market" ON market_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read - daily" ON daily_model_summary FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS for Easy Querying
-- ═══════════════════════════════════════════════════════════════════════════

-- Model Leaderboard View
CREATE OR REPLACE VIEW model_leaderboard AS
SELECT 
    model_name,
    SUM(predictions_settled) as total_predictions,
    SUM(predictions_correct) as total_correct,
    ROUND(AVG(daily_accuracy), 2) as avg_accuracy,
    MAX(best_streak) as best_streak
FROM daily_model_summary
WHERE summary_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY model_name
ORDER BY avg_accuracy DESC;

-- Today's Performance View
CREATE OR REPLACE VIEW todays_performance AS
SELECT 
    model_name,
    predictions_made,
    predictions_settled,
    predictions_correct,
    predictions_pending,
    daily_accuracy,
    avg_confidence
FROM daily_model_summary
WHERE summary_date = CURRENT_DATE;

-- Consensus Accuracy View
CREATE OR REPLACE VIEW consensus_accuracy AS
SELECT 
    prediction_source,
    COUNT(*) FILTER (WHERE is_settled = TRUE) as settled_count,
    COUNT(*) FILTER (WHERE btts_correct = TRUE) as btts_correct,
    COUNT(*) FILTER (WHERE over_under_correct = TRUE) as ou_correct,
    COUNT(*) FILTER (WHERE match_result_correct = TRUE) as mr_correct,
    ROUND(AVG(CASE WHEN btts_correct THEN 100 ELSE 0 END), 2) as btts_accuracy,
    ROUND(AVG(CASE WHEN over_under_correct THEN 100 ELSE 0 END), 2) as ou_accuracy,
    ROUND(AVG(CASE WHEN match_result_correct THEN 100 ELSE 0 END), 2) as mr_accuracy
FROM prediction_sessions
WHERE is_settled = TRUE
GROUP BY prediction_source;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE prediction_sessions IS 'Ana tahmin kayıtları - her maç için benzersiz';
COMMENT ON TABLE ai_model_predictions IS 'Her AI modelinin bireysel tahminleri';
COMMENT ON TABLE model_accuracy_stats IS 'Model bazlı istatistikler (periyodik)';
COMMENT ON TABLE market_performance IS 'Pazar bazlı performans istatistikleri';
COMMENT ON TABLE daily_model_summary IS 'Günlük model özeti - hızlı dashboard için';

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Run this SQL in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

