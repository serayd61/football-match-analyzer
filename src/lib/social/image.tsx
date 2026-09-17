// Dikey paylaşım görseli (1080×1350) — günün seçimleri ve haftalık karne.
// next/og (Satori) ile üretilir; yazı tipi Google Fonts'tan TTF olarak çekilip
// bellekte tutulur. Renkler site kimliğiyle uyumlu (kiremit vurgu, sıcak zemin).
import 'server-only';
import { ImageResponse } from 'next/og';
import { fmtDate, fmtOdds, fmtTime, marketLabel, pct, type Lang, type Leg, type WeeklyStats } from './content';

const BG = '#f5f3ee', INK = '#1c1b18', MUTED = '#6a655b', ACCENT = '#a8432a', LINE = '#dfdad0', CARD = '#ffffff';
const W = 1080, H = 1350;

const fontCache = new Map<string, Promise<ArrayBuffer>>();
async function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  if (!fontCache.has(key)) fontCache.set(key, (async () => {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:10.0) Gecko/20100101 Firefox/10.0' } }).then((r) => r.text());
    const m = css.match(/src: url\(([^)]+\.ttf)\)/);
    if (!m) throw new Error(`font url yok: ${family}`);
    return fetch(m[1]).then((r) => r.arrayBuffer());
  })());
  return fontCache.get(key)!;
}

async function fonts() {
  const [display, body] = await Promise.all([googleFont('Archivo', 700), googleFont('IBM Plex Sans', 500)]);
  return [{ name: 'Archivo', data: display, weight: 700 as const, style: 'normal' as const }, { name: 'Plex', data: body, weight: 500 as const, style: 'normal' as const }];
}

const toBuffer = async (r: ImageResponse) => Buffer.from(await r.arrayBuffer());

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Archivo', fontSize: 34 }}>
      <span>football</span><span style={{ color: ACCENT }}>analytics</span><span style={{ color: MUTED }}>.pro</span>
    </div>
  );
}

export async function dailyImage(legs: Leg[], ymd: string, lang: Lang, record: { n: number; won: number } | null): Promise<Buffer> {
  const title = lang === 'tr' ? 'Günün seçimleri' : "Today's picks";
  const rule = lang === 'tr' ? 'Kural: gol pazarı eşiği + piyasaya karşı ≥3 puan marj · oran 1,25–1,75 · maçtan önce dondurulur' : 'Rule: goal-market threshold + ≥3pt margin vs market · odds 1.25–1.75 · frozen before kick-off';
  const rec = record && record.n ? (lang === 'tr' ? `Son 7 gün ${record.won}/${record.n}` : `Last 7 days ${record.won}/${record.n}`) : '';
  return toBuffer(new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 64, fontFamily: 'Plex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `4px solid ${INK}`, paddingBottom: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 26, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase' }}>{fmtDate(ymd, lang)}</span>
            <span style={{ fontFamily: 'Archivo', fontSize: 74, lineHeight: 1, marginTop: 8 }}>{title}</span>
          </div>
          {rec && <span style={{ fontSize: 30, color: MUTED }}>{rec}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 40 }}>
          {legs.map((l) => (
            <div key={l.fixtureId} style={{ display: 'flex', flexDirection: 'column', background: CARD, border: `2px solid ${LINE}`, padding: '30px 34px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: MUTED }}>
                <span>{l.leagueName}</span><span>{fmtTime(l.kickoff, lang)}</span>
              </div>
              <span style={{ fontFamily: 'Archivo', fontSize: 46, lineHeight: 1.1, marginTop: 10 }}>{l.homeName} – {l.awayName}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22 }}>
                <span style={{ fontFamily: 'Archivo', fontSize: 40, color: ACCENT }}>{marketLabel(l, lang)}</span>
                <div style={{ display: 'flex', gap: 34, fontSize: 30 }}>
                  <span><span style={{ color: MUTED }}>{lang === 'tr' ? 'model ' : 'model '}</span>{pct(l.modelP)}</span>
                  {l.odds ? <span><span style={{ color: MUTED }}>{lang === 'tr' ? 'oran ' : 'odds '}</span>{fmtOdds(l.odds, lang)}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 18 }}>
          <span style={{ fontSize: 24, color: MUTED, lineHeight: 1.35 }}>{rule}</span>
          <Brand />
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await fonts() },
  ));
}

export async function weeklyImage(s: WeeklyStats, lang: Lang): Promise<Buffer> {
  const rate = s.n ? Math.round((s.won / s.n) * 100) : 0;
  const rows: [string, { n: number; won: number }][] = [
    [lang === 'tr' ? '1X2' : '1X2', s.byMarket['1x2'] ?? { n: 0, won: 0 }],
    [lang === 'tr' ? 'Üst 2,5' : 'Over 2.5', s.byMarket.ou25 ?? { n: 0, won: 0 }],
    [lang === 'tr' ? 'KG Var' : 'BTTS', s.byMarket.btts ?? { n: 0, won: 0 }],
  ];
  return toBuffer(new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 64, fontFamily: 'Plex' }}>
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: `4px solid ${INK}`, paddingBottom: 22 }}>
          <span style={{ fontSize: 26, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase' }}>{fmtDate(s.from, lang)} – {fmtDate(s.to, lang)}</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 74, lineHeight: 1, marginTop: 8 }}>{lang === 'tr' ? 'Haftalık karne' : 'Weekly record'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 48 }}>
          <span style={{ fontFamily: 'Archivo', fontSize: 180, lineHeight: 1 }}>{s.won}/{s.n}</span>
          <span style={{ fontFamily: 'Archivo', fontSize: 64, color: ACCENT }}>{rate}%</span>
        </div>
        <span style={{ fontSize: 30, color: MUTED, marginTop: 8 }}>{lang === 'tr' ? 'vitrin seçimi, maçtan önce dondurulmuş' : 'showcase picks, frozen before kick-off'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 56, borderTop: `2px solid ${LINE}` }}>
          {rows.map(([name, v]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 0', borderBottom: `2px solid ${LINE}`, fontSize: 40 }}>
              <span style={{ fontFamily: 'Archivo' }}>{name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <div style={{ display: 'flex', width: 360, height: 22, background: LINE }}>
                  <div style={{ display: 'flex', width: v.n ? Math.round((v.won / v.n) * 360) : 0, height: 22, background: ACCENT }} />
                </div>
                <span style={{ width: 150, textAlign: 'right' }}>{v.won}/{v.n}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '26px 0', fontSize: 32, color: MUTED }}>
            <span>{lang === 'tr' ? 'Seçim yok denilen maç' : 'No-pick calls'}</span><span>{s.noPick}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 18 }}>
          <span style={{ fontSize: 24, color: MUTED, lineHeight: 1.35 }}>{lang === 'tr' ? 'Kazanan da kaybeden de yazılır. Tam karne sitede.' : 'Wins and losses both recorded. Full record on the site.'}</span>
          <Brand />
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await fonts() },
  ));
}
