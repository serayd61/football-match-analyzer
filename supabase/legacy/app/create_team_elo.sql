-- ============================================================================
-- TEAM ELO SNAPSHOT (Faz 2 — Club Elo harmanı)
-- Haftalık ELO snapshot'ı + lig-başı ELO→gol eşleme parametreleri saklar.
-- Hetzner job (publish_elo.py) yazar; canlı TS serving (elo-store.ts) okur ve
-- Dixon-Coles 1X2 olasılığını ELO ile harmanlar (blendWithElo).
--
-- elo JSONB şeması:
--   { "a": <gol/ELO-puanı>, "b": <ev-avantajı gol>, "total": <lig ort. gol>,
--     "lambda": <harman ağırlığı 0..1>,
--     "ratings": { "Manchester City FC": 2032.3, ... } }   -- takım adları = model namespace (football-data.org)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_elo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_code TEXT NOT NULL,
  elo JSONB NOT NULL,
  snapshot_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_elo_league
  ON team_elo (league_code, created_at DESC);

-- Server-side kullanım (service role) — RLS kapalı (dc_model_params ile aynı desen)
ALTER TABLE team_elo DISABLE ROW LEVEL SECURITY;
