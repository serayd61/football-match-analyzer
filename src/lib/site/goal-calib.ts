// ============================================================================
// GOL PAZARI KALİBRASYON KAYNAĞI (saf) — motor mu, site eğrisi mi? (2026-11-06)
// ----------------------------------------------------------------------------
// Motor (dc-1.0) `params.calib` ile Üst 2,5 / KG Var olasılığını Platt ile kalibre
// ederek YAZMAYA başlayınca sitenin aynı satıra ikinci kez (izotonik) eğri uygulaması
// çifte büzülme olur. Kural: satır motorun kalibrasyonu açılmadan (`calib_since`)
// önce yazıldıysa site eğrisi uygulanır; sonra yazıldıysa motor değeri aynen gösterilir
// ve "kalibre" sayılır. `calib_since` yoksa (eski davranış) her satıra eğri uygulanır.
// Kanıt: canlı gölge dc-1.2-cal 2.851 maçta KG Brier 0,2420 (dc-1.0 0,2478, taban 0,2450),
// Üst 2,5 0,2372 (dc-1.0 0,2435); 37.764 maçlık yürüyen testte ham DC KG en kötü aday.
// ============================================================================

/** Satıra site eğrisi uygulanmalı mı? */
export function siteCurveApplies(updatedAt: string | null | undefined, calibSince: string | null | undefined): boolean {
  if (!calibSince) return true;
  const since = Date.parse(calibSince);
  if (!Number.isFinite(since)) return true;
  if (!updatedAt) return true;
  const up = Date.parse(updatedAt);
  return !Number.isFinite(up) || up < since;
}

/** Aktif sürüm params'ından `calib_since` (ISO) — calib yoksa null. */
export function calibSinceOf(params: Record<string, unknown> | null | undefined): string | null {
  if (!params || typeof params !== 'object') return null;
  const calib = (params as any).calib;
  const since = (params as any).calib_since;
  if (!calib || typeof calib !== 'object') return null;
  return typeof since === 'string' && Number.isFinite(Date.parse(since)) ? since : null;
}
