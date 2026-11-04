// Süreç içi TTL önbelleği (2026-11-04, Supabase Disk IO uyarısı).
// unstable_cache her çağrı yolunu ayrı ayrı önbellekler; onun İÇİNDEN çağrılan
// ortak okumalar (kalibrasyon eğrileri, lig kataloğu, kapsam sicili) her
// fonksiyon için yeniden DB'ye gidiyordu — 12 Eyl–4 Kas arası 985k
// confidence_calibration GET'i böyle oluştu. Bu sarmalayıcı aynı sonucu
// ttl boyunca paylaşır, eşzamanlı çağrıları tek isteğe indirir ve okuma
// hata verirse eldeki bayat değeri döndürür (site kırılmaz).
export function memoTTL<T>(ttlMs: number, load: () => Promise<T>): (() => Promise<T>) & { invalidate: () => void } {
  let value: { at: number; v: T } | null = null;
  let inflight: Promise<T> | null = null;
  const get = async (): Promise<T> => {
    if (value && Date.now() - value.at < ttlMs) return value.v;
    if (inflight) return inflight;
    inflight = load()
      .then((v) => { value = { at: Date.now(), v }; return v; })
      .catch((e) => { if (value) return value.v; throw e; })
      .finally(() => { inflight = null; });
    return inflight;
  };
  (get as any).invalidate = () => { value = null; };
  return get as (() => Promise<T>) & { invalidate: () => void };
}
