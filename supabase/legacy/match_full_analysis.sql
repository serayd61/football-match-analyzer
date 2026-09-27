-- ═══════════════════════════════════════════════════════════════════════════
-- MATCH FULL ANALYSIS TABLE
-- Her maç için 3 farklı sistemin tam analizini saklar:
-- 1. AI Consensus (Claude + Gemini + DeepSeek)
-- 2. Quad-Brain (Claude + Gemini + Grok + Mistral)
-- 3. AI Agents (5 uzman ajan)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS match_full_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id INTEGER UNIQUE NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    league VARCHAR(255),
    match_date DATE NOT NULL,
    
    -- AI Consensus System (Claude + Gemini + DeepSeek)
    ai_consensus JSONB,
    -- Structure:
    -- {
    --   "system": "ai_consensus",
    --   "models": ["claude", "gemini", "deepseek"],
    --   "consensus": {
    --     "btts": { "prediction": "yes/no", "confidence": 70, "reasoning": "..." },
    --     "overUnder": { "prediction": "over/under", "confidence": 65, "reasoning": "..." },
    --     "matchResult": { "prediction": "home/draw/away", "confidence": 60, "reasoning": "..." }
    --   },
    --   "individualPredictions": { "claude": {...}, "gemini": {...}, "deepseek": {...} },
    --   "analyzedAt": "...",
    --   "processingTime": 5000
    -- }
    
    -- Quad-Brain System (Claude + Gemini + Grok + Mistral)
    quad_brain JSONB,
    
    -- AI Agents System (5 specialized agents)
    ai_agents JSONB,
    
    -- 🎯 DeepSeek Master Analyst - Final Decision Maker
    -- Tüm sistemlerin sonuçlarını değerlendirip final kararı veren üst-akıl
    deepseek_master JSONB,
    -- Structure:
    -- {
    --   "finalVerdict": { "btts": {...}, "overUnder": {...}, "matchResult": {...} },
    --   "confidence": 75,
    --   "reasoning": "Master değerlendirmesi...",
    --   "systemAgreement": { "btts": 3, "overUnder": 2, "matchResult": 2 },
    --   "riskLevel": "low/medium/high",
    --   "bestBet": { "market": "BTTS", "selection": "yes", "confidence": 80, "reason": "..." },
    --   "warnings": ["..."],
    --   "processingTime": 3500
    -- }
    
    -- Summary fields for quick access
    best_system VARCHAR(20), -- Which system has highest confidence
    best_btts VARCHAR(10),
    best_btts_confidence INTEGER,
    best_over_under VARCHAR(10),
    best_over_under_confidence INTEGER,
    best_match_result VARCHAR(10),
    best_match_result_confidence INTEGER,
    
    -- Actual results (filled after match)
    is_settled BOOLEAN DEFAULT FALSE,
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    ai_consensus_correct INTEGER, -- 0-3 (how many predictions correct)
    quad_brain_correct INTEGER,
    ai_agents_correct INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_full_analysis_fixture ON match_full_analysis(fixture_id);
CREATE INDEX IF NOT EXISTS idx_match_full_analysis_date ON match_full_analysis(match_date);
CREATE INDEX IF NOT EXISTS idx_match_full_analysis_settled ON match_full_analysis(is_settled);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_match_full_analysis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_match_full_analysis ON match_full_analysis;
CREATE TRIGGER trigger_update_match_full_analysis
    BEFORE UPDATE ON match_full_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_match_full_analysis_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEW: Match Analysis Comparison
-- Dashboard'da 3 sistemi karşılaştırmak için
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_match_analysis_comparison AS
SELECT 
    mfa.id,
    mfa.fixture_id,
    mfa.home_team,
    mfa.away_team,
    mfa.league,
    mfa.match_date,
    
    -- AI Consensus
    mfa.ai_consensus->>'system' as ai_consensus_system,
    (mfa.ai_consensus->'consensus'->'btts'->>'prediction') as ai_btts,
    (mfa.ai_consensus->'consensus'->'btts'->>'confidence')::int as ai_btts_conf,
    (mfa.ai_consensus->'consensus'->'overUnder'->>'prediction') as ai_over_under,
    (mfa.ai_consensus->'consensus'->'overUnder'->>'confidence')::int as ai_over_under_conf,
    (mfa.ai_consensus->'consensus'->'matchResult'->>'prediction') as ai_match_result,
    (mfa.ai_consensus->'consensus'->'matchResult'->>'confidence')::int as ai_match_result_conf,
    
    -- Quad-Brain
    (mfa.quad_brain->'consensus'->'btts'->>'prediction') as qb_btts,
    (mfa.quad_brain->'consensus'->'btts'->>'confidence')::int as qb_btts_conf,
    (mfa.quad_brain->'consensus'->'overUnder'->>'prediction') as qb_over_under,
    (mfa.quad_brain->'consensus'->'overUnder'->>'confidence')::int as qb_over_under_conf,
    (mfa.quad_brain->'consensus'->'matchResult'->>'prediction') as qb_match_result,
    (mfa.quad_brain->'consensus'->'matchResult'->>'confidence')::int as qb_match_result_conf,
    
    -- AI Agents
    (mfa.ai_agents->'consensus'->'btts'->>'prediction') as agents_btts,
    (mfa.ai_agents->'consensus'->'btts'->>'confidence')::int as agents_btts_conf,
    (mfa.ai_agents->'consensus'->'overUnder'->>'prediction') as agents_over_under,
    (mfa.ai_agents->'consensus'->'overUnder'->>'confidence')::int as agents_over_under_conf,
    (mfa.ai_agents->'consensus'->'matchResult'->>'prediction') as agents_match_result,
    (mfa.ai_agents->'consensus'->'matchResult'->>'confidence')::int as agents_match_result_conf,
    
    -- DeepSeek Master Analyst (Final Decision)
    (mfa.deepseek_master->'finalVerdict'->'btts'->>'prediction') as master_btts,
    (mfa.deepseek_master->'finalVerdict'->'btts'->>'confidence')::int as master_btts_conf,
    (mfa.deepseek_master->'finalVerdict'->'overUnder'->>'prediction') as master_over_under,
    (mfa.deepseek_master->'finalVerdict'->'overUnder'->>'confidence')::int as master_over_under_conf,
    (mfa.deepseek_master->'finalVerdict'->'matchResult'->>'prediction') as master_match_result,
    (mfa.deepseek_master->'finalVerdict'->'matchResult'->>'confidence')::int as master_match_result_conf,
    (mfa.deepseek_master->>'confidence')::int as master_overall_confidence,
    (mfa.deepseek_master->>'riskLevel') as master_risk_level,
    (mfa.deepseek_master->'systemAgreement'->>'btts')::int as agreement_btts,
    (mfa.deepseek_master->'systemAgreement'->>'overUnder')::int as agreement_over_under,
    (mfa.deepseek_master->'systemAgreement'->>'matchResult')::int as agreement_match_result,
    (mfa.deepseek_master->'bestBet'->>'market') as best_bet_market,
    (mfa.deepseek_master->'bestBet'->>'selection') as best_bet_selection,
    (mfa.deepseek_master->'bestBet'->>'confidence')::int as best_bet_confidence,
    
    -- Results
    mfa.is_settled,
    mfa.actual_home_score,
    mfa.actual_away_score,
    mfa.ai_consensus_correct,
    mfa.quad_brain_correct,
    mfa.ai_agents_correct,
    
    mfa.created_at
FROM match_full_analysis mfa
ORDER BY mfa.match_date DESC, mfa.created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTION: Get best system prediction for a match
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_best_system_prediction(p_fixture_id INTEGER)
RETURNS TABLE (
    system VARCHAR,
    btts VARCHAR,
    btts_conf INTEGER,
    over_under VARCHAR,
    over_under_conf INTEGER,
    match_result VARCHAR,
    match_result_conf INTEGER,
    total_confidence INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH systems AS (
        SELECT 
            'ai_consensus'::VARCHAR as sys,
            (ai_consensus->'consensus'->'btts'->>'prediction')::VARCHAR,
            (ai_consensus->'consensus'->'btts'->>'confidence')::int,
            (ai_consensus->'consensus'->'overUnder'->>'prediction')::VARCHAR,
            (ai_consensus->'consensus'->'overUnder'->>'confidence')::int,
            (ai_consensus->'consensus'->'matchResult'->>'prediction')::VARCHAR,
            (ai_consensus->'consensus'->'matchResult'->>'confidence')::int
        FROM match_full_analysis WHERE fixture_id = p_fixture_id
        UNION ALL
        SELECT 
            'quad_brain'::VARCHAR,
            (quad_brain->'consensus'->'btts'->>'prediction')::VARCHAR,
            (quad_brain->'consensus'->'btts'->>'confidence')::int,
            (quad_brain->'consensus'->'overUnder'->>'prediction')::VARCHAR,
            (quad_brain->'consensus'->'overUnder'->>'confidence')::int,
            (quad_brain->'consensus'->'matchResult'->>'prediction')::VARCHAR,
            (quad_brain->'consensus'->'matchResult'->>'confidence')::int
        FROM match_full_analysis WHERE fixture_id = p_fixture_id
        UNION ALL
        SELECT 
            'ai_agents'::VARCHAR,
            (ai_agents->'consensus'->'btts'->>'prediction')::VARCHAR,
            (ai_agents->'consensus'->'btts'->>'confidence')::int,
            (ai_agents->'consensus'->'overUnder'->>'prediction')::VARCHAR,
            (ai_agents->'consensus'->'overUnder'->>'confidence')::int,
            (ai_agents->'consensus'->'matchResult'->>'prediction')::VARCHAR,
            (ai_agents->'consensus'->'matchResult'->>'confidence')::int
        FROM match_full_analysis WHERE fixture_id = p_fixture_id
    )
    SELECT 
        s.sys,
        s.btts,
        s.btts_conf,
        s.over_under,
        s.over_under_conf,
        s.match_result,
        s.match_result_conf,
        (COALESCE(s.btts_conf, 0) + COALESCE(s.over_under_conf, 0) + COALESCE(s.match_result_conf, 0)) as total_conf
    FROM (SELECT * FROM systems) s
    ORDER BY (COALESCE(btts_conf, 0) + COALESCE(over_under_conf, 0) + COALESCE(match_result_conf, 0)) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON match_full_analysis TO authenticated;
GRANT SELECT ON v_match_analysis_comparison TO authenticated;

