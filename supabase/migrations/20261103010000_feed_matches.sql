-- ============================================================================
-- Günlük akış arşivi — feed_matches (2026-11-03, feed-1.0)
-- Yazım: src/app/api/cron/feed-matches (günlük) + scripts/backfill-feed-matches.ts (geri doldurma)
-- Okuma: (sıradaki adım) kapsam dışı maç sayfası — takım formu + H2H.
-- ----------------------------------------------------------------------------
-- Neden: form ve H2H yalnız motor arşivinden (engine_predictions) okunuyordu;
-- Şampiyonlar Ligi / Avrupa Ligi orada hiç yok, kapsam dışı rakiplerin yerli
-- lig maçları da yok. RapidAPI'de takım bazlı geçmiş uç noktası bulunmuyor
-- (2026-11-03 ölçümü) ama her gün çektiğimiz tarihe-göre-maçlar akışı tüm
-- liglerin skorlarını taşıyor. Bu tablo o akışı biriktirir: FotMob id'leri
-- motorla bire bir aynı, eşleme gerekmez. Purely additive; tahmin, karne,
-- kupon yollarına dokunmaz.
-- ============================================================================

create table if not exists public.feed_matches (
  fixture_id    bigint       primary key,
  league_id     bigint       not null,
  league_name   text         not null default '',
  league_ccode  text         not null default '',
  home_id       bigint       not null,
  home_name     text         not null,
  away_id       bigint       not null,
  away_name     text         not null,
  home_score    integer,
  away_score    integer,
  kickoff       timestamptz  not null,
  status        text         not null default 'scheduled',   -- scheduled | live | finished | cancelled
  updated_at    timestamptz  not null default now()
);

create index if not exists feed_matches_home_kickoff_idx   on public.feed_matches (home_id, kickoff desc);
create index if not exists feed_matches_away_kickoff_idx   on public.feed_matches (away_id, kickoff desc);
create index if not exists feed_matches_league_kickoff_idx on public.feed_matches (league_id, kickoff desc);
create index if not exists feed_matches_kickoff_idx        on public.feed_matches (kickoff);

comment on table public.feed_matches is 'Günlük fikstür akışı arşivi (tüm ligler, skorlu); takım formu + H2H kaynağı (feed-1.0, 2026-11-03)';

-- Yalnız service role yazar/okur; anon/authenticated erişimi yok.
alter table public.feed_matches enable row level security;
