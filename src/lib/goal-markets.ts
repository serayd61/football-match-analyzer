// ============================================================================
// GOL PAZARLARI — Üst/Alt 2.5 ve KG (BTTS) seçim türetme
// ----------------------------------------------------------------------------
// Motor her maç için p_over25 ve p_btts_yes üretir (Dixon-Coles skor
// matrisinden). Bu modül tek işi yapar: olasılıktan gösterilecek SEÇİMİ
// (hangi taraf) ve o tarafın HAM güvenini çıkarır.
//
// Ölçüm (2026-08-25, 5.714 sonuçlanmış maç, engine_predictions):
//   Üst/Alt 2.5 : genel %57.6 (naif "hep Üst" tabanı %55.1). Güvene göre
//                 monoton: ~%55 güven → %52.4, ~%84 → %70.7, ~%94 → %75.0.
//   KG (BTTS)   : genel %55.6 (naif "hep Var" tabanı %54.4). ~%84 → %65.7;
//                 tepe dilim (~%95 iddia) %62.5'e DÜŞÜYOR (n=72, şişkin).
//
// İki sonuç: (1) sıralama bilgi taşıyor, göstermeye değer; (2) ham yüzdeler
// 10-30 puan şişik. Bu yüzden buradaki `p` HAM değerdir ve arayüze asla
// doğrudan çıkmaz — okuma rotaları lib/calibration.ts'teki 'ou25' / 'btts'
// segment eğrileriyle kalibre edip öyle döndürür (bkz. fit-calibration cron).
// ============================================================================

export type OverUnderPick = 'over' | 'under';
export type BttsPick = 'yes' | 'no';

export interface MarketCall<P extends string> {
  pick: P;
  /** Seçilen tarafın HAM olasılığı (>= 0.5). Gösterim için kalibre edin. */
  p: number;
}

function favored<P extends string>(
  pYes: number | null | undefined,
  yes: P,
  no: P,
): MarketCall<P> | null {
  const v = Number(pYes);
  if (!Number.isFinite(v) || v < 0 || v > 1) return null;
  return v >= 0.5 ? { pick: yes, p: v } : { pick: no, p: 1 - v };
}

/** p_over25'ten Üst/Alt seçimi. Girdi yoksa null (fallback satırları). */
export function deriveOverUnder(pOver25: number | null | undefined): MarketCall<OverUnderPick> | null {
  return favored(pOver25, 'over', 'under');
}

/** p_btts_yes'ten KG Var/Yok seçimi. */
export function deriveBtts(pBttsYes: number | null | undefined): MarketCall<BttsPick> | null {
  return favored(pBttsYes, 'yes', 'no');
}

/** Sonuçlanmış maçta seçim tuttu mu? (karne/settlement tarafı için) */
export function isOverUnderCorrect(pick: OverUnderPick, homeGoals: number, awayGoals: number): boolean {
  const over = homeGoals + awayGoals >= 3;
  return pick === 'over' ? over : !over;
}

export function isBttsCorrect(pick: BttsPick, homeGoals: number, awayGoals: number): boolean {
  const both = homeGoals > 0 && awayGoals > 0;
  return pick === 'yes' ? both : !both;
}

const LABELS = {
  tr: { over: 'Üst 2.5', under: 'Alt 2.5', yes: 'KG Var', no: 'KG Yok' },
  en: { over: 'Over 2.5', under: 'Under 2.5', yes: 'BTTS Yes', no: 'BTTS No' },
  de: { over: 'Über 2,5', under: 'Unter 2,5', yes: 'BTTS Ja', no: 'BTTS Nein' },
} as const;

export function goalMarketLabel(
  pick: OverUnderPick | BttsPick,
  lang: 'tr' | 'en' | 'de',
): string {
  return LABELS[lang][pick];
}
