-- ============================================================================
-- social_posts: otomatik paylaşım kaydı (Twitter/X + Telegram)
-- ----------------------------------------------------------------------------
-- Neden: büyüme planı (2026-09-17) — günlük seçim görseli, maç sonucu yanıtı
-- ve haftalık karne dizisi sistem tarafından paylaşılır. Aynı gönderi iki kez
-- atılmasın, sonuç yanıtı doğru gönderiye bağlansın diye her paylaşım burada
-- tutulur. `key` tekil: daily|<gün>|<platform>|<hesap>,
-- result|<fixture>|<platform>|<hesap>, weekly|<pazartesi>|<platform>|<hesap>.
-- Purely additive, idempotent.
-- ============================================================================

create table if not exists public.social_posts (
  id           bigserial primary key,
  key          text not null unique,
  kind         text not null,               -- daily | result | weekly
  day          date not null,
  platform     text not null,               -- twitter | telegram
  account      text not null,               -- tr | en
  fixture_ids  bigint[] not null default '{}',
  post_id      text,                        -- tweet id / telegram message id
  parent_id    text,                        -- yanıtlanan gönderi
  body         text not null,
  status       text not null,               -- posted | dry | failed | skipped
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists social_posts_day_idx on public.social_posts (day, kind);
alter table public.social_posts enable row level security;

comment on table public.social_posts is 'Otomatik sosyal paylaşım kaydı: günlük seçim, sonuç yanıtı, haftalık karne';
