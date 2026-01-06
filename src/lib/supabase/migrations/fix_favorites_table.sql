-- ============================================================================
-- FIX FAVORITES TABLE - Eksik sütunları ekle
-- Supabase SQL Editor'da çalıştırın
-- ============================================================================

-- Önce mevcut tabloyu kontrol et ve eksik sütunları ekle
DO $$ 
BEGIN
  -- analysis_data sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'analysis_data'
  ) THEN
    ALTER TABLE favorites ADD COLUMN analysis_data JSONB;
    RAISE NOTICE 'analysis_data sütunu eklendi';
  ELSE
    RAISE NOTICE 'analysis_data sütunu zaten mevcut';
  END IF;

  -- genius_analysis sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'genius_analysis'
  ) THEN
    ALTER TABLE favorites ADD COLUMN genius_analysis JSONB;
    RAISE NOTICE 'genius_analysis sütunu eklendi';
  ELSE
    RAISE NOTICE 'genius_analysis sütunu zaten mevcut';
  END IF;

  -- match_result_prediction sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'match_result_prediction'
  ) THEN
    ALTER TABLE favorites ADD COLUMN match_result_prediction VARCHAR(10);
    RAISE NOTICE 'match_result_prediction sütunu eklendi';
  ELSE
    RAISE NOTICE 'match_result_prediction sütunu zaten mevcut';
  END IF;

  -- over_under_prediction sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'over_under_prediction'
  ) THEN
    ALTER TABLE favorites ADD COLUMN over_under_prediction VARCHAR(10);
    RAISE NOTICE 'over_under_prediction sütunu eklendi';
  ELSE
    RAISE NOTICE 'over_under_prediction sütunu zaten mevcut';
  END IF;

  -- btts_prediction sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'btts_prediction'
  ) THEN
    ALTER TABLE favorites ADD COLUMN btts_prediction VARCHAR(10);
    RAISE NOTICE 'btts_prediction sütunu eklendi';
  ELSE
    RAISE NOTICE 'btts_prediction sütunu zaten mevcut';
  END IF;

  -- best_bet_market sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'best_bet_market'
  ) THEN
    ALTER TABLE favorites ADD COLUMN best_bet_market VARCHAR(100);
    RAISE NOTICE 'best_bet_market sütunu eklendi';
  ELSE
    RAISE NOTICE 'best_bet_market sütunu zaten mevcut';
  END IF;

  -- best_bet_selection sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'best_bet_selection'
  ) THEN
    ALTER TABLE favorites ADD COLUMN best_bet_selection VARCHAR(100);
    RAISE NOTICE 'best_bet_selection sütunu eklendi';
  ELSE
    RAISE NOTICE 'best_bet_selection sütunu zaten mevcut';
  END IF;

  -- best_bet_confidence sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'best_bet_confidence'
  ) THEN
    ALTER TABLE favorites ADD COLUMN best_bet_confidence INTEGER;
    RAISE NOTICE 'best_bet_confidence sütunu eklendi';
  ELSE
    RAISE NOTICE 'best_bet_confidence sütunu zaten mevcut';
  END IF;

  -- overall_confidence sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'overall_confidence'
  ) THEN
    ALTER TABLE favorites ADD COLUMN overall_confidence INTEGER;
    RAISE NOTICE 'overall_confidence sütunu eklendi';
  ELSE
    RAISE NOTICE 'overall_confidence sütunu zaten mevcut';
  END IF;

  -- user_notes sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'user_notes'
  ) THEN
    ALTER TABLE favorites ADD COLUMN user_notes TEXT;
    RAISE NOTICE 'user_notes sütunu eklendi';
  ELSE
    RAISE NOTICE 'user_notes sütunu zaten mevcut';
  END IF;

  -- updated_at sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE favorites ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'updated_at sütunu eklendi';
  ELSE
    RAISE NOTICE 'updated_at sütunu zaten mevcut';
  END IF;

END $$;

-- Unique constraint kontrolü ve ekleme
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'favorites_user_email_fixture_id_key'
  ) THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_user_email_fixture_id_key 
    UNIQUE(user_email, fixture_id);
    RAISE NOTICE 'Unique constraint eklendi';
  ELSE
    RAISE NOTICE 'Unique constraint zaten mevcut';
  END IF;
END $$;

-- Index'leri kontrol et ve ekle
CREATE INDEX IF NOT EXISTS idx_favorites_user_email ON favorites(user_email);
CREATE INDEX IF NOT EXISTS idx_favorites_fixture_id ON favorites(fixture_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);

-- RLS'yi devre dışı bırak
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;

-- Sonuç mesajı
SELECT 'Favorites tablosu güncellendi!' as result;

