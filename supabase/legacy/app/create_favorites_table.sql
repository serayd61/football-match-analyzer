-- ============================================================================
-- FAVORITES TABLE
-- Kullanıcıların favori maçlarını ve analizlerini saklar
-- ============================================================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  fixture_id INTEGER NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  league VARCHAR(255),
  match_date TIMESTAMPTZ,
  
  -- Analiz verileri (JSONB)
  analysis_data JSONB, -- Unified analysis sonucu
  genius_analysis JSONB, -- Genius Analyst sonucu (opsiyonel)
  
  -- Hızlı erişim alanları
  match_result_prediction VARCHAR(10),
  over_under_prediction VARCHAR(10),
  btts_prediction VARCHAR(10),
  best_bet_market VARCHAR(100),
  best_bet_selection VARCHAR(100),
  best_bet_confidence INTEGER,
  overall_confidence INTEGER,
  
  -- Notlar (kullanıcı notları)
  user_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: bir kullanıcı aynı maçı sadece bir kez favoriye ekleyebilir
  UNIQUE(user_email, fixture_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_favorites_user_email ON favorites(user_email);
CREATE INDEX IF NOT EXISTS idx_favorites_fixture_id ON favorites(fixture_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);

-- RLS devre dışı (server-side kullanım için)
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;

