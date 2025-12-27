-- ============================================================================
-- ODDS ANALYSIS LOG TABLE
-- Tüm odds analizlerinin detaylı kayıtlarını saklar
-- Odds stratejisi öğrenmek ve benzer tahminler yapmak için kullanılır
-- ============================================================================

-- Table oluştur
CREATE TABLE IF NOT EXISTS public.odds_analysis_log (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Oranlar (Odds)
  home_odds NUMERIC(5,2),
  draw_odds NUMERIC(5,2),
  away_odds NUMERIC(5,2),
  over_25_odds NUMERIC(5,2),
  under_25_odds NUMERIC(5,2),
  btts_yes_odds NUMERIC(5,2),
  btts_no_odds NUMERIC(5,2),
  
  -- Implied Probabilities (Oranlardan çıkan olasılıklar)
  home_implied_prob INTEGER,
  draw_implied_prob INTEGER,
  away_implied_prob INTEGER,
  over_25_implied_prob INTEGER,
  under_25_implied_prob INTEGER,
  btts_yes_implied_prob INTEGER,
  btts_no_implied_prob INTEGER,
  
  -- Form-Based Probabilities (Form verilerinden hesaplanan gerçek olasılıklar)
  home_form_prob INTEGER,
  away_form_prob INTEGER,
  draw_form_prob INTEGER,
  over_25_form_prob INTEGER,
  under_25_form_prob INTEGER,
  btts_yes_form_prob INTEGER,
  btts_no_form_prob INTEGER,
  
  -- Value Calculations (Value = Form Prob - Implied Prob)
  home_value INTEGER,
  away_value INTEGER,
  draw_value INTEGER,
  over_25_value INTEGER,
  under_25_value INTEGER,
  btts_yes_value INTEGER,
  btts_no_value INTEGER,
  
  -- Best Value
  best_value_market TEXT,
  best_value_amount INTEGER,
  value_rating TEXT CHECK (value_rating IN ('None', 'Low', 'Medium', 'High')),
  
  -- Odds Movement (Oran hareketleri)
  home_odds_movement TEXT,
  away_odds_movement TEXT,
  over_25_odds_movement TEXT,
  btts_odds_movement TEXT,
  
  -- Sharp Money Analysis
  sharp_money_direction TEXT,
  sharp_money_confidence TEXT,
  sharp_money_reasoning JSONB,
  
  -- Predictions
  recommendation TEXT,
  match_winner_value TEXT,
  btts_value TEXT,
  asian_handicap_recommendation TEXT,
  correct_score_most_likely TEXT,
  htft_prediction TEXT,
  corners_prediction TEXT,
  cards_prediction TEXT,
  
  -- Confidence Levels
  recommendation_confidence INTEGER,
  match_winner_confidence INTEGER,
  btts_confidence INTEGER,
  asian_handicap_confidence INTEGER,
  correct_score_confidence INTEGER,
  htft_confidence INTEGER,
  corners_confidence INTEGER,
  cards_confidence INTEGER,
  
  -- Reasoning (Gerekçeler)
  recommendation_reasoning TEXT,
  match_winner_reasoning TEXT,
  btts_reasoning TEXT,
  asian_handicap_reasoning TEXT,
  correct_score_reasoning TEXT,
  htft_reasoning TEXT,
  corners_reasoning TEXT,
  cards_reasoning TEXT,
  
  -- Value Bets List
  value_bets JSONB, -- Array of value bet strings
  
  -- Full Analysis Data (Tüm analiz detayları JSON olarak)
  full_analysis_data JSONB,
  
  -- Match Result (Gerçek sonuç - maç bittikten sonra güncellenir)
  actual_result TEXT, -- '1', 'X', '2'
  actual_score TEXT, -- '2-1'
  actual_over_25 BOOLEAN,
  actual_btts BOOLEAN,
  actual_corners INTEGER,
  actual_cards INTEGER,
  
  -- Prediction Accuracy (Tahmin doğruluğu)
  prediction_correct BOOLEAN,
  value_bet_success BOOLEAN,
  
  -- Metadata
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_fixture_id ON public.odds_analysis_log(fixture_id);
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_match_date ON public.odds_analysis_log(match_date);
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_league ON public.odds_analysis_log(league);
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_value_rating ON public.odds_analysis_log(value_rating);
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_best_value_amount ON public.odds_analysis_log(best_value_amount);
CREATE INDEX IF NOT EXISTS idx_odds_analysis_log_analyzed_at ON public.odds_analysis_log(analyzed_at);

-- RLS Policies
ALTER TABLE public.odds_analysis_log ENABLE ROW LEVEL SECURITY;

-- Public read access (herkes okuyabilir)
DROP POLICY IF EXISTS "Public read access" ON public.odds_analysis_log;
CREATE POLICY "Public read access" ON public.odds_analysis_log
  FOR SELECT
  USING (true);

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access" ON public.odds_analysis_log;
CREATE POLICY "Service role full access" ON public.odds_analysis_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_odds_analysis_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS update_odds_analysis_log_updated_at ON public.odds_analysis_log;
CREATE TRIGGER update_odds_analysis_log_updated_at
  BEFORE UPDATE ON public.odds_analysis_log
  FOR EACH ROW
  EXECUTE FUNCTION update_odds_analysis_log_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.odds_analysis_log IS 'Tüm odds analizlerinin detaylı kayıtları - Odds stratejisi öğrenmek için';
COMMENT ON COLUMN public.odds_analysis_log.home_implied_prob IS 'Ev oranından çıkan olasılık (1/oran * 100)';
COMMENT ON COLUMN public.odds_analysis_log.home_form_prob IS 'Form verilerinden hesaplanan gerçek olasılık';
COMMENT ON COLUMN public.odds_analysis_log.home_value IS 'Value = Form Prob - Implied Prob (pozitif = value var)';
COMMENT ON COLUMN public.odds_analysis_log.best_value_market IS 'En yüksek value olan market (home, away, over25, vb.)';
COMMENT ON COLUMN public.odds_analysis_log.best_value_amount IS 'En yüksek value miktarı (yüzde)';
COMMENT ON COLUMN public.odds_analysis_log.full_analysis_data IS 'Tüm analiz detayları JSON formatında (tam veri)';

