-- Bahisçi başına fiyat anlık görüntüsü (GÖLGE ölçüm: keskin fiyat kuralı, 2026-11-23).
-- snapshot-odds cron'u API-Football /odds yanıtındaki TÜM bahisçileri faz başına buraya yazar
-- (ek API çağrısı yok). Hiçbir sayfa okumaz; scripts/sharp-price-report.ts karneyi çıkarır.
-- Tablo yoksa cron yazımı sessizce atlanır; migration uygulanana kadar hiçbir şey bozulmaz.

create table if not exists public.odds_book_prices (
  id bigint generated always as identity primary key,
  fixture_id bigint not null,
  af_fixture_id bigint,
  phase text not null,
  kickoff timestamptz not null,
  minutes_to_kickoff integer,
  bookmaker_id integer not null,
  bookmaker text not null,
  home numeric, draw numeric, away numeric,
  over25 numeric, under25 numeric,
  btts_yes numeric, btts_no numeric,
  captured_at timestamptz not null default now(),
  unique (fixture_id, phase, bookmaker_id)
);

create index if not exists odds_book_prices_kickoff_idx on public.odds_book_prices (kickoff);

-- Yalnız service role (cron + betik); anon/authenticated için politika yok.
alter table public.odds_book_prices enable row level security;
