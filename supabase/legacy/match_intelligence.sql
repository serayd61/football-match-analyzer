-- ============================================================================
-- match_intelligence — "Match Intelligence Layer" cache tablosu
-- Hetzner batch script (Dolphin) bu tabloyu service_role ile DOĞRUDAN doldurur.
-- Site cache'ten okur (senkron Dolphin çağrısı YOK).
--
-- MİMARİ KURALI: Tahmin LLM'den GELMEZ.
--   • stats_prediction  → istatistik modeli (şimdilik basit Poisson, ileride
--                         penaltyblog tabanlı servis — getPrediction() arayüzü).
--   • news_digest       → Dolphin'in dilden-bağımsız, nötr etiketli özeti.
--   • preview_tr/en/de   → Dolphin (veya DE için frontier API) anlatısı.
--   • confidence        → opsiyonel frontier-agent metni (FAZ 4).
--
-- Eski/mevcut tablolara DOKUNMAZ. Tamamen izole. engine_predictions ile aynı
-- güvenlik deseni: herkes seçemez — okuma uygulama katmanında abonelikle korunur.
-- ============================================================================

create table if not exists public.match_intelligence (
  id              bigint generated always as identity primary key,

  -- maç kimliği (football-data.org / fixtures id'si — engine ile tutarlı)
  match_id        bigint      not null,

  -- gösterim kolaylığı için maç meta verisi (frontend ekstra join yapmasın)
  league_id       bigint,
  league_name     text,
  home_id         bigint,
  home_name       text,
  home_crest      text,        -- football-data crest URL (milli takımda = bayrak)
  away_id         bigint,
  away_name       text,
  away_crest      text,
  kickoff         timestamptz,

  -- istatistik tahmini (LLM DEĞİL — model çıktısı). Şema örneği:
  -- { "pHome":0.49,"pDraw":0.27,"pAway":0.24,"pOver25":0.55,"pBttsYes":0.58,
  --   "lambdaHome":1.6,"lambdaAway":1.1,"topScores":[{"score":"1-0","p":0.12}],
  --   "source":"poisson-1.0" }
  stats_prediction jsonb,

  -- Dolphin'in dilden bağımsız, yapılandırılmış haber/sakatlık özeti. Şema örneği:
  -- { "injuries":[{"team":"home","player":"X","status":"doubtful"}],
  --   "suspensions":[...], "form_notes":[...], "key_facts":[...],
  --   "sources":["url1"], "as_of":"2026-06-06T20:00:00Z" }
  news_digest      jsonb,

  -- çok dilli önizleme anlatıları (nötr, bahis tavsiyesi DEĞİL)
  preview_tr       text,
  preview_en       text,
  preview_de       text,   -- Hochdeutsch, İsviçre imlası (ß yerine ss)

  -- opsiyonel frontier-agent güven metni (FAZ 4)
  confidence       text,

  -- üretim izlenebilirliği
  preview_de_provider text,            -- 'dolphin' | 'claude' | 'gpt'
  model_version       text not null default 'mi-1.0',
  source              text,            -- batch script kimliği / sürümü

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (match_id, model_version)
);

create index if not exists idx_match_intel_kickoff on public.match_intelligence (kickoff desc);
create index if not exists idx_match_intel_league  on public.match_intelligence (league_id);
create index if not exists idx_match_intel_match   on public.match_intelligence (match_id);

-- updated_at otomatik güncelleme (engine_predictions ile aynı desen)
create or replace function public.touch_match_intelligence()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_match_intelligence on public.match_intelligence;
create trigger trg_touch_match_intelligence
  before update on public.match_intelligence
  for each row execute function public.touch_match_intelligence();

-- ============================================================================
-- RLS: yazma yalnızca service_role (batch script). Anon/authenticated SELECT
-- KAPALI — önizleme aboneliğe bağlı olduğundan okuma yalnızca uygulamanın
-- service_role kullanan API route'u üzerinden (abonelik kapısı orada) yapılır.
-- Böylece tablo doğrudan anon key ile sızdırılamaz.
-- ============================================================================
alter table public.match_intelligence enable row level security;

-- (Bilinçli olarak public SELECT policy'si YOK — engine_predictions herkese
--  açıktı; burada önizleme premium olduğu için anon okuma kapalı tutuluyor.)
