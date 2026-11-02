-- ============================================================================
-- Kuponum sunucuda — site_slip_legs (2026-11-02, slip-2.0)
-- Yazım: src/app/api/site/slip/route.ts (PUT, üye oturumu) · okuma: aynı route (GET ?mine=1)
-- ve sabah raporu (api/cron/morning-brief: "kuponun 2/3 tuttu").
-- ----------------------------------------------------------------------------
-- Neden: kupon yalnız localStorage'daydı; cihazlar arası kaybolur ve sunucu
-- "dün kuponun ne yaptı" diyemezdi. Kişi × bacak tek satır (leg_key =
-- fixture:market:selection[:line]); kupondan çıkarılan satır silinmez,
-- removed_at alır — rapor yalnız maç başlamadan önce çıkarılmamış bacakları sayar.
-- Purely additive; hiçbir erişim kuralını değiştirmez.
-- ============================================================================

create table if not exists public.site_slip_legs (
  id            bigserial primary key,
  user_email    text             not null,
  leg_key       text             not null,
  fixture_id    bigint           not null,
  market        text             not null,
  selection     text             not null,
  line          double precision,
  p             double precision not null,
  odds          double precision,
  home_name     text             not null,
  away_name     text             not null,
  league_label  text             not null default '',
  kickoff       timestamptz      not null,
  added_at      timestamptz      not null default now(),
  removed_at    timestamptz,
  constraint site_slip_legs_user_leg unique (user_email, leg_key)
);

create index if not exists site_slip_legs_user_active_idx on public.site_slip_legs (user_email, removed_at);
create index if not exists site_slip_legs_kickoff_idx on public.site_slip_legs (kickoff);

comment on table public.site_slip_legs is 'Üye kuponu bacakları; removed_at dolu = kupondan çıkarıldı (slip-2.0, 2026-11-02)';

-- Yalnız service role (API oturumu kontrol eder); anon/authenticated erişimi yok.
alter table public.site_slip_legs enable row level security;
