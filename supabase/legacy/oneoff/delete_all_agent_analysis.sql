-- ============================================================================
-- DELETE ALL AGENT ANALYSIS RECORDS
-- Tüm agent_analysis kayıtlarını siler (yeniden analiz için)
-- ============================================================================

-- ⚠️ DİKKAT: Bu script tüm agent_analysis kayıtlarını siler!
-- Yeni analizler yapıldığında tam veri ile kaydedilecek

-- ============================================================================
-- 1. ÖNCE KONTROL ET - Kaç kayıt var?
-- ============================================================================

SELECT 
  'agent_analysis' as table_name,
  COUNT(*) as record_count,
  MIN(analyzed_at) as oldest_record,
  MAX(analyzed_at) as newest_record
FROM public.agent_analysis;

-- ============================================================================
-- 2. SİLME İŞLEMİ
-- ============================================================================

BEGIN;

-- Tüm agent_analysis kayıtlarını sil
DELETE FROM public.agent_analysis;

-- Silinen kayıt sayısını göster
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ % agent_analysis kaydı silindi', deleted_count;
END $$;

COMMIT;

-- ============================================================================
-- 3. SİLME SONRASI KONTROL
-- ============================================================================

SELECT 
  'agent_analysis' as table_name,
  COUNT(*) as remaining_records
FROM public.agent_analysis;

-- ============================================================================
-- ALTERNATIF: Sadece belirli bir tarihten önceki kayıtları sil
-- ============================================================================

-- Örnek: 2025-01-01'den önceki kayıtları sil
-- DELETE FROM public.agent_analysis WHERE analyzed_at < '2025-01-01';

-- ============================================================================
-- ALTERNATIF: Sadece belirli fixture'ları sil
-- ============================================================================

-- Örnek: Belirli fixture ID'leri sil
-- DELETE FROM public.agent_analysis WHERE fixture_id IN (19509234, 19509235);

