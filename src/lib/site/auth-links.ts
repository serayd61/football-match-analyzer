// Oturum bağlantıları — saf modül (2026-11-08, anonim ISR).
//
// Bu üç sabit `components/site/Paywall.tsx` içindeydi; o dosya `isTwa()`
// üzerinden `next/headers`'a bağlı. Anonim ISR ağacında hiçbir dosyanın
// istek başına veri okuyan bir modüle dokunmaması gerektiği için (bkz.
// tests/isr-anon-tree.test.ts) sabitler buraya taşındı. Paywall onları
// geriye dönük uyumluluk için yeniden ihraç ediyor.
//
// Giriş / kayıt bağlantıları rel="nofollow" taşır: /login noindex ve bir
// zamanlar sitenin en çok iç link alan URL'siydi (4.718 link).

/** Hesap açma: /login?mode=register */
export const REGISTER_HREF = '/login?mode=register';
/** Giriş */
export const SIGNIN_HREF = '/login';
/** Fiyatlandırma (TWA içinde gösterilmez — Play ödeme politikası) */
export const PRICING_HREF = '/pricing';
