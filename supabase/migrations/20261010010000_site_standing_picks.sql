-- "Karneye uyan maçlar" (/picks) kaydı — 2026-10-10
-- Sayfa her açılışta canlı hesaplanır ve maç başlayınca satır düşer; "o gün ne
-- dedik" sorusu için güçlü seçimler başlamaya ≤3 saat kala dondurulur ve skorla
-- sonuçlandırılır. Kural yeni değil: daily-standing.ts (match-standing ile aynı
-- hüküm). Vitrin/öneri tablolarıyla aynı kalıp; (fixture_id, market) tekil çünkü
-- bir maçın birden çok pazarı güçlü olabilir.
create table if not exists public.site_standing_picks (
  fixture_id      bigint      not null,
  market          text        not null check (market in ('1x2', 'ou25', 'btts')),
  kickoff         timestamptz not null,
  league_id       bigint,
  league_slug     text,
  league_label    text        not null,
  covered         boolean     not null default false,
  home_name       text        not null,
  away_name       text        not null,
  home_crest      text,
  away_crest      text,
  selection       text        not null check (selection in ('1', 'X', '2', 'over', 'under', 'yes', 'no')),
  model_p         numeric(5,4) not null,
  market_p        numeric(5,4),          -- marjsız piyasa, seçilen taraf (oran yoksa null)
  edge            numeric(6,4),          -- model_p − market_p
  verdict         text        not null,  -- dondurma anındaki hüküm (şimdilik yalnız 'strong')
  acc             numeric(5,4),          -- kova geçmiş isabeti
  evidence_n      integer     not null default 0,
  evidence_won    integer     not null default 0,
  scope           text,                  -- 'league' | 'all'
  evidence_kind   text,                  -- 'level' | 'edge' | 'clash'
  evidence_bucket text,
  rule_version    text        not null,
  frozen          boolean     not null default false,
  frozen_at       timestamptz,
  computed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  primary key (fixture_id, market),
  constraint site_standing_picks_frozen_before_kickoff check (not frozen or frozen_at is null or frozen_at < kickoff)
);
create index if not exists site_standing_picks_kickoff_idx on public.site_standing_picks (kickoff);
comment on table public.site_standing_picks is
  '/picks güçlü seçimleri: saatlik yeniden hesap, kickoff-3s dondurma, skor engine_predictions''tan. Kural: daily-standing.ts';
alter table public.site_standing_picks enable row level security; -- yalnız service role okur/yazar

-- Dondurulmuş satır değişmez (eşzamanlı cron çağrıları; vitrin B07 dersi).
create or replace function public.standing_frozen_guard()
returns trigger
language plpgsql
as $$
begin
  if old.frozen then
    return null;
  end if;
  if new.frozen and new.frozen_at is not null and new.frozen_at >= new.kickoff then
    new.frozen := false;
    new.frozen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_standing_frozen_guard on public.site_standing_picks;
create trigger trg_standing_frozen_guard
  before update on public.site_standing_picks
  for each row execute function public.standing_frozen_guard();
