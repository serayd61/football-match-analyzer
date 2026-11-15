-- ============================================================================
-- Kayıt kaynağı ve uygulama sürümü — profiles (2026-11-15)
-- ----------------------------------------------------------------------------
-- Neden: "Play'de indirme çok, abonelik yok" sorusu web ve uygulama için ayrı
-- cevaplanamıyordu: kaydın nereden geldiği saklanmıyor, Vercel logları 1 gün.
-- Uygulama içi satın alma yalnız 1.3.0+ sürümde var; hangi üyenin hangi sürümde
-- olduğu da bilinmiyordu.
--
-- signup_source      : 'app' (Play uygulaması) | 'web'. Eski satırlar NULL kalır
--                      (geriye dönük doldurulmaz: bilgi yok).
-- signup_app_version : kayıt anındaki uygulama sürümü, örn. '1.3.0' (web'de NULL)
-- last_app_version   : üyenin uygulamada son görüldüğü sürüm
-- last_app_seen_at   : uygulamada son görülme; saatte ≤1 yazım (site/seen.ts)
--
-- Yazan kod bu sütunlar yokken de çalışır (kayıt akışı bozulmaz, hata bir kez
-- loglanır); migration uygulanınca veri akmaya başlar.
-- ============================================================================
alter table public.profiles
  add column if not exists signup_source      text check (signup_source in ('app', 'web')),
  add column if not exists signup_app_version text,
  add column if not exists last_app_version   text,
  add column if not exists last_app_seen_at   timestamptz;

comment on column public.profiles.signup_source      is 'Kayıt kaynağı: app (Play uygulaması) | web; 2026-11-15 öncesi NULL';
comment on column public.profiles.signup_app_version is 'Kayıt anındaki uygulama sürümü (FootballAnalyticsPro/<sürüm>)';
comment on column public.profiles.last_app_version   is 'Uygulamada son görülen sürüm; 1.3.0+ uygulama içi satın almayı taşır';
comment on column public.profiles.last_app_seen_at   is 'Uygulamada son görülme; saatte ≤1 yazım (site/seen.ts)';

create index if not exists profiles_signup_source_idx on public.profiles (signup_source) where signup_source is not null;
