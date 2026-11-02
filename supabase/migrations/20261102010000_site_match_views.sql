-- ============================================================================
-- Maç görüntüleme izi — site_match_views (2026-11-02)
-- Yazım: src/lib/site/seen.ts (touchSeen, fixtureId ile) · okuma: sabah raporu
-- (src/app/api/cron/morning-brief/route.ts).
-- ----------------------------------------------------------------------------
-- Neden: profiles.first_match_view_at yalnız İLK maçı tutar; "dün baktığın maç
-- nasıl bitti?" sorusu için hangi maçlara bakıldığı gerekir. Kişi × maç başına
-- tek satır (son görüntüleme zamanı güncellenir). Purely additive.
-- ============================================================================

create table if not exists public.site_match_views (
  id          bigserial primary key,
  user_email  text        not null,
  fixture_id  bigint      not null,
  viewed_at   timestamptz not null default now(),
  constraint site_match_views_user_fixture unique (user_email, fixture_id)
);

create index if not exists site_match_views_user_time_idx on public.site_match_views (user_email, viewed_at desc);
create index if not exists site_match_views_time_idx on public.site_match_views (viewed_at desc);

comment on table public.site_match_views is 'Üye maç sayfası görüntüleri; kişi×maç tek satır, viewed_at son görüntü (site/seen.ts)';

-- Yalnız service role (API oturumu kontrol eder); anon/authenticated erişimi yok.
alter table public.site_match_views enable row level security;
