-- ============================================================================
-- Üyenin ülkesi — profiles (2026-11-17)
-- ----------------------------------------------------------------------------
-- Neden: bölgesel fiyat (Afrika: $2,99/ay, $19/yıl; lib/site/regional.ts)
-- sitede IP'den okunuyor, ama e-postalar cron'dan gider ve o anda IP yoktur.
-- Deneme, geri kazanım ve hoş geldin mailleri Nijerya'daki üyeye de $9,90
-- yazıyordu. Ayrıca bölge listesini genişletme kararı (~2026-12-15) için
-- kayıtların hangi ülkeden geldiği saklanmıyordu.
--
-- signup_country : kayıt anındaki IP ülkesi (ISO 3166-1 alpha-2), değişmez
-- last_country   : üyenin sitede son görüldüğü IP ülkesi; yalnız değiştiğinde
--                  yazılır (site/seen.ts)
--
-- Kaynak Vercel'in `x-vercel-ip-country` başlığı. Eski satırlar NULL kalır;
-- last_country üyenin ilk ziyaretinde dolar. Yazan ve okuyan kod bu sütunlar
-- yokken de çalışır (hata bir kez loglanır, mailler standart fiyatla gider).
-- ============================================================================
alter table public.profiles
  add column if not exists signup_country text check (signup_country ~ '^[A-Z]{2}$'),
  add column if not exists last_country   text check (last_country ~ '^[A-Z]{2}$');

comment on column public.profiles.signup_country is 'Kayıt anındaki IP ülkesi (ISO alpha-2, x-vercel-ip-country); 2026-11-17 öncesi NULL';
comment on column public.profiles.last_country   is 'Sitede son görülen IP ülkesi; bölgesel fiyatlı e-postalar bunu okur (lib/site/member-country.ts)';
