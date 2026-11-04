-- ============================================================================
-- engine_predictions takım indeksleri (2026-11-04, Supabase Disk IO uyarısı)
-- ----------------------------------------------------------------------------
-- Neden: takım formu / H2H / sıradaki maç sorguları `home_id = X OR away_id = X`
-- ile geliyor (site/predictions.ts, site/dashboard.ts). home_id/away_id için
-- indeks yoktu; planlayıcı idx_engine_pred_version_kickoff üzerinden yürüyüp
-- ~1.600 satırı tek tek eliyordu: 12 Eyl–4 Kas arası 390k çağrı × 55–145 ms,
-- Nano compute'ta CPU zamanının en büyük kalemi. İki indeks → BitmapOr, <1 ms.
-- Canlıya 2026-11-04 elle uygulandı (if not exists ile yeniden çalıştırılabilir).
-- ============================================================================

create index if not exists idx_engine_pred_home_kickoff
  on public.engine_predictions (home_id, kickoff desc);
create index if not exists idx_engine_pred_away_kickoff
  on public.engine_predictions (away_id, kickoff desc);
