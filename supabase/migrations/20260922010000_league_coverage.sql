-- ============================================================================
-- KAPSAM SİCİLİ — lig başına durum, kademe, gerekçe, kanıt ve yeniden bakış tarihi
-- ----------------------------------------------------------------------------
-- Neden (2026-09-22): kapsam bilgisi dört yerdeydi (env FOOTBALL_LEAGUE_IDS,
-- daily-picks-rule LEAGUE_TIER, motorun anlık atlama gerekçeleri, asistan hafızası).
-- Sistem Gana/Galler ligine tahmin üretip 7 gün sonra void ediyor, "Premier League"
-- adı İngiltere sanılıyordu. Artık tek kaynak bu tablo: günün seçimi, kupon
-- taraması, fikstür kapsamı (?scope=model) ve haftalık inceleme buradan okur.
-- Haftalık inceleme her ligin istatistiğini günceller, eşiği geçen/düşen ligi
-- engine_learning_log'a ÖNERİ olarak yazar; durum değişikliği admin onayıyla
-- (kullanıcı kararı 2026-09-06: ölçüm otomatik, değişiklik onaylı).
-- ============================================================================

create table if not exists public.league_coverage (
  league_id   bigint primary key,                 -- FotMob lig id (kimlik; ad değil)
  slug        text unique,                        -- site slug (SITE_LEAGUES); kapsam dışı ligde null
  name        text not null,
  ccode       text,
  country     text,
  status      text not null check (status in ('whitelist', 'observe', 'excluded')),
  tier        int  not null default 9,            -- küçük = günün seçiminde önce
  reason      text,                               -- son karar gerekçesi
  stats       jsonb,                              -- haftalık inceleme: n, 1x2, ou_hi, btts_hi, window
  decided_at  timestamptz not null default now(),
  decided_by  text not null default 'seed',
  review_at   date,                               -- bu tarihte yeniden bak
  updated_at  timestamptz not null default now()
);
create index if not exists idx_league_coverage_status on public.league_coverage (status, tier);

-- Öğrenme günlüğüne 'coverage' katmanı (lig terfi/indirme önerileri ve kararları)
alter table public.engine_learning_log drop constraint if exists engine_learning_log_layer_check;
alter table public.engine_learning_log add constraint engine_learning_log_layer_check
  check (layer in ('calibration', 'params', 'version', 'review', 'coverage'));

-- Tohum: bugünkü beyaz liste (daily-picks-rule LEAGUE_TIER, 2026-09-12 backtest) + gözlemdekiler
insert into public.league_coverage (league_id, slug, name, ccode, country, status, tier, reason, decided_by) values
  (57, 'eredivisie',       'Eredivisie',       'NED', 'Netherlands', 'whitelist', 0, '12 Eyl backtest: KG %81 / Üst %86', 'seed'),
  (54, 'bundesliga',       'Bundesliga',       'GER', 'Germany',     'whitelist', 0, '12 Eyl backtest: KG %89 / Üst %75', 'seed'),
  (87, 'la-liga',          'LaLiga',           'ESP', 'Spain',       'whitelist', 1, '12 Eyl backtest: küçük örneklemde iyi', 'seed'),
  (55, 'serie-a',          'Serie A',          'ITA', 'Italy',       'whitelist', 1, '12 Eyl backtest: küçük örneklemde iyi', 'seed'),
  (48, 'championship',     'Championship',     'ENG', 'England',     'whitelist', 2, '12 Eyl backtest', 'seed'),
  (47, 'premier-league',   'Premier League',   'ENG', 'England',     'whitelist', 2, '12 Eyl backtest', 'seed'),
  (42, 'champions-league', 'Champions League', 'INT', 'Europe',      'whitelist', 2, '12 Eyl backtest', 'seed'),
  (53, 'ligue-1',          'Ligue 1',          'FRA', 'France',      'observe',   9, '12 Eyl backtest: KG %50 / Üst %50 → beyaz liste dışı; izle', 'seed'),
  (61, 'liga-portugal',    'Liga Portugal',    'POR', 'Portugal',    'observe',   9, '12 Eyl backtest zayıf; izle', 'seed'),
  (268,'brasileirao',      'Brasileirão',      'BRA', 'Brazil',      'observe',   9, '12 Eyl backtest zayıf; izle', 'seed'),
  (71, 'super-lig',        'Süper Lig',        'TUR', 'Türkiye',     'observe',   9, '13 Eyl: motor 39 maçla fit, 1X2 13/39; örneklem büyüyünce bak', 'seed')
on conflict (league_id) do nothing;

alter table public.league_coverage enable row level security;
drop policy if exists "league_coverage read" on public.league_coverage;
create policy "league_coverage read" on public.league_coverage for select using (true);  -- PII yok; site okur
