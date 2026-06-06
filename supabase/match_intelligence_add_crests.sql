-- ============================================================================
-- match_intelligence — takım arması/bayrağı kolonları (football-data crest URL'i)
-- Milli takımlarda crest = ülke bayrağı. Mevcut tabloya güvenli ekleme.
-- Supabase SQL Editor'de bir kez çalıştır.
-- ============================================================================

alter table public.match_intelligence add column if not exists home_crest text;
alter table public.match_intelligence add column if not exists away_crest text;
