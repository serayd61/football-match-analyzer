-- ============================================================================
-- BASİT VERSİYON: TÜM TAHMİNLERİ SİL
-- ============================================================================
-- DİKKAT: Bu script tüm tahmin verilerini kalıcı olarak siler!
-- ============================================================================

-- Tüm tahmin tablolarını temizle
DELETE FROM public.agent_analysis;
DELETE FROM public.smart_analysis;
DELETE FROM public.match_full_analysis;
DELETE FROM public.prediction_records;
DELETE FROM public.ai_model_predictions;
DELETE FROM public.prediction_accuracy;

-- Silme işlemi tamamlandı
SELECT 'Tüm tahminler silindi!' as result;


