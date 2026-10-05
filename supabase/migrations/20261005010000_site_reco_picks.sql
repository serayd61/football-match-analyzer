-- ============================================================================
-- Önerilen seçim — site_reco_picks (kural best-1.0, src/lib/site/recommend-rule.ts)
-- ----------------------------------------------------------------------------
-- Neden (2026-10-05): karne 1X2 favorisiyle tutuluyordu; sistem %35 '1' dediği
-- maçta da "tutmadı" sayılıyordu. Her maç için sistemin en emin olduğu pazar
-- seçilir (veya "net seçim yok"), başlamaya 3 saat kala dondurulur; karne
-- dondurulmuş satırlarla, skorlar engine_predictions'tan okunarak ölçülür.
-- Backtest (180g, 8.196 maç, walk-forward): %65.3 tuttu, kapsam %54.7.
-- site_showcase_picks'ten ayrı: vitrin (kural E) canlıda, aynı fixture satırını
-- ezmesin. Motor çıktısı değişmez. Purely additive, idempotent.
-- ============================================================================

create table if not exists public.site_reco_picks (
  fixture_id     bigint      primary key,
  kickoff        timestamptz not null,
  league_id      bigint,
  league_name    text,
  home_name      text        not null,
  away_name      text        not null,
  covered        boolean     not null default false,
  -- market/selection null = "net seçim yok" (o da kayda geçer: kapsam oranı)
  market         text        check (market in ('1x2', 'ou25', 'btts')),
  selection      text        check (selection in ('1', '2', 'over', 'under', 'yes')),
  q              numeric(5,4),   -- seçimde kullanılan dürüst olasılık
  p_display      numeric(5,4),   -- gösterilen olasılık (kuralın kendi kaydıyla kalibre)
  p_raw          numeric(5,4),   -- modelin ham olasılığı
  base_rate      numeric(5,4),   -- gol tarafının taban oranı (1X2'de null)
  candidates     jsonb,          -- tüm adaylar: market, selection, pRaw, q, base, passes
  rule_version   text        not null,
  model_version  text,
  frozen         boolean     not null default false,
  frozen_at      timestamptz,
  computed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  constraint site_reco_picks_frozen_before_kickoff check (not frozen or frozen_at is null or frozen_at < kickoff)
);

create index if not exists site_reco_picks_kickoff_idx on public.site_reco_picks (kickoff);

comment on table public.site_reco_picks is
  'Önerilen seçim (best-1.0): saatlik yeniden hesap, kickoff-3s dondurma, skor engine_predictions''tan. Kural: recommend-rule.ts';

alter table public.site_reco_picks enable row level security;
-- Politika yok: yalnız service_role (sunucu) okur/yazar.

-- Dondurulmuş satır değişmez (vitrin B07 dersi: eşzamanlı cron çağrıları).
create or replace function public.reco_frozen_guard()
returns trigger
language plpgsql
as $$
begin
  if old.frozen then
    return null; -- satırı olduğu gibi bırak
  end if;
  if new.frozen and new.frozen_at is not null and new.frozen_at >= new.kickoff then
    new.frozen := false;
    new.frozen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reco_frozen_guard on public.site_reco_picks;
create trigger trg_reco_frozen_guard
  before update on public.site_reco_picks
  for each row execute function public.reco_frozen_guard();
