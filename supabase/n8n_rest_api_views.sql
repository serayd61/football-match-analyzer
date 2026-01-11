-- ============================================================================
-- n8n REST API İÇİN VIEW'LAR VE FUNCTIONS
-- PostgreSQL bağlantı sorunu olan n8n cloud için REST API alternatifi
-- ============================================================================
--
-- ⚠️ ÖNEMLİ: Bu script'i çalıştırmadan ÖNCE şu script'i çalıştırın:
-- supabase/agent_performance_tracking.sql
-- ============================================================================

-- Önce tabloların var olduğunu kontrol et
DO $$
BEGIN
  -- agent_performance tablosu kontrolü
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_performance'
  ) THEN
    RAISE EXCEPTION '❌ agent_performance tablosu bulunamadı! Önce supabase/agent_performance_tracking.sql script''ini çalıştırın.';
  END IF;

  -- agent_predictions tablosu kontrolü
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_predictions'
  ) THEN
    RAISE EXCEPTION '❌ agent_predictions tablosu bulunamadı! Önce supabase/agent_performance_tracking.sql script''ini çalıştırın.';
  END IF;

  -- agent_name kolonu kontrolü
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_performance' 
    AND column_name = 'agent_name'
  ) THEN
    RAISE EXCEPTION '❌ agent_performance tablosunda agent_name kolonu yok! Tablo yanlış yapıda. Önce supabase/agent_performance_tracking.sql script''ini çalıştırın (tabloları drop edip yeniden oluşturacak).';
  END IF;

  RAISE NOTICE '✅ Tablolar kontrol edildi, view''lar oluşturuluyor...';
END $$;

-- 1. Agent Performance Özeti (Son 10 kayıt)
-- REST API: GET /rest/v1/agent_performance?select=*&order=last_updated.desc&limit=10
-- Zaten mevcut tablo, view gerekmez

-- 2. Haftalık İstatistikler View (7 günlük agent performansı)
CREATE OR REPLACE VIEW agent_weekly_stats AS
SELECT 
  agent_name,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE match_result_correct = TRUE) as correct_mr,
  COUNT(*) FILTER (WHERE over_under_correct = TRUE) as correct_ou,
  COUNT(*) FILTER (WHERE btts_correct = TRUE) as correct_btts,
  ROUND(AVG(CASE WHEN match_result_correct IS NOT NULL THEN CASE WHEN match_result_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as mr_accuracy,
  ROUND(AVG(CASE WHEN over_under_correct IS NOT NULL THEN CASE WHEN over_under_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as ou_accuracy,
  ROUND(AVG(CASE WHEN btts_correct IS NOT NULL THEN CASE WHEN btts_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as btts_accuracy
FROM agent_predictions
WHERE settled_at IS NOT NULL
  AND settled_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY mr_accuracy DESC NULLS LAST;

-- 3. Agent Weights View (Tüm agent ağırlıkları)
CREATE OR REPLACE VIEW agent_weights_summary AS
SELECT 
  agent_name,
  league,
  recent_match_result_accuracy,
  current_weight,
  trend_direction,
  total_matches
FROM agent_performance
WHERE total_matches >= 5
ORDER BY current_weight DESC;

-- 4. RPC Function: Get Weekly Stats (Alternatif)
CREATE OR REPLACE FUNCTION get_agent_weekly_stats()
RETURNS TABLE (
  agent_name TEXT,
  total_predictions BIGINT,
  correct_mr BIGINT,
  correct_ou BIGINT,
  correct_btts BIGINT,
  mr_accuracy NUMERIC,
  ou_accuracy NUMERIC,
  btts_accuracy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.agent_name,
    COUNT(*)::BIGINT as total_predictions,
    COUNT(*) FILTER (WHERE ap.match_result_correct = TRUE)::BIGINT as correct_mr,
    COUNT(*) FILTER (WHERE ap.over_under_correct = TRUE)::BIGINT as correct_ou,
    COUNT(*) FILTER (WHERE ap.btts_correct = TRUE)::BIGINT as correct_btts,
    ROUND(AVG(CASE WHEN ap.match_result_correct IS NOT NULL THEN CASE WHEN ap.match_result_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as mr_accuracy,
    ROUND(AVG(CASE WHEN ap.over_under_correct IS NOT NULL THEN CASE WHEN ap.over_under_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as ou_accuracy,
    ROUND(AVG(CASE WHEN ap.btts_correct IS NOT NULL THEN CASE WHEN ap.btts_correct THEN 100.0 ELSE 0.0 END END)::numeric, 2) as btts_accuracy
  FROM agent_predictions ap
  WHERE ap.settled_at IS NOT NULL
    AND ap.settled_at >= NOW() - INTERVAL '7 days'
  GROUP BY ap.agent_name
  ORDER BY mr_accuracy DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies (REST API erişimi için)
-- agent_performance tablosu için
ALTER TABLE agent_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to agent_performance for anon"
  ON agent_performance
  FOR SELECT
  TO anon
  USING (true);

-- agent_predictions tablosu için
ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to agent_predictions for anon"
  ON agent_predictions
  FOR SELECT
  TO anon
  USING (true);

-- View'lar için RLS gerekmez (read-only)

-- 6. Grant permissions
GRANT SELECT ON agent_performance TO anon;
GRANT SELECT ON agent_predictions TO anon;
GRANT SELECT ON agent_weekly_stats TO anon;
GRANT SELECT ON agent_weights_summary TO anon;
GRANT EXECUTE ON FUNCTION get_agent_weekly_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_agent_weights(TEXT) TO anon;
