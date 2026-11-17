// Bölgesel fiyat metni (2026-11-17, lib/site/regional.ts).
// İki metni birden basar; `.site[data-ppp]` bayrağına göre CSS (site.css)
// doğru olanı gösterir. Sunucu ve istemci bileşenlerinde aynı şekilde çalışır,
// ISR sayfasında da: HTML ülkeden bağımsızdır, seçim tarayıcıda boyamadan önce
// yapılır (layout boot script). Gizlenen metin display:none olduğu için ekran
// okuyucuya da okunmaz.
import type { ReactNode } from 'react';

export default function Regional({ plan = 'monthly', std, reg }: { plan?: 'monthly' | 'yearly'; std: ReactNode; reg: ReactNode }) {
  return (
    <span className={plan === 'yearly' ? 'ppp-y' : 'ppp-m'}>
      <span className="ppp-std">{std}</span>
      <span className="ppp-reg">{reg}</span>
    </span>
  );
}
