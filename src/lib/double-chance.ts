// ============================================================================
// ÇİFTE ŞANS (1X / X2 / 12) — aynı modelden türetilen ikinci ürün
// ----------------------------------------------------------------------------
// Neden: 1X2'de argmax isabeti YAPISAL olarak tavanlı. Maçların ~%23.8'i
// beraberlik biter ama beraberlik neredeyse hiçbir zaman en yüksek olasılık
// olmaz → model beraberliği doğru tahmin etse bile seçim olarak yakalayamaz.
//
// Ölçüm (5.714 sonuçlanmış tahmin, son 120 gün, 2026-08-25):
//   1X2 argmax .............. %48.6 isabet (iddia %52.6)
//   Over/Under 2.5 ≥0.60 .... %61.1 isabet (iddia %71.6)
//   ÇİFTE ŞANS .............. %76.5 isabet (iddia %79.7)  ← sadece −3.2 sapma
//
// p_draw'ın kendisi zaten dürüst kalibre (dilimler monoton: <%15→%13.7,
// %20-25→%22.2, %30-35→%28.7, >%45→%45.6). Yani motor değişmiyor; yalnızca
// aynı olasılıkları kullanıcının kazanabileceği bir forma çeviriyoruz.
//
// UYARI: `p` burada HAM toplamdır, 1X2 güveni için kullanılan izotonik eğri
// (lib/calibration.ts) çifte şans için fit EDİLMEMİŞTİR — farklı bir dağılım.
// Üstteki ölçüm ham toplamın ~3 puan iyimser olduğunu gösteriyor; kendi
// eğrisi fit edilene kadar bunu olduğu gibi gösteriyoruz.
// ============================================================================

export type DoubleChancePick = '1X' | 'X2' | '12';

export interface DoubleChance {
  pick: DoubleChancePick;
  /** Ham olasılık toplamı (0-1). Kalibre DEĞİL — yukarıdaki uyarıya bakın. */
  p: number;
  /** Bu seçimin DIŞARIDA bıraktığı tek sonuç ('H' | 'D' | 'A'). */
  excludes: 'H' | 'D' | 'A';
}

/** Üç olasılıktan en yüksek çifte şans kombinasyonunu döndürür. */
export function deriveDoubleChance(
  pHome: number | null | undefined,
  pDraw: number | null | undefined,
  pAway: number | null | undefined,
): DoubleChance | null {
  const h = Number(pHome), d = Number(pDraw), a = Number(pAway);
  if (!Number.isFinite(h) || !Number.isFinite(d) || !Number.isFinite(a)) return null;

  // Her kombinasyon "bir sonucu dışarıda bırakmak"tır; en düşük olasılıklı
  // sonucu dışarıda bırakan kombinasyon en yüksek olasılığa sahiptir.
  const options: DoubleChance[] = [
    { pick: '1X', p: h + d, excludes: 'A' },
    { pick: 'X2', p: d + a, excludes: 'H' },
    { pick: '12', p: h + a, excludes: 'D' },
  ];
  return options.reduce((best, o) => (o.p > best.p ? o : best));
}

/** Sonuç geldikten sonra: seçim tuttu mu? */
export function isDoubleChanceCorrect(pick: DoubleChancePick, result: 'H' | 'D' | 'A'): boolean {
  if (pick === '1X') return result === 'H' || result === 'D';
  if (pick === 'X2') return result === 'D' || result === 'A';
  return result === 'H' || result === 'A';
}

/** Arayüz etiketi: '1X' → "Ev sahibi veya beraberlik" gibi. */
export function doubleChanceLabel(
  pick: DoubleChancePick,
  homeName: string,
  awayName: string,
  lang: 'tr' | 'en' | 'de' = 'tr',
): string {
  const or = lang === 'tr' ? 'veya' : lang === 'de' ? 'oder' : 'or';
  const draw = lang === 'tr' ? 'beraberlik' : lang === 'de' ? 'Unentschieden' : 'draw';
  if (pick === '1X') return `${homeName} ${or} ${draw}`;
  if (pick === 'X2') return `${awayName} ${or} ${draw}`;
  return `${homeName} ${or} ${awayName}`;
}
