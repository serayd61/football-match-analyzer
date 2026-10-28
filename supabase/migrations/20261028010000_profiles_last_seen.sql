-- ============================================================================
-- Üye aktivasyon izi — profiles.last_seen_at / first_match_view_at (2026-10-28)
-- Yazım: src/lib/site/seen.ts (touchSeen) · rapor: scripts/activation-report.ts
-- ----------------------------------------------------------------------------
-- Neden: user_analysis_history artık kullanımı ölçmüyor (AI analizini cron
-- üretiyor, PR #152); "yeni kayıt maç sayfası açtı mı?" sorusuna veri yoktu.
-- last_seen_at: üye bir site sayfası (dashboard, maç) render ettiğinde, saatte
-- en fazla bir kez güncellenir. first_match_view_at: ilk maç sayfası görüntüsü,
-- bir kez yazılır. Purely additive; hiçbir erişim kuralını değiştirmez.
-- ============================================================================

alter table public.profiles
  add column if not exists last_seen_at        timestamptz,
  add column if not exists first_match_view_at timestamptz;

comment on column public.profiles.last_seen_at        is 'Son üye sayfası görüntüsü; saatte ≤1 yazım (site/seen.ts)';
comment on column public.profiles.first_match_view_at is 'İlk maç sayfası görüntüsü; bir kez yazılır (site/seen.ts)';
