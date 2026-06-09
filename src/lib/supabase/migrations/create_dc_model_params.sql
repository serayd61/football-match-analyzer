-- ============================================================================
-- DIXON-COLES MODEL PARAMS + BACKTEST RESULTS
-- Haftalık fit edilen takım-gücü parametrelerini ve backtest çıktılarını saklar.
-- ============================================================================

-- Fit edilmiş model parametreleri (lig başına, haftalık yenilenir)
CREATE TABLE IF NOT EXISTS dc_model_params (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_code TEXT NOT NULL,
  params JSONB NOT NULL,            -- DCParams: attack, defense, homeAdv, rho
  trained_matches INT NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  season TEXT
);

CREATE INDEX IF NOT EXISTS idx_dc_params_league
  ON dc_model_params (league_code, trained_at DESC);

-- Walk-forward backtest sonuçları (track-record için)
CREATE TABLE IF NOT EXISTS dc_backtest_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_code TEXT NOT NULL,
  tested_matches INT NOT NULL,
  mr_accuracy DOUBLE PRECISION NOT NULL,
  ou_accuracy DOUBLE PRECISION NOT NULL,
  btts_accuracy DOUBLE PRECISION NOT NULL,
  log_loss DOUBLE PRECISION NOT NULL,
  brier DOUBLE PRECISION NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_backtest_league
  ON dc_backtest_results (league_code, run_at DESC);

-- Server-side kullanım (service role) — RLS kapalı
ALTER TABLE dc_model_params DISABLE ROW LEVEL SECURITY;
ALTER TABLE dc_backtest_results DISABLE ROW LEVEL SECURITY;
