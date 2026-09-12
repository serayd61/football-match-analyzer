-- ============================================================================
-- prediction_odds: KG (Both Teams To Score) piyasa oranı sütunları
-- ----------------------------------------------------------------------------
-- Neden: karne "sinyal karnesi" KG için model−piyasa farkını hesaplarken KG
-- oranını raw jsonb'den okuyordu; raw satır başına ~75 KB, 600 satırda ~45 MB
-- → /leagues prerender'ı statement timeout'a düştü ve 2026-09-12 üretim
-- build'i başarısız oldu. Oran artık yakalama anında sütuna yazılır
-- (snapshot-odds), geçmiş satırlar /api/cron/backfill-btts-odds ile doldurulur.
-- Purely additive and idempotent.
-- ============================================================================

alter table public.prediction_odds
  add column if not exists btts_yes_odds numeric(6,2),
  add column if not exists btts_no_odds  numeric(6,2);

comment on column public.prediction_odds.btts_yes_odds is 'KG Var ondalık oranı (marjlı), raw''dan ayrıştırılır';
comment on column public.prediction_odds.btts_no_odds  is 'KG Yok ondalık oranı (marjlı), raw''dan ayrıştırılır';
