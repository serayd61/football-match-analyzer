# 🗄️ Database Schema Optimization Guide

## 📋 İçindekiler
1. [Index Strategy](#index-strategy)
2. [Query Pattern Analysis](#query-pattern-analysis)
3. [Optimization Recommendations](#optimization-recommendations)
4. [Performance Monitoring](#performance-monitoring)
5. [Maintenance Best Practices](#maintenance-best-practices)

---

## Index Strategy

### Index Types

#### 1. **Single Column Index**
Tek bir kolon için index:
```sql
CREATE INDEX idx_agent_analysis_fixture_id ON agent_analysis(fixture_id);
```

**Kullanım:**
- Primary lookup (fixture_id)
- Foreign key relationships
- Unique constraints

#### 2. **Composite Index**
Birden fazla kolon için index:
```sql
CREATE INDEX idx_unified_analysis_settled_date 
ON unified_analysis(is_settled, match_date DESC);
```

**Kullanım:**
- Multiple WHERE clauses
- ORDER BY + WHERE combination
- Çok kullanılan query pattern'leri

#### 3. **Partial Index**
WHERE clause ile filtered index:
```sql
CREATE INDEX idx_agent_analysis_settled_date 
ON agent_analysis(is_settled, analyzed_at DESC)
WHERE is_settled = TRUE;
```

**Avantajlar:**
- Daha küçük index size
- Daha hızlı query performance
- Daha az storage kullanımı

**Kullanım:**
- Boolean filtering (is_settled = TRUE/FALSE)
- Range filtering (date >= X)
- Status filtering (status = 'active')

#### 4. **GIN Index (JSONB)**
JSON field'lar için:
```sql
CREATE INDEX idx_smart_analysis_analysis_gin 
ON smart_analysis USING GIN (analysis);
```

**Kullanım:**
- JSONB field query'leri
- JSON içinde arama yapılan durumlar

---

## Query Pattern Analysis

### En Çok Kullanılan Query Pattern'leri

#### 1. **fixture_id Lookup** (En Sık)
```sql
SELECT * FROM agent_analysis WHERE fixture_id = 12345;
```
**Index:** `idx_agent_analysis_fixture_id` ✅

#### 2. **Settled + Date Range** (Çok Sık)
```sql
SELECT * FROM unified_analysis 
WHERE is_settled = TRUE 
ORDER BY match_date DESC 
LIMIT 50;
```
**Index:** `idx_unified_analysis_settled_date` ✅

#### 3. **League Filtering**
```sql
SELECT * FROM smart_analysis 
WHERE league = 'Premier League' 
ORDER BY match_date DESC;
```
**Index:** `idx_smart_analysis_league_date` ✅

#### 4. **Pending Predictions**
```sql
SELECT * FROM prediction_sessions 
WHERE is_settled = FALSE 
ORDER BY created_at DESC;
```
**Index:** `idx_sessions_settled_created` ✅

#### 5. **Accuracy Analysis**
```sql
SELECT * FROM unified_analysis 
WHERE is_settled = TRUE 
  AND match_result_correct = TRUE 
  AND btts_correct = TRUE;
```
**Index:** `idx_unified_analysis_correctness` ✅

---

## Optimization Recommendations

### Priority 1: Critical Indexes (Hemen Ekle)

```sql
-- 1. Settled + Date (tüm ana tablolar için)
CREATE INDEX idx_unified_analysis_settled_date 
ON unified_analysis(is_settled, match_date DESC)
WHERE is_settled = TRUE;

CREATE INDEX idx_agent_analysis_settled_date 
ON agent_analysis(is_settled, analyzed_at DESC)
WHERE is_settled = TRUE;

CREATE INDEX idx_smart_analysis_settled_date 
ON smart_analysis(is_settled, match_date DESC)
WHERE is_settled = TRUE;

-- 2. League + Date (filtreleme için)
CREATE INDEX idx_unified_analysis_league_date 
ON unified_analysis(league, match_date DESC)
WHERE league IS NOT NULL;

CREATE INDEX idx_smart_analysis_league_date 
ON smart_analysis(league, match_date DESC);
```

### Priority 2: Performance Indexes (Yakında Ekle)

```sql
-- Accuracy analysis için
CREATE INDEX idx_unified_analysis_correctness 
ON unified_analysis(match_result_correct, over_under_correct, btts_correct)
WHERE is_settled = TRUE;

-- Model performance için
CREATE INDEX idx_model_preds_model_correctness 
ON ai_model_predictions(model_name, btts_correct, over_under_correct);
```

### Priority 3: JSONB Indexes (Gerekirse)

```sql
-- JSON query'ler için
CREATE INDEX idx_smart_analysis_analysis_gin 
ON smart_analysis USING GIN (analysis);

CREATE INDEX idx_agent_analysis_agent_results_gin 
ON agent_analysis USING GIN (agent_results);
```

---

## Performance Monitoring

### 1. Query Performance

**pg_stat_statements Extension:**
```sql
-- Enable extension (one-time)
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
SELECT pg_reload_conf();

-- Yavaş query'leri görüntüle
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- 100ms'den yavaş
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 2. Index Usage

**Index kullanım istatistikleri:**
```sql
-- En çok kullanılan index'ler
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;

-- Kullanılmayan index'ler
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_unique%';
```

### 3. Table Statistics

**Table size ve row counts:**
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Maintenance Best Practices

### 1. Regular VACUUM

**Otomatik VACUUM:**
- Supabase otomatik yapıyor
- Büyük DELETE/UPDATE işlemlerinden sonra manuel yapılabilir

**Manuel VACUUM:**
```sql
VACUUM ANALYZE unified_analysis;
VACUUM ANALYZE agent_analysis;
VACUUM ANALYZE smart_analysis;
```

### 2. Statistics Update

**ANALYZE komutları:**
```sql
-- Query planner için statistics güncelle
ANALYZE unified_analysis;
ANALYZE agent_analysis;
ANALYZE prediction_sessions;
```

### 3. Index Maintenance

**REINDEX (nadiren gerekir):**
```sql
-- Index'leri yeniden oluştur (bloat durumunda)
REINDEX INDEX idx_unified_analysis_settled_date;
```

### 4. Connection Pooling

**Supabase Connection Limits:**
- Free tier: 50 connections
- Pro tier: 200 connections
- Team tier: Custom

**Pooling Modes:**
- Transaction mode: Genel kullanım
- Session mode: Supabase client'lar

---

## Index Creation Script

Tüm önerilen index'leri eklemek için:

```bash
# Supabase SQL Editor'da çalıştır
psql < supabase/optimization_indexes.sql
```

Veya Supabase Dashboard > SQL Editor'dan çalıştır.

---

## Best Practices Summary

### ✅ DO

1. **Composite index'ler kullan** - Multiple WHERE clauses için
2. **Partial index'ler kullan** - Boolean/Range filtering için
3. **Index'leri monitor et** - Kullanılmayan index'leri kaldır
4. **Statistics güncelle** - Query planner için ANALYZE çalıştır
5. **Query pattern'leri analiz et** - En çok kullanılan query'lere göre index oluştur

### ❌ DON'T

1. **Her kolon için index oluşturma** - Sadece query edilen kolonlar için
2. **Gereksiz index'ler** - Kullanılmayan index'ler storage ve INSERT/UPDATE yavaşlatır
3. **Aşırı composite index** - Çok fazla kolon içeren index'ler yavaş olabilir
4. **Statistics'i unutma** - ANALYZE olmadan query planner yanlış plan seçebilir
5. **Maintenance'i ihmal et** - VACUUM ve ANALYZE düzenli yapılmalı

---

## Monitoring Checklist

- [ ] pg_stat_statements extension aktif mi?
- [ ] Yavaş query'ler tespit edildi mi?
- [ ] Index usage istatistikleri kontrol edildi mi?
- [ ] Kullanılmayan index'ler kaldırıldı mı?
- [ ] Table statistics güncel mi? (ANALYZE)
- [ ] VACUUM düzenli çalışıyor mu?

---

## Performance Targets

**Query Performance Goals:**
- Simple lookup: < 10ms
- Filtered queries: < 50ms
- Complex analytics: < 200ms
- Dashboard queries: < 500ms

**Index Efficiency:**
- Index hit ratio: > 95%
- Unused indexes: < 5% of total indexes

---

**Son Güncelleme:** 2024-01-15
**Versiyon:** 1.0.0
