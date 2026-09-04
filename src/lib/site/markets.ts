import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';

// ---------------------------------------------------------------------------
// Extra bookmaker markets, parsed from the raw odds payload the hourly
// snapshot cron already stores in prediction_odds.raw (verified 2026-09-04:
// every row carries oddsTabMarkets). No extra upstream calls.
// ---------------------------------------------------------------------------

export interface TwoWay { a: number; b: number; pA: number; pB: number }
export interface MarketBook {
  phase: 'opening' | 'closing';
  provider: string | null;
  capturedAt: string;
  /** main Asian line from the home side's perspective (+2.25 = home gets 2.25) */
  asian: { line: number; home: number; away: number; pHome: number; pAway: number } | null;
  drawNoBet: TwoWay | null;
  btts: TwoWay | null;
  halfTime: { home: number; draw: number; away: number; pHome: number; pDraw: number; pAway: number } | null;
  /** bookmaker's listed correct scores with implied probability (margin not removed: list is partial) */
  correctScore: Array<{ home: number; away: number; odds: number; implied: number }>;
}

const num = (v: any): number | null => { const n = typeof v === 'string' ? parseFloat(v) : Number(v); return Number.isFinite(n) && n > 1 && n < 1000 ? n : null; };
const two = (a: number | null, b: number | null): TwoWay | null => {
  if (!a || !b) return null;
  const s = 1 / a + 1 / b;
  return { a, b, pA: 1 / a / s, pB: 1 / b / s };
};

export function parseMarkets(raw: any): Omit<MarketBook, 'phase' | 'provider' | 'capturedAt'> | null {
  const tabs: any[] = raw?.odds?.odds?.oddsTabMarkets || [];
  if (!tabs.length) return null;
  const markets: any[] = tabs.flatMap((c) => c?.markets || []);
  const find = (key: string, re: RegExp) => markets.find((m) => m?.headerTranslationKey === key || re.test(String(m?.header || '')));
  const sel = (m: any, name: string) => num((m?.selections || []).find((s: any) => String(s?.name || '').toLowerCase() === name)?.oddsDecimal);

  let asian: MarketBook['asian'] = null;
  const ah = find('odds_asian_handicap', /^asian handicap$/i);
  if (ah?.selections?.length === 2) {
    const [h, a] = ah.selections;
    const line = parseFloat(String(h?.name || '').replace('+', ''));
    const ho = num(h?.oddsDecimal), ao = num(a?.oddsDecimal);
    if (Number.isFinite(line) && ho && ao) { const s = 1 / ho + 1 / ao; asian = { line, home: ho, away: ao, pHome: 1 / ho / s, pAway: 1 / ao / s }; }
  }

  const dnb = find('odds_draw_no_bet', /draw no bet/i);
  const drawNoBet = dnb?.selections?.length === 2 ? two(num(dnb.selections[0]?.oddsDecimal), num(dnb.selections[1]?.oddsDecimal)) : null;

  const bt = find('both_score', /^both teams to score$/i);
  const btts = bt ? two(sel(bt, 'yes'), sel(bt, 'no')) : null;

  let halfTime: MarketBook['halfTime'] = null;
  const ht = find('odds_hub_firsthalf', /^half-time$/i);
  if (ht) {
    const h = sel(ht, '1'), d = sel(ht, 'x'), a = sel(ht, '2');
    if (h && d && a) { const s = 1 / h + 1 / d + 1 / a; halfTime = { home: h, draw: d, away: a, pHome: 1 / h / s, pDraw: 1 / d / s, pAway: 1 / a / s }; }
  }

  const cs = find('odds_correct_score', /correct score/i);
  const correctScore = ((cs?.selections || []) as any[])
    .map((s) => { const m = /^(\d+)-(\d+)$/.exec(String(s?.name || '')); const o = num(s?.oddsDecimal); return m && o ? { home: Number(m[1]), away: Number(m[2]), odds: o, implied: 1 / o } : null; })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return { asian, drawNoBet, btts, halfTime, correctScore };
}

/** Latest closing (else opening) book for a fixture, with the extra markets. */
export const getMarketBook = unstable_cache(
  async (fixtureId: number): Promise<MarketBook | null> => {
    const { data } = await db()
      .from('prediction_odds')
      .select('phase, provider, captured_at, raw')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: false })
      .limit(10);
    if (!data?.length) return null;
    const row = (data as any[]).find((r) => r.phase === 'closing') || data[0];
    const parsed = parseMarkets((row as any).raw);
    if (!parsed) return null;
    return { phase: (row as any).phase, provider: (row as any).provider ? String((row as any).provider).replace(/_default$/i, '') : null, capturedAt: (row as any).captured_at, ...parsed };
  },
  ['site-market-book'],
  { revalidate: REVALIDATE.fixtures },
);
