-- ============================================================================
-- Ortak değerlendirme gölge kaydı — site_assessment_snapshots (assess-1.0)
-- Kural: src/lib/site/assessment.ts (saf) · yazım: assessment-snapshot-rule.ts
-- ----------------------------------------------------------------------------
-- Neden (2026-10-16): maç sayfası / liste / dashboard / picks artık her pazar
-- için tek bir kanıt durumu (supported / conflicting / insufficient) gösteriyor.
-- Bu durumların ileride ölçülebilmesi için her pazarın değerlendirmesi
-- başlamaya ≤3 saat kala BİR kez kaydedilir. Satır EKLEMELİDİR: güncellenmez,
-- silinmez (tetikleyici); tekrar eden cron turu unique anahtara takılır ve
-- geçer. Sonuç/skor burada tutulmaz — sonradan engine_predictions'tan eşlenir;
-- geçmiş günlere bugünkü kuralla kayıt üretilmez (assessed_at < kickoff).
-- Mevcut vitrin/öneri/picks tabloları ve karneleri değişmez. Purely additive.
-- ============================================================================

create table if not exists public.site_assessment_snapshots (
  id                    bigserial    primary key,
  fixture_id            bigint       not null,
  market                text         not null check (market in ('1x2', 'ou25', 'btts')),
  selection             text         not null check (selection in ('1', 'X', '2', 'over', 'under', 'yes', 'no')),
  status                text         not null check (status in ('supported', 'conflicting', 'insufficient')),
  reasons               text[]       not null default '{}',   -- makine gerekçe kodları, öncelik sırasıyla
  rule_version          text         not null,                -- assess-1.0
  model_version         text,                                 -- değerlendirilen motor sürümü
  assessed_at           timestamptz  not null,                -- değerlendirme anı (cron turu)
  kickoff               timestamptz  not null,
  league_id             bigint,
  league_slug           text,
  covered               boolean      not null default false,
  home_name             text         not null,
  away_name             text         not null,
  -- o anda kullanılan girdiler
  model_p               numeric(5,4) not null,                -- seçilen tarafın ham model olasılığı
  calibrated_p          numeric(5,4),                         -- eğri varsa
  calibration_available boolean      not null default false,
  calibration_segment   text,
  market_p              numeric(5,4),                         -- marjsız piyasa, seçilen taraf
  market_odds           numeric(8,3),                         -- o anda bilinen gerçek ondalık oran (1X2)
  market_phase          text,
  market_provider       text,
  market_captured_at    timestamptz,                          -- kaynak veri zamanı
  record_n              integer,                              -- o anda kullanılan kanıt sayıları
  record_won            integer,
  record_scope          text,                                 -- 'league' | 'all'
  record_kind           text,                                 -- 'level' | 'edge' | 'clash'
  record_bucket         text,
  evidence_source       text,                                 -- 'signals' | 'coverage'
  evidence_from         timestamptz,
  evidence_to           timestamptz,
  evidence_decided      integer,
  created_at            timestamptz  not null default now(),
  constraint site_assessment_snapshots_unique unique (fixture_id, market, rule_version),
  constraint site_assessment_snapshots_pre_kickoff check (assessed_at < kickoff)
);

create index if not exists site_assessment_snapshots_kickoff_idx on public.site_assessment_snapshots (kickoff);
create index if not exists site_assessment_snapshots_status_idx on public.site_assessment_snapshots (rule_version, status);

comment on table public.site_assessment_snapshots is
  'Ortak değerlendirme (assess-1.0) maç öncesi gölge kaydı: kickoff-3s penceresinde tek satır / pazar; eklemeli, değişmez; skor sonradan engine_predictions''tan. Keşifsel.';

alter table public.site_assessment_snapshots enable row level security; -- yalnız service role okur/yazar

-- Değişmezlik: yazılan satır güncellenmez, silinmez (eşzamanlı/tekrarlanan cron turları, vitrin B07 dersi).
create or replace function public.assessment_snapshot_immutable()
returns trigger
language plpgsql
as $$
begin
  return null; -- UPDATE / DELETE sessizce yok sayılır
end;
$$;

drop trigger if exists trg_assessment_snapshot_immutable on public.site_assessment_snapshots;
create trigger trg_assessment_snapshot_immutable
  before update or delete on public.site_assessment_snapshots
  for each row execute function public.assessment_snapshot_immutable();
