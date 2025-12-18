-- ═══════════════════════════════════════════════════════════════════════════
-- PROFESSIONAL BETTING MARKETS TRACKING SYSTEM
-- Full market coverage prediction tracking for admin panel
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing tables if they exist (clean slate for this feature)
DROP TABLE IF EXISTS professional_market_predictions CASCADE;
DROP TABLE IF EXISTS professional_market_stats CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFESSIONAL MARKET PREDICTIONS - Her maç için tüm market tahminleri
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE professional_market_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Match Info
    fixture_id BIGINT NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    league VARCHAR(255),
    match_date TIMESTAMPTZ NOT NULL,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- CORE MARKETS
    -- ═══════════════════════════════════════════════════════════════════════
    
    -- Match Result (1X2)
    match_result_selection VARCHAR(10), -- '1', 'X', '2'
    match_result_confidence DECIMAL(5,2),
    match_result_correct BOOLEAN,
    
    -- Over/Under 2.5
    over_under_25_selection VARCHAR(20), -- 'Over 2.5', 'Under 2.5'
    over_under_25_confidence DECIMAL(5,2),
    over_under_25_correct BOOLEAN,
    
    -- Over/Under 1.5
    over_under_15_selection VARCHAR(20), -- 'Over 1.5', 'Under 1.5'
    over_under_15_confidence DECIMAL(5,2),
    over_under_15_correct BOOLEAN,
    
    -- Over/Under 3.5
    over_under_35_selection VARCHAR(20), -- 'Over 3.5', 'Under 3.5'
    over_under_35_confidence DECIMAL(5,2),
    over_under_35_correct BOOLEAN,
    
    -- BTTS
    btts_selection VARCHAR(10), -- 'Yes', 'No'
    btts_confidence DECIMAL(5,2),
    btts_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- FIRST HALF MARKETS
    -- ═══════════════════════════════════════════════════════════════════════
    
    fh_result_selection VARCHAR(10), -- '1', 'X', '2'
    fh_result_confidence DECIMAL(5,2),
    fh_result_correct BOOLEAN,
    
    fh_over_05_selection VARCHAR(20),
    fh_over_05_confidence DECIMAL(5,2),
    fh_over_05_correct BOOLEAN,
    
    fh_over_15_selection VARCHAR(20),
    fh_over_15_confidence DECIMAL(5,2),
    fh_over_15_correct BOOLEAN,
    
    fh_btts_selection VARCHAR(10),
    fh_btts_confidence DECIMAL(5,2),
    fh_btts_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- SPECIAL MARKETS
    -- ═══════════════════════════════════════════════════════════════════════
    
    -- HT/FT
    htft_selection VARCHAR(10), -- '1/1', 'X/1', '2/2', etc.
    htft_confidence DECIMAL(5,2),
    htft_correct BOOLEAN,
    
    -- Asian Handicap
    asian_hc_selection VARCHAR(50), -- 'Home -0.5', 'Away +1', etc.
    asian_hc_confidence DECIMAL(5,2),
    asian_hc_correct BOOLEAN,
    
    -- Team to Score First
    first_goal_selection VARCHAR(20), -- 'Home', 'Away', 'No Goal'
    first_goal_confidence DECIMAL(5,2),
    first_goal_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- TEAM GOALS MARKETS
    -- ═══════════════════════════════════════════════════════════════════════
    
    home_over_05_selection VARCHAR(20),
    home_over_05_confidence DECIMAL(5,2),
    home_over_05_correct BOOLEAN,
    
    away_over_05_selection VARCHAR(20),
    away_over_05_confidence DECIMAL(5,2),
    away_over_05_correct BOOLEAN,
    
    home_over_15_selection VARCHAR(20),
    home_over_15_confidence DECIMAL(5,2),
    home_over_15_correct BOOLEAN,
    
    away_over_15_selection VARCHAR(20),
    away_over_15_confidence DECIMAL(5,2),
    away_over_15_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- COMBO BETS
    -- ═══════════════════════════════════════════════════════════════════════
    
    home_and_over_15_selection VARCHAR(50),
    home_and_over_15_confidence DECIMAL(5,2),
    home_and_over_15_correct BOOLEAN,
    
    away_and_over_15_selection VARCHAR(50),
    away_and_over_15_confidence DECIMAL(5,2),
    away_and_over_15_correct BOOLEAN,
    
    draw_and_under_25_selection VARCHAR(50),
    draw_and_under_25_confidence DECIMAL(5,2),
    draw_and_under_25_correct BOOLEAN,
    
    btts_and_over_25_selection VARCHAR(50),
    btts_and_over_25_confidence DECIMAL(5,2),
    btts_and_over_25_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- CORNERS & CARDS
    -- ═══════════════════════════════════════════════════════════════════════
    
    corners_selection VARCHAR(50),
    corners_confidence DECIMAL(5,2),
    corners_correct BOOLEAN,
    
    cards_selection VARCHAR(50),
    cards_confidence DECIMAL(5,2),
    cards_correct BOOLEAN,
    
    -- Exact Goals
    exact_goals_selection VARCHAR(20),
    exact_goals_confidence DECIMAL(5,2),
    exact_goals_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- SAFE BETS (Top 2 highest confidence)
    -- ═══════════════════════════════════════════════════════════════════════
    
    safe_bet_1_market VARCHAR(50),
    safe_bet_1_selection VARCHAR(50),
    safe_bet_1_confidence DECIMAL(5,2),
    safe_bet_1_correct BOOLEAN,
    
    safe_bet_2_market VARCHAR(50),
    safe_bet_2_selection VARCHAR(50),
    safe_bet_2_confidence DECIMAL(5,2),
    safe_bet_2_correct BOOLEAN,
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- ACTUAL RESULTS
    -- ═══════════════════════════════════════════════════════════════════════
    
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    actual_ht_home INTEGER,
    actual_ht_away INTEGER,
    actual_corners_home INTEGER,
    actual_corners_away INTEGER,
    actual_cards_home INTEGER,
    actual_cards_away INTEGER,
    first_goal_team VARCHAR(20), -- 'home', 'away', 'none'
    first_goal_minute INTEGER,
    
    -- Settlement
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    result_source VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate predictions for same match
    CONSTRAINT unique_pro_market_prediction UNIQUE(fixture_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PROFESSIONAL MARKET STATS - Market bazlı istatistikler
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE professional_market_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_type VARCHAR(50) NOT NULL, -- 'match_result', 'over_under_25', 'btts', etc.
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- General Stats
    total_predictions INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2),
    avg_confidence DECIMAL(5,2),
    
    -- ROI (if tracked)
    theoretical_roi DECIMAL(5,2),
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_market_stats UNIQUE(market_type, period_type, period_start)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES for Performance
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_pro_market_fixture ON professional_market_predictions(fixture_id);
CREATE INDEX idx_pro_market_date ON professional_market_predictions(match_date);
CREATE INDEX idx_pro_market_settled ON professional_market_predictions(is_settled);
CREATE INDEX idx_pro_market_created ON professional_market_predictions(created_at DESC);

CREATE INDEX idx_pro_stats_market ON professional_market_stats(market_type);
CREATE INDEX idx_pro_stats_period ON professional_market_stats(period_type, period_start);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to calculate professional market stats
CREATE OR REPLACE FUNCTION calculate_pro_market_accuracy(p_market_type VARCHAR(50))
RETURNS TABLE(total INT, correct INT, accuracy DECIMAL, avg_conf DECIMAL) AS $$
DECLARE
    v_total INTEGER;
    v_correct INTEGER;
    v_accuracy DECIMAL;
    v_avg_conf DECIMAL;
BEGIN
    CASE p_market_type
        WHEN 'match_result' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE match_result_correct = TRUE), 
                   AVG(match_result_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'over_under_25' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE over_under_25_correct = TRUE),
                   AVG(over_under_25_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'btts' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE btts_correct = TRUE),
                   AVG(btts_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'over_under_15' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE over_under_15_correct = TRUE),
                   AVG(over_under_15_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'over_under_35' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE over_under_35_correct = TRUE),
                   AVG(over_under_35_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'fh_result' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE fh_result_correct = TRUE),
                   AVG(fh_result_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'htft' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE htft_correct = TRUE),
                   AVG(htft_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'asian_hc' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE asian_hc_correct = TRUE),
                   AVG(asian_hc_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'home_over_05' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE home_over_05_correct = TRUE),
                   AVG(home_over_05_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        WHEN 'away_over_05' THEN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE away_over_05_correct = TRUE),
                   AVG(away_over_05_confidence)
            INTO v_total, v_correct, v_avg_conf
            FROM professional_market_predictions WHERE is_settled = TRUE;
        ELSE
            v_total := 0;
            v_correct := 0;
            v_avg_conf := 0;
    END CASE;
    
    IF v_total > 0 THEN
        v_accuracy := ROUND((v_correct::DECIMAL / v_total::DECIMAL) * 100, 2);
    ELSE
        v_accuracy := 0;
    END IF;
    
    RETURN QUERY SELECT v_total, v_correct, v_accuracy, COALESCE(v_avg_conf, 0);
END;
$$ LANGUAGE plpgsql;

-- Auto update timestamp
CREATE OR REPLACE FUNCTION update_pro_market_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pro_market_updated ON professional_market_predictions;
CREATE TRIGGER trigger_pro_market_updated
    BEFORE UPDATE ON professional_market_predictions
    FOR EACH ROW
    EXECUTE FUNCTION update_pro_market_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE professional_market_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_market_stats ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access - pro_market" ON professional_market_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access - pro_stats" ON professional_market_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Auth read - pro_market" ON professional_market_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read - pro_stats" ON professional_market_stats FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS for Easy Querying
-- ═══════════════════════════════════════════════════════════════════════════

-- Professional Markets Overview
CREATE OR REPLACE VIEW pro_markets_overview AS
SELECT 
    COUNT(*) as total_predictions,
    COUNT(*) FILTER (WHERE is_settled = TRUE) as settled_predictions,
    COUNT(*) FILTER (WHERE is_settled = FALSE) as pending_predictions,
    
    -- Core Markets
    ROUND(AVG(CASE WHEN match_result_correct THEN 100.0 ELSE 0 END), 2) as match_result_accuracy,
    ROUND(AVG(CASE WHEN over_under_25_correct THEN 100.0 ELSE 0 END), 2) as over_under_25_accuracy,
    ROUND(AVG(CASE WHEN btts_correct THEN 100.0 ELSE 0 END), 2) as btts_accuracy,
    ROUND(AVG(CASE WHEN over_under_15_correct THEN 100.0 ELSE 0 END), 2) as over_under_15_accuracy,
    ROUND(AVG(CASE WHEN over_under_35_correct THEN 100.0 ELSE 0 END), 2) as over_under_35_accuracy,
    
    -- First Half
    ROUND(AVG(CASE WHEN fh_result_correct THEN 100.0 ELSE 0 END), 2) as fh_result_accuracy,
    ROUND(AVG(CASE WHEN fh_over_05_correct THEN 100.0 ELSE 0 END), 2) as fh_over_05_accuracy,
    ROUND(AVG(CASE WHEN fh_over_15_correct THEN 100.0 ELSE 0 END), 2) as fh_over_15_accuracy,
    ROUND(AVG(CASE WHEN fh_btts_correct THEN 100.0 ELSE 0 END), 2) as fh_btts_accuracy,
    
    -- Special
    ROUND(AVG(CASE WHEN htft_correct THEN 100.0 ELSE 0 END), 2) as htft_accuracy,
    ROUND(AVG(CASE WHEN asian_hc_correct THEN 100.0 ELSE 0 END), 2) as asian_hc_accuracy,
    ROUND(AVG(CASE WHEN first_goal_correct THEN 100.0 ELSE 0 END), 2) as first_goal_accuracy,
    
    -- Team Goals
    ROUND(AVG(CASE WHEN home_over_05_correct THEN 100.0 ELSE 0 END), 2) as home_over_05_accuracy,
    ROUND(AVG(CASE WHEN away_over_05_correct THEN 100.0 ELSE 0 END), 2) as away_over_05_accuracy,
    
    -- Combo
    ROUND(AVG(CASE WHEN home_and_over_15_correct THEN 100.0 ELSE 0 END), 2) as home_over15_combo_accuracy,
    ROUND(AVG(CASE WHEN btts_and_over_25_correct THEN 100.0 ELSE 0 END), 2) as btts_over25_combo_accuracy,
    
    -- Safe Bets
    ROUND(AVG(CASE WHEN safe_bet_1_correct THEN 100.0 ELSE 0 END), 2) as safe_bet_1_accuracy,
    ROUND(AVG(CASE WHEN safe_bet_2_correct THEN 100.0 ELSE 0 END), 2) as safe_bet_2_accuracy
    
FROM professional_market_predictions
WHERE is_settled = TRUE;

-- Recent Professional Predictions
CREATE OR REPLACE VIEW recent_pro_predictions AS
SELECT 
    fixture_id,
    home_team,
    away_team,
    league,
    match_date,
    is_settled,
    -- Core results
    match_result_selection,
    match_result_confidence,
    match_result_correct,
    over_under_25_selection,
    over_under_25_confidence,
    over_under_25_correct,
    btts_selection,
    btts_confidence,
    btts_correct,
    -- Safe bets
    safe_bet_1_market,
    safe_bet_1_selection,
    safe_bet_1_confidence,
    safe_bet_1_correct,
    safe_bet_2_market,
    safe_bet_2_selection,
    safe_bet_2_confidence,
    safe_bet_2_correct,
    -- Score
    actual_home_score,
    actual_away_score,
    created_at
FROM professional_market_predictions
ORDER BY created_at DESC
LIMIT 100;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE professional_market_predictions IS 'Profesyonel bahis market tahminleri - tüm marketler tek kayıtta';
COMMENT ON TABLE professional_market_stats IS 'Market bazlı istatistikler (periyodik)';
COMMENT ON VIEW pro_markets_overview IS 'Tüm marketlerin genel başarı oranları';
COMMENT ON VIEW recent_pro_predictions IS 'Son 100 profesyonel tahmin';

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Run this SQL in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

