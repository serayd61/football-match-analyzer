-- ADMIN PANEL SCHEMA
-- Supabase SQL Editor'de çalıştırın

-- 1. Her şeyi temizle (view veya tablo farketmez)
DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS agent_performance CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS agent_performance CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS model_performance_stats CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS model_performance_stats CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS daily_prediction_summary CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS daily_prediction_summary CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS prediction_accuracy CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS prediction_accuracy CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS match_results CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS match_results CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS prediction_records CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  EXECUTE 'DROP TABLE IF EXISTS prediction_records CASCADE';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. PREDICTION RECORDS
CREATE TABLE prediction_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  league VARCHAR(255) NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  analysis_type VARCHAR(50) NOT NULL DEFAULT 'quad-brain',
  predictions JSONB NOT NULL,
  consensus JSONB NOT NULL,
  best_bets JSONB DEFAULT '[]',
  risk_level VARCHAR(20) DEFAULT 'medium',
  risk_factors JSONB DEFAULT '[]',
  data_quality_score INTEGER DEFAULT 70,
  user_id UUID,
  status VARCHAR(20) DEFAULT 'pending',
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MATCH RESULTS
CREATE TABLE match_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER UNIQUE NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  match_result VARCHAR(5) NOT NULL,
  total_goals INTEGER NOT NULL,
  btts BOOLEAN NOT NULL,
  ht_home_score INTEGER,
  ht_away_score INTEGER,
  first_half_goals INTEGER,
  corners INTEGER,
  yellow_cards INTEGER,
  red_cards INTEGER,
  source VARCHAR(50) DEFAULT 'sportmonks',
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PREDICTION ACCURACY
CREATE TABLE prediction_accuracy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_record_id UUID REFERENCES prediction_records(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL,
  market VARCHAR(50) NOT NULL,
  model_predictions JSONB NOT NULL,
  consensus_prediction VARCHAR(100) NOT NULL,
  consensus_confidence INTEGER NOT NULL,
  actual_result VARCHAR(100) NOT NULL,
  consensus_correct BOOLEAN NOT NULL,
  analysis_type VARCHAR(50) NOT NULL DEFAULT 'quad-brain',
  settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. MODEL PERFORMANCE STATS
CREATE TABLE model_performance_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name VARCHAR(50) NOT NULL,
  market VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL,
  analysis_type VARCHAR(50) NOT NULL DEFAULT 'quad-brain',
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_confidence DECIMAL(5,2) DEFAULT 0.00,
  calibration_score DECIMAL(5,4) DEFAULT 1.0000,
  roi_percentage DECIMAL(6,2) DEFAULT 0.00,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AGENT PERFORMANCE
CREATE TABLE agent_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type VARCHAR(50) NOT NULL,
  market VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_confidence DECIMAL(5,2) DEFAULT 0.00,
  avg_response_time_ms INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. DAILY SUMMARY
CREATE TABLE daily_prediction_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_predictions INTEGER DEFAULT 0,
  settled_predictions INTEGER DEFAULT 0,
  pending_predictions INTEGER DEFAULT 0,
  match_result_accuracy DECIMAL(5,2),
  over25_accuracy DECIMAL(5,2),
  btts_accuracy DECIMAL(5,2),
  overall_accuracy DECIMAL(5,2),
  quad_brain_accuracy DECIMAL(5,2),
  agents_accuracy DECIMAL(5,2),
  ai_consensus_accuracy DECIMAL(5,2),
  best_model VARCHAR(50),
  best_model_accuracy DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. INDEXES
CREATE INDEX idx_pr_fixture ON prediction_records(fixture_id);
CREATE INDEX idx_pr_date ON prediction_records(match_date);
CREATE INDEX idx_pr_status ON prediction_records(status);
CREATE INDEX idx_mr_fixture ON match_results(fixture_id);
CREATE INDEX idx_pa_fixture ON prediction_accuracy(fixture_id);
CREATE INDEX idx_mps_model ON model_performance_stats(model_name);
