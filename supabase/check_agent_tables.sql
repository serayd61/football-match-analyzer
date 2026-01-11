-- ============================================================================
-- AGENT TABLES KONTROL SCRIPT
-- Mevcut tabloların yapısını kontrol eder
-- ============================================================================

-- 1. agent_performance tablosu var mı ve yapısı doğru mu?
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agent_performance'
ORDER BY ordinal_position;

-- 2. agent_predictions tablosu var mı ve yapısı doğru mu?
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agent_predictions'
ORDER BY ordinal_position;

-- 3. agent_name kolonu var mı? (agent_performance tablosunda)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'agent_performance' 
        AND column_name = 'agent_name'
    ) THEN '✅ agent_name kolonu VAR'
    ELSE '❌ agent_name kolonu YOK - Tablo yanlış yapıda!'
  END as agent_name_check;

-- 4. agent_type kolonu var mı? (eski yapı)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'agent_performance' 
        AND column_name = 'agent_type'
    ) THEN '⚠️ agent_type kolonu VAR - Bu ESKİ yapı! agent_performance_tracking.sql çalıştırın.'
    ELSE '✅ agent_type kolonu YOK - Yeni yapı doğru'
  END as agent_type_check;
