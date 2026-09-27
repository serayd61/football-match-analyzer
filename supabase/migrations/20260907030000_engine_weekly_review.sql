-- ============================================================================
-- Haftalık inceleme (Pazartesi) — kalıcı karne, kalibrasyon kovaları, rapor,
-- sürüm çiftleri ve öğrenme günlüğü (Faz 2)
-- ----------------------------------------------------------------------------
-- Neden: performans sayfası her istekte 40k satırı yeniden hesaplıyor; hafta-
-- hafta trend, pazar başına log-loss, ECE tarihçesi ve "iki sürümden hangisi
-- daha iyi" sorusunun kalıcı kaydı yok. Bu tablolar cron/engine-weekly-review
-- tarafından ISO hafta × lig × pazar × sürüm bazında UPSERT edilir (idempotent).
--
-- Toplanabilirlik: kovalar n / Σp / Σy, çiftler n / Σd / Σd² saklar; 4–12
-- haftalık yuvarlanan pencere SQL veya uygulama tarafında kesin toplanır.
-- league_id = 0 → kapsanan liglerin toplamı (model-coverage). model_version =
-- 'official' → fixture başına tek resmi satır (lib/site/official.ts kuralı).
-- ============================================================================

create table if not exists public.engine_weekly_metrics (
  id             bigint generated always as identity primary key,
  iso_year       int  not null,
  iso_week       int  not null check (iso_week between 1 and 53),
  week_start     date not null,                 -- Pazartesi (UTC)
  league_id      bigint not null default 0,     -- 0 = kapsanan ligler toplamı
  market         text not null check (market in ('1x2', 'dc', 'ou25', 'btts')),
  model_version  text not null,                 -- gerçek sürüm ya da 'official'
  n              int  not null,
  n_correct      int  not null,
  accuracy       numeric,
  brier          numeric,                       -- 1x2: 3 sınıf (0..2); diğerleri ikili (0..1)
  log_loss       numeric,
  ece            numeric,                       -- ham olasılık üzerinden, 10 kova
  avg_confidence numeric,                       -- seçilen tarafın ham olasılığı
  conf_brier_raw numeric,                       -- gösterilen güvenin ikili Brier'i (ham)
  conf_brier_cal numeric,                       -- aynı, haftadan ÖNCE fit edilmiş eğriyle kalibre
  calib_fitted_at timestamptz,                  -- kullanılan eğrinin fit anı (null = eğri yok)
  odds_n         int,                           -- kapanış oranı olan satır (yalnız 1x2)
  market_accuracy numeric,                      -- bahisçi favorisi isabeti (aynı satırlar)
  market_brier   numeric,                       -- de-vig bahisçi Brier (3 sınıf)
  model_accuracy_on_odds numeric,               -- modelin AYNI satırlardaki isabeti (adil karşılaştırma)
  roi_closing    numeric,                       -- düz 1 birim, model seçimi, kapanış oranı
  computed_at    timestamptz not null default now(),
  unique (iso_year, iso_week, league_id, market, model_version)
);
create index if not exists idx_ewm_week on public.engine_weekly_metrics (iso_year desc, iso_week desc);
create index if not exists idx_ewm_version on public.engine_weekly_metrics (model_version, market, league_id, week_start desc);

create table if not exists public.engine_calibration_bins (
  id             bigint generated always as identity primary key,
  iso_year       int  not null,
  iso_week       int  not null,
  market         text not null check (market in ('1x2', 'ou25', 'btts')),
  outcome        text not null check (outcome in ('H', 'D', 'A', 'over', 'yes')),
  model_version  text not null,
  bin            int  not null check (bin between 0 and 9),
  n              int  not null,
  sum_pred       numeric not null,
  sum_obs        numeric not null,
  unique (iso_year, iso_week, market, outcome, model_version, bin)
);

create table if not exists public.engine_version_pairs (
  id             bigint generated always as identity primary key,
  iso_year       int  not null,
  iso_week       int  not null,
  version_a      text not null,                 -- referans (örn. aktif)
  version_b      text not null,                 -- aday / gölge
  market         text not null check (market in ('1x2', 'ou25', 'btts')),
  n              int  not null,                 -- aynı fixture'da iki sürümün de skoru olan satır
  sum_d          numeric not null,              -- Σ (ll_b − ll_a)   negatif = b daha iyi
  sum_d2         numeric not null,              -- Σ (ll_b − ll_a)²  (yuvarlanan CI için)
  acc_a          int not null default 0,
  acc_b          int not null default 0,
  unique (iso_year, iso_week, version_a, version_b, market)
);

create table if not exists public.engine_weekly_reports (
  id             bigint generated always as identity primary key,
  iso_year       int  not null,
  iso_week       int  not null,
  summary        jsonb not null,
  generated_at   timestamptz not null default now(),
  unique (iso_year, iso_week)
);

-- Öğrenme günlüğü: yalnız INSERT. Her uyarı, öneri, onay ve sürüm değişimi burada.
create table if not exists public.engine_learning_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  layer       text not null check (layer in ('calibration', 'params', 'version', 'review')),
  action      text not null check (action in ('propose', 'approve', 'reject', 'activate', 'retire', 'alert', 'report')),
  subject     text not null,                    -- '1x2/covered', 'dc-2.0-xg', '2026-W36' ...
  before      jsonb,
  after       jsonb,
  evidence    jsonb,
  actor       text not null,                    -- 'cron:engine-weekly-review' | 'admin:<email>'
  note        text
);
create index if not exists idx_ell_time on public.engine_learning_log (occurred_at desc);
create index if not exists idx_ell_subject on public.engine_learning_log (layer, subject, occurred_at desc);

-- RLS: agregat tablolar herkese okunur (PII yok); günlük yalnız service role.
alter table public.engine_weekly_metrics    enable row level security;
alter table public.engine_calibration_bins  enable row level security;
alter table public.engine_version_pairs     enable row level security;
alter table public.engine_weekly_reports    enable row level security;
alter table public.engine_learning_log      enable row level security;

drop policy if exists "ewm read"  on public.engine_weekly_metrics;
create policy "ewm read"  on public.engine_weekly_metrics   for select using (true);
drop policy if exists "ecb read"  on public.engine_calibration_bins;
create policy "ecb read"  on public.engine_calibration_bins for select using (true);
drop policy if exists "evp read"  on public.engine_version_pairs;
create policy "evp read"  on public.engine_version_pairs    for select using (true);
drop policy if exists "ewr read"  on public.engine_weekly_reports;
create policy "ewr read"  on public.engine_weekly_reports   for select using (true);
-- engine_learning_log: politika yok → anon/authenticated okuyamaz; service_role RLS'i baypas eder.

-- GERİ DÖNÜŞ
-- drop table if exists public.engine_learning_log;
-- drop table if exists public.engine_weekly_reports;
-- drop table if exists public.engine_version_pairs;
-- drop table if exists public.engine_calibration_bins;
-- drop table if exists public.engine_weekly_metrics;
