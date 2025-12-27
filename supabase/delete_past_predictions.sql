-- ============================================================================
-- DELETE PAST PREDICTIONS
-- Geçmiş yapılan tüm tahminleri siler
-- ============================================================================
-- 
-- DİKKAT: Bu script tüm tahmin verilerini kalıcı olarak siler!
-- Önce test etmek için SELECT sorgularını çalıştırın.
-- ============================================================================

-- ============================================================================
-- 1. ÖNCE KONTROL ET - Kaç kayıt var?
-- ============================================================================

-- Agent Analysis kayıt sayısı
SELECT 
  'agent_analysis' as table_name,
  COUNT(*) as record_count,
  MIN(analyzed_at) as oldest_record,
  MAX(analyzed_at) as newest_record
FROM public.agent_analysis;

-- Smart Analysis kayıt sayısı
SELECT 
  'smart_analysis' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM public.smart_analysis;

-- Match Full Analysis kayıt sayısı
SELECT 
  'match_full_analysis' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM public.match_full_analysis;

-- Prediction Records kayıt sayısı
SELECT 
  'prediction_records' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM public.prediction_records;

-- AI Model Predictions kayıt sayısı
SELECT 
  'ai_model_predictions' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM public.ai_model_predictions;

-- ============================================================================
-- 2. TÜM TAHMİNLERİ SİL (DİKKATLİ KULLAN!)
-- ============================================================================

-- Agent Analysis tablosunu temizle
DELETE FROM public.agent_analysis;

-- Smart Analysis tablosunu temizle
DELETE FROM public.smart_analysis;

-- Match Full Analysis tablosunu temizle
DELETE FROM public.match_full_analysis;

-- Prediction Records tablosunu temizle
DELETE FROM public.prediction_records;

-- AI Model Predictions tablosunu temizle
DELETE FROM public.ai_model_predictions;

-- Prediction Accuracy tablosunu temizle (eğer varsa)
DELETE FROM public.prediction_accuracy;

-- ============================================================================
-- 3. ALTERNATİF: SADECE BELİRLİ TARİHTEN ÖNCEKİLERİ SİL
-- ============================================================================

-- Örnek: 30 günden eski kayıtları sil
/*
DELETE FROM public.agent_analysis 
WHERE analyzed_at < NOW() - INTERVAL '30 days';

DELETE FROM public.smart_analysis 
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM public.match_full_analysis 
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM public.prediction_records 
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM public.ai_model_predictions 
WHERE created_at < NOW() - INTERVAL '30 days';
*/

-- ============================================================================
-- 4. ALTERNATİF: SADECE SETTLE EDİLMEMİŞ TAHMİNLERİ SİL
-- ============================================================================

-- Sadece henüz sonuçlanmamış (settle edilmemiş) tahminleri sil
/*
DELETE FROM public.agent_analysis 
WHERE is_settled = FALSE;

DELETE FROM public.smart_analysis 
WHERE is_settled = FALSE;
*/

-- ============================================================================
-- 5. ALTERNATİF: BELİRLİ FİXTURE ID'LERİNİ SİL
-- ============================================================================

-- Örnek: Belirli fixture ID'lerini sil
/*
DELETE FROM public.agent_analysis 
WHERE fixture_id IN (19432011, 19428720, ...);

DELETE FROM public.smart_analysis 
WHERE fixture_id IN (19432011, 19428720, ...);
*/

-- ============================================================================
-- 6. SİLME İŞLEMİ SONRASI KONTROL
-- ============================================================================

-- Silme işleminden sonra kontrol et
SELECT 
  'agent_analysis' as table_name,
  COUNT(*) as remaining_records
FROM public.agent_analysis
UNION ALL
SELECT 
  'smart_analysis' as table_name,
  COUNT(*) as remaining_records
FROM public.smart_analysis
UNION ALL
SELECT 
  'match_full_analysis' as table_name,
  COUNT(*) as remaining_records
FROM public.match_full_analysis
UNION ALL
SELECT 
  'prediction_records' as table_name,
  COUNT(*) as remaining_records
FROM public.prediction_records
UNION ALL
SELECT 
  'ai_model_predictions' as table_name,
  COUNT(*) as remaining_records
FROM public.ai_model_predictions;

-- ============================================================================
-- 7. SEQUENCE'LERİ RESET ET (OPSİYONEL)
-- ============================================================================

-- Eğer ID'leri sıfırdan başlatmak isterseniz (genelde gerekmez)
/*
ALTER SEQUENCE agent_analysis_id_seq RESTART WITH 1;
ALTER SEQUENCE smart_analysis_id_seq RESTART WITH 1;
*/

-- ============================================================================
-- NOTLAR:
-- ============================================================================
-- 1. Bu script'i çalıştırmadan önce mutlaka yedek alın!
-- 2. Önce SELECT sorgularını çalıştırarak ne kadar veri olduğunu kontrol edin
-- 3. Production ortamında dikkatli kullanın
-- 4. İsterseniz sadece belirli tarihten önceki kayıtları silebilirsiniz
-- 5. İsterseniz sadece settle edilmemiş kayıtları silebilirsiniz
-- ============================================================================


