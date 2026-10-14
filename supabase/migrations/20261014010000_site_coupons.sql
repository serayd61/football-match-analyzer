-- Günün kuponu (duo-1.0) — 2026-10-14
-- Önerilen seçimlerden (site_reco_picks) günde bir kupon: iki bacak, toplam oran
-- 2,0–2,6 bandı, kural src/lib/site/coupon-rule.ts. Üretim anında bacaklar, oranlar
-- ve olasılıklar donar (legs jsonb); skor engine_predictions'tan okunup
-- won/lost/void yazılır. Telegram gönderisi social_posts'a key ile kaydedilir.
-- Purely additive, idempotent.
create table if not exists public.site_coupons (
  coupon_date    date        primary key,       -- Zürih takvim günü
  legs           jsonb       not null,          -- CouponLeg[] (fixtureId, market, selection, p, odds, skor, won)
  total_odds     numeric(6,2) not null,
  p_joint        numeric(5,4) not null,
  rule_version   text        not null,
  status         text        not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.site_coupons is 'Günün kuponu (duo-1.0): 2 bacak, oran 2,0–2,6; üretimde donar, skorla sonuçlanır. Kural: coupon-rule.ts';
alter table public.site_coupons enable row level security;
-- Politika yok: yalnız service_role (sunucu) okur/yazar.
