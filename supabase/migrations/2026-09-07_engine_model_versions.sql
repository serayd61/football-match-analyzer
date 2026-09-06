-- ============================================================================
-- Motor sürüm kayıtları — aday → gölge → aktif → emekli (Faz 3b)
-- ----------------------------------------------------------------------------
-- Neden: hiperparametreler Python'da sabit; "hangi sürüm resmi" sorusu env
-- değişkeniyle cevaplanıyor; terfi/geri alma adımının kaydı yok. Bu tablo tek
-- doğruluk kaynağıdır: motor /api/v2/engine/params'tan okur, site official.ts
-- SITE_MODEL_VERSION yoksa buradaki 'active' satırı resmi sürüm sayar, ingest
-- burada olmayan sürümü reddeder. Değişiklikler yalnız admin rotasından ve
-- engine_learning_log kaydıyla yapılır.
--
-- params şeması (jsonb; motor bilmediği anahtarı yok sayar):
--   { "kind": "goals"|"xg", "half_life_days": 180, "window_days": 540, "rho": -0.10,
--     "iters": 25, "min_matches": 120, "shrink_k": 0.0, "min_team_matches": 6,
--     "xg_weight": 0.75, "xg_min_coverage": 0.95,
--     "leagues": { "<fotmob_league_id>": { ...aynı anahtarlar, lig override... } } }
-- ============================================================================

create table if not exists public.engine_model_versions (
  version       text primary key check (version ~ '^[a-z0-9][a-z0-9._-]*$'),
  status        text not null check (status in ('candidate', 'shadow', 'active', 'retired')),
  kind          text not null default 'goals' check (kind in ('goals', 'xg')),
  params        jsonb not null default '{}'::jsonb,
  evidence      jsonb,                         -- kapı raporu / eşleştirilmiş karşılaştırma özeti
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  activated_at  timestamptz,
  retired_at    timestamptz
);

-- Aynı anda tek aktif sürüm.
create unique index if not exists uq_engine_model_versions_active
  on public.engine_model_versions ((status)) where status = 'active';

alter table public.engine_model_versions enable row level security;
drop policy if exists "emv read" on public.engine_model_versions;
create policy "emv read" on public.engine_model_versions for select using (true);
-- Yazma yalnız service_role (admin rotası).

-- Başlangıç: bugünkü canlı sabitler = dc-1.0 (aktif); xG adayı gölge.
insert into public.engine_model_versions (version, status, kind, params, notes, activated_at)
values (
  'dc-1.0', 'active', 'goals',
  '{"half_life_days":180,"window_days":540,"rho":-0.10,"iters":25,"min_matches":120,"shrink_k":0,"min_team_matches":6}'::jsonb,
  'Dixon-Coles-lite; canlı sabitlerin birebir kaydı (2026-09-07).', now()
)
on conflict (version) do nothing;

insert into public.engine_model_versions (version, status, kind, params, notes)
values (
  'dc-2.0-xg', 'shadow', 'xg',
  '{"half_life_days":180,"window_days":540,"rho":-0.10,"iters":25,"min_matches":120,"shrink_k":0,"min_team_matches":6,"xg_weight":0.75,"xg_min_coverage":0.95}'::jsonb,
  'xG-harmanlı DC; çevrimdışı kapı 5/5 lig geçti (reports/backtest-xg-gate.md). Gölge yayın: Hetzner''da xg.jsonl kurulunca satır üretir.'
)
on conflict (version) do nothing;

-- GERİ DÖNÜŞ
-- drop table if exists public.engine_model_versions;
