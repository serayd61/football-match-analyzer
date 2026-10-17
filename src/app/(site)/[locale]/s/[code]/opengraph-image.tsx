import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/site/og';
import { loadShared } from '@/lib/site/slip-shared';
import { slipTotals } from '@/lib/site/slip-rule';

// Paylaşılan kupon kartı (slip-1.3): WhatsApp / Instagram / Telegram'da bağlantının yanında
// bacaklar ve toplam oran görünür. İlk 6 bacak; fazlası "+n".
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Shared slip — Football Analytics';

const INK = '#14262b', MUTED = '#5c6c70', ACCENT = '#ac5a0a', BG = '#f6f7f5', LINE = '#d6dcd9', BRAND = '#1f8a4c';

export default async function Image({ params }: { params: { locale: string; code: string } }) {
  const [t, tc] = await Promise.all([getTranslations({ locale: params.locale, namespace: 'slip' }), getTranslations({ locale: params.locale, namespace: 'common' })]);
  const { legs } = await loadShared(params.code);
  const totals = slipTotals(legs);
  const label = (l: (typeof legs)[number]) => {
    if (l.market === '1x2') return l.selection === '1' ? l.homeName : l.selection === '2' ? l.awayName : tc('draw');
    if (l.market === 'ou25') return l.selection === 'over' ? t('over') : t('under');
    if (l.market === 'btts') return l.selection === 'yes' ? t('bttsYes') : t('bttsNo');
    const team = l.selection === 'home' ? l.homeName : l.awayName;
    if (l.market === 'dnb') return `${team} · ${t('dnbShort')}`;
    const line = l.selection === 'home' ? (l.line ?? 0) : -(l.line ?? 0);
    return `${team} ${line > 0 ? '+' : ''}${line}`;
  };
  const shown = legs.slice(0, 6);
  const more = legs.length - shown.length;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: BRAND, display: 'flex' }} />
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>footballanalytics<span style={{ color: MUTED, fontWeight: 600 }}>.pro</span></div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: ACCENT, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>{t('sharedEyebrow')}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, gap: 0 }}>
          {shown.length === 0 && <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{t('sharedEmpty')}</div>}
          {shown.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2px solid ${LINE}`, fontSize: 28 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ color: MUTED, fontSize: 22, width: 28 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, maxWidth: 560, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.homeName} – {l.awayName}</span>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: BRAND, maxWidth: 360, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label(l)}</span>
                <span style={{ color: MUTED, fontSize: 24 }}>{Math.round(l.p * 100)}%{l.odds != null ? ` · ${l.odds.toFixed(2)}` : ''}</span>
              </div>
            </div>
          ))}
          {more > 0 && <div style={{ display: 'flex', marginTop: 10, fontSize: 24, color: MUTED }}>+{more}</div>}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 20, justifyContent: 'space-between', alignItems: 'baseline', fontSize: 24, color: MUTED }}>
          <span>{t('legs')} {totals.n}{totals.totalOdds != null ? ` · ${t('totalOdds')} ${totals.totalOdds.toFixed(2)}` : ''}</span>
          <span>18+ · {t('shareNote')}</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
