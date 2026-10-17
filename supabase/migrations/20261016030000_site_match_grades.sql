-- ============================================================================
-- Biten maç derece kartı — site_match_grades (grade-1.0)
-- Kural: src/lib/site/grade-rule.ts (saf) · yazım: grades.ts · cron: api/cron/match-grades
-- ----------------------------------------------------------------------------
-- Neden (2026-10-16): her sonuçlanmış maç için pazar başına "kim haklıydı" kaydı:
-- modelin seçimi, bahisçinin favorisi (yalnız kickoff ÖNCESİ görüntü), ayrışmada
-- hangisi tuttu, maç-öncesi değerlendirme durumu (yalnız site_assessment_snapshots'tan;
-- geriye dönük üretilmez), sonuç ve ikili skorlar. Haftalık özet (dersler)
-- engine_learning_log'a (layer 'review', subject 'grade-1.0/<hafta>') yazılır.
-- Satır EKLEMELİDİR: güncellenmez, silinmez (tetikleyici); tekrar eden cron turu
-- unique anahtara takılır ve geçer. Hiçbir seçimi/karneyi/kuralı değiştirmez. Purely additive.
-- ============================================================================

create table if not exists public.site_match_grades (
  id                      bigserial    primary key,
  fixture_id              bigint       not null,
  market                  text         not null check (market in ('1x2', 'ou25', 'btts')),
  selection               text         not null check (selection in ('1', 'X', '2', 'over', 'under', 'yes', 'no')),
  rule_version            text         not null,                -- grade-1.0
  model_version           text,
  assessment_rule_version text,                                 -- gölge kayıt varsa assess-1.0
  kickoff                 timestamptz  not null,
  iso_year                int          not null,
  iso_week                int          not null check (iso_week between 1 and 53),
  league_id               bigint,
  league_slug             text,
  covered                 boolean      not null default false,
  home_name               text         not null,
  away_name               text         not null,
  home_score              int          not null,
  away_score              int          not null,
  result                  text         not null check (result in ('H', 'D', 'A')),
  hit                     boolean      not null,
  model_p                 numeric(5,4) not null,                -- seçilen tarafın ham olasılığı
  brier                   numeric(7,4) not null,                -- ikili, seçilen taraf
  log_loss                numeric(7,4) not null,
  level_bucket            text         not null,
  market_p                numeric(5,4),                         -- kickoff öncesi marjsız, seçilen taraf
  market_phase            text,
  market_captured_at      timestamptz,
  market_fav              text,                                 -- 1X2 bahisçi favorisi
  market_fav_hit          boolean,
  edge                    numeric(6,4),                         -- model − piyasa
  edge_bucket             text,
  clash                   text         check (clash in ('agree', 'model_right', 'market_right', 'both_wrong')),
  status                  text         check (status in ('supported', 'conflicting', 'insufficient')),
  status_source           text         not null default 'none' check (status_source in ('snapshot', 'none')),
  status_reasons          text[]       not null default '{}',
  codes                   text[]       not null default '{}',   -- makine gerekçe kodları
  created_at              timestamptz  not null default now(),
  constraint site_match_grades_unique unique (fixture_id, market, rule_version),
  constraint site_match_grades_market_pre_kickoff check (market_captured_at is null or market_captured_at < kickoff)
);

create index if not exists site_match_grades_week_idx on public.site_match_grades (rule_version, iso_year, iso_week);
create index if not exists site_match_grades_kickoff_idx on public.site_match_grades (kickoff);

comment on table public.site_match_grades is
  'Biten maç derece kartı (grade-1.0): pazar başına kim haklıydı (model / piyasa / maç-öncesi durum); eklemeli, değişmez; haftalık dersler engine_learning_log''da. Keşifsel.';

alter table public.site_match_grades enable row level security; -- yalnız service role okur/yazar

create or replace function public.match_grade_immutable()
returns trigger
language plpgsql
as $$
begin
  return null; -- UPDATE / DELETE sessizce yok sayılır
end;
$$;

drop trigger if exists trg_match_grade_immutable on public.site_match_grades;
create trigger trg_match_grade_immutable
  before update or delete on public.site_match_grades
  for each row execute function public.match_grade_immutable();
