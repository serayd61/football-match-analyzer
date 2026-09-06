-- ============================================================================
-- engine_predictions — pazar bazında settlement + satır skorları (Faz 1)
-- ----------------------------------------------------------------------------
-- Neden: settle-engine yalnız 1X2 `correct` yazıyordu; Üst/Alt 2.5 ve KG
-- doğruluğu üç ayrı yerde (liste, performans, kalibrasyon) okuma anında
-- türetiliyordu ve hiçbir satırda olasılık kalitesi (log-loss / Brier)
-- saklanmıyordu. Haftalık inceleme (engine-weekly-review) bu sütunları
-- toplar; hesap bir kez, settlement anında yapılır.
--
-- Ekleyici: mevcut sütunlar/okuyucular etkilenmez. `log_engine_prediction`
-- tetikleyicisi yalnız tahmin sütunlarını izler; bu sütunlar tarihçeye düşmez.
-- Geri dolum: GET /api/cron/settle-engine?backfill=1 (kayıtlı skordan, API yok).
-- ============================================================================

alter table public.engine_predictions
  add column if not exists ou_pick      text,        -- 'over' | 'under'  (p_over25 >= 0.5 → over)
  add column if not exists ou_correct   boolean,
  add column if not exists btts_pick    text,        -- 'yes' | 'no'      (p_btts_yes >= 0.5 → yes)
  add column if not exists btts_correct boolean,
  add column if not exists ll_1x2       numeric,     -- −ln p(gerçek sonuç)          rastgele 1.0986
  add column if not exists brier_1x2    numeric,     -- Σ_k (p_k − 1[k=y])²  (0..2)  rastgele 0.6667
  add column if not exists ll_ou25      numeric,     -- ikili log-loss (p_over25'e göre)
  add column if not exists brier_ou25   numeric,     -- (p_over25 − 1[toplam ≥ 3])²  (0..1)
  add column if not exists ll_btts      numeric,
  add column if not exists brier_btts   numeric,
  add column if not exists settled_at   timestamptz; -- settlement'ın yazıldığı an (kickoff değil)

alter table public.engine_predictions
  drop constraint if exists engine_predictions_ou_pick_check,
  add  constraint engine_predictions_ou_pick_check   check (ou_pick   is null or ou_pick   in ('over', 'under')),
  drop constraint if exists engine_predictions_btts_pick_check,
  add  constraint engine_predictions_btts_pick_check check (btts_pick is null or btts_pick in ('yes', 'no'));

-- Haftalık inceleme sürüm × hafta penceresiyle okur.
create index if not exists idx_engine_pred_version_kickoff
  on public.engine_predictions (model_version, kickoff desc);

-- Geri dolum kuyruğu: skoru var, satır skoru yok.
create index if not exists idx_engine_pred_scores_pending
  on public.engine_predictions (kickoff)
  where settled = true and result is not null and ll_1x2 is null;

comment on column public.engine_predictions.ll_1x2     is 'Per-row 1X2 log-loss −ln p(actual). Written at settlement; null = not yet scored (see settle-engine ?backfill=1).';
comment on column public.engine_predictions.brier_1x2  is 'Per-row 3-class Brier Σ(p_k−y_k)², range 0..2.';
comment on column public.engine_predictions.brier_ou25 is 'Per-row binary Brier on p_over25 vs (home+away ≥ 3), range 0..1.';
comment on column public.engine_predictions.brier_btts is 'Per-row binary Brier on p_btts_yes vs (both scored), range 0..1.';

-- GERİ DÖNÜŞ
-- drop index if exists idx_engine_pred_scores_pending;
-- drop index if exists idx_engine_pred_version_kickoff;
-- alter table public.engine_predictions
--   drop column if exists ou_pick, drop column if exists ou_correct,
--   drop column if exists btts_pick, drop column if exists btts_correct,
--   drop column if exists ll_1x2, drop column if exists brier_1x2,
--   drop column if exists ll_ou25, drop column if exists brier_ou25,
--   drop column if exists ll_btts, drop column if exists brier_btts,
--   drop column if exists settled_at;
