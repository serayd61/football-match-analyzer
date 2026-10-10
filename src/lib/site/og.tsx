import { ImageResponse } from 'next/og';

// Shared Open Graph card (1200×630) for the public site — SEO denetimi 2026-10-10.
// Before this, no page except the match page had an og:image, so shares on
// WhatsApp / X / LinkedIn showed a text-only preview.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const INK = '#14262b', MUTED = '#5c6c70', ACCENT = '#ac5a0a', BG = '#f6f7f5', LINE = '#d6dcd9', BRAND = '#1f8a4c';

export function ogCard({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  // Long taglines (home card is ~95 chars) shrink so title + subtitle never run into the footer rule.
  const big = title.length > 80 ? 46 : title.length > 48 ? 52 : 64;
  const sub = title.length > 80 ? 25 : 28;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: BRAND, display: 'flex' }} />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            footballanalytics<span style={{ color: MUTED, fontWeight: 600 }}>.pro</span>
          </div>
        </div>
        {eyebrow && <div style={{ display: 'flex', marginTop: 72, fontSize: 26, color: ACCENT, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>{eyebrow}</div>}
        <div style={{ display: 'flex', marginTop: eyebrow ? 16 : 88, fontSize: big, fontWeight: 700, lineHeight: 1.08, maxWidth: 1000 }}>{title}</div>
        {subtitle && <div style={{ display: 'flex', marginTop: 20, fontSize: sub, color: MUTED, lineHeight: 1.35, maxWidth: 960 }}>{subtitle}</div>}
        <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 24, borderTop: `2px solid ${LINE}`, justifyContent: 'space-between', fontSize: 22, color: MUTED }}>
          <span>Dixon-Coles · 1X2 · O/U 2.5 · BTTS</span>
          <span>18+ · Play responsibly</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
