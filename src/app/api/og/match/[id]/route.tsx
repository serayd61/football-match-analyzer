import { ImageResponse } from 'next/og';
import { getPrediction } from '@/lib/site/predictions';

export const runtime = 'nodejs';
export const revalidate = 900;

const INK = '#14262b', MUTED = '#5c6c70', BRAND = '#0f3a45', ACCENT = '#c46c14', VOID = '#808b8e', BG = '#f6f7f5', LINE = '#d6dcd9';

// Open Graph card for a match: teams, kickoff, 1X2 bar and the pick.
// English only by design: crawlers request one image per URL and the
// numbers are the message.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const p = Number.isInteger(id) && id > 0 ? await getPrediction(id) : null;
  if (!p) return new Response('Not found', { status: 404 });

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const kickoff = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Zurich' }).format(new Date(p.kickoff));
  const pickName = p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : 'Draw';
  const score = p.homeScore != null && p.awayScore != null ? `${p.homeScore}–${p.awayScore}` : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: INK, padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: MUTED }}>
          <span>{p.leagueName}</span>
          <span>{kickoff} CET</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 440 }}>
            <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.05 }}>{p.homeName}</span>
            <span style={{ fontSize: 30, color: MUTED, marginTop: 8 }}>Home · {pct(p.pHome)}</span>
          </div>
          <div style={{ fontSize: score ? 64 : 36, fontWeight: 700, color: score ? INK : VOID }}>{score ?? 'v'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 440, alignItems: 'flex-end', textAlign: 'right' }}>
            <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.05 }}>{p.awayName}</span>
            <span style={{ fontSize: 30, color: MUTED, marginTop: 8 }}>Away · {pct(p.pAway)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', height: 40, marginTop: 48, border: `2px solid ${LINE}` }}>
          <div style={{ width: `${p.pHome * 100}%`, background: BRAND }} />
          <div style={{ width: `${p.pDraw * 100}%`, background: VOID }} />
          <div style={{ width: `${p.pAway * 100}%`, background: ACCENT }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 26 }}>
          <span>{pct(p.pHome)}</span><span style={{ color: MUTED }}>Draw {pct(p.pDraw)}</span><span>{pct(p.pAway)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, color: MUTED }}>Model pick</span>
            <span style={{ fontSize: 40, fontWeight: 700 }}>{pickName} · {pct(p.confidence ?? p.confidenceRaw ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
            Football<span style={{ color: ACCENT }}>Analytics</span><span style={{ color: MUTED }}>.pro</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
