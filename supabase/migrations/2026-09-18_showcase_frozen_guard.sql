-- ============================================================================
-- site_showcase_picks — dondurulmuş satır DB'de de değişmez (TASLAK, uygulanmadı)
-- ----------------------------------------------------------------------------
-- Denetim 2026-09-18 (B07): dondurma yalnız uygulama kodunda korunuyordu.
-- computeShowcase frozen kümesini bir kez okuyup koşulsuz upsert ediyor; Vercel
-- cron'u ile Hetzner yedek çağrısı aynı anda çalışırsa yavaş olan, diğerinin
-- az önce dondurduğu satırı (frozen_at dahil) ezebiliyordu.
-- Bu trigger frozen=true satıra gelen UPDATE'i sessizce yok sayar (hata fırlatmaz:
-- toplu upsert'teki diğer satırlar yazılmaya devam etsin). Sonuçlandırma bu
-- tabloya yazmaz (karne skorları engine_predictions'tan okur), o yüzden kilit güvenli.
-- Bilinçli düzeltme gerekirse: alter table ... disable trigger trg_showcase_frozen_guard;
-- Idempotent.
-- ============================================================================

create or replace function public.showcase_frozen_guard()
returns trigger
language plpgsql
as $$
begin
  if old.frozen then
    return null; -- satırı olduğu gibi bırak
  end if;
  -- Başlamış maça ilk dondurma yazılamaz.
  if new.frozen and new.frozen_at is not null and new.frozen_at >= new.kickoff then
    new.frozen := false;
    new.frozen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_showcase_frozen_guard on public.site_showcase_picks;
create trigger trg_showcase_frozen_guard
  before update on public.site_showcase_picks
  for each row execute function public.showcase_frozen_guard();

-- Aynı kural ilk INSERT için de veri katmanında geçerli olsun.
alter table public.site_showcase_picks
  drop constraint if exists site_showcase_picks_frozen_before_kickoff;
alter table public.site_showcase_picks
  add constraint site_showcase_picks_frozen_before_kickoff
  check (not frozen or frozen_at is null or frozen_at < kickoff) not valid;
-- not valid: geçmişte geç donmuş satırlar varsa migration düşmesin. Sayım:
--   select count(*) from site_showcase_picks where frozen and frozen_at >= kickoff;
