-- ============================================================================
-- Denetim B12 (2026-09-19): model terfisi tek transaction. ELLE ÇALIŞTIRILACAK.
-- Eski yol iki ayrı UPDATE idi: arada çökme → sıfır aktif sürüm → site sessizce
-- "fixture başına en yeni satır" kuralına düşüyordu. Fonksiyon yokken route eski
-- yola düşer (geriye uyumlu); uygulandıktan sonra otomatik kullanılır.
-- ============================================================================
create or replace function public.activate_engine_version(
  p_version text, p_actor text, p_note text default null, p_evidence jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prev text; v_now timestamptz := now();
begin
  -- Eşzamanlı iki terfi sıraya girsin: tablo kilidi (tablo küçük, işlem kısa).
  lock table public.engine_model_versions in share row exclusive mode;
  if not exists (select 1 from public.engine_model_versions where version = p_version) then
    raise exception 'unknown version %', p_version using errcode = 'P0002';
  end if;
  select version into v_prev from public.engine_model_versions where status = 'active' limit 1;
  if v_prev = p_version then
    return jsonb_build_object('version', p_version, 'previous', v_prev, 'changed', false);
  end if;
  update public.engine_model_versions set status = 'shadow', updated_at = v_now where status = 'active';
  update public.engine_model_versions
     set status = 'active', activated_at = v_now, updated_at = v_now, retired_at = null,
         evidence = coalesce(p_evidence, evidence)
   where version = p_version;
  insert into public.engine_learning_log(layer, action, subject, before, after, evidence, actor, note)
  values ('version', 'activate', p_version,
          jsonb_build_object('active', v_prev),
          jsonb_build_object('active', p_version, 'previous', case when v_prev is null then null else 'shadow' end),
          p_evidence, p_actor, p_note);
  return jsonb_build_object('version', p_version, 'previous', v_prev, 'changed', true);
end $$;

revoke all on function public.activate_engine_version(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.activate_engine_version(text, text, text, jsonb) to service_role;

-- Aynı anda tek aktif sürüm: veri katmanında garanti.
create unique index if not exists engine_model_versions_one_active
  on public.engine_model_versions ((status)) where status = 'active';
