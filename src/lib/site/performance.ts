import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { db, REVALIDATE } from './db';
import { SITE_LEAGUES, type SiteLeague } from './leagues';
import { coveredLeagueIds } from './results';
import { loadContext } from './predictions';
import { pickOfficial, officialFilter, resolveOfficialVersion } from './official';
import { applyCurve } from '@/lib/calibration';
import { MIN_OVER, MIN_BTTS } from './daily-picks-rule';
import { makeBins, addToBin, finishBins, walkForwardBins, type CalBin, type TPt } from '@/lib/calibration-eval';
import { deriveOverUnder, deriveBtts } from '@/lib/goal-markets';

// ---------------------------------------------------------------------------
// Track-record aggregates for the public site. Everything here is computed
// from settled rows with a final score in covered leagues; nothing is
// filtered by outcome. Cached for an hour.
//
// Denetim 2026-09-05:
//   • Oranlar artık aynı fixture kümesi için sayfalanarak çekilir (eski kod:
//     tablo geneli "en yeni 5.000 snapshot" — kapsam rastgele daralırdı).
//   • ROI açılış ve kapanış oranı için AYRI hesaplanır; payda, kapsam ve
//     eksik oran sayısı raporlanır. Eksik oranlar sessizce düşmez.
//   • correct=NULL ama result dolu satır: skordan yeniden hesaplanır ve sayılır.
//   • Aynı maçın birden çok model sürümü tek resmi satıra indirgenir.
//   • Kalibrasyon iki biçimde: bugünkü eğriyle geriye dönük (retrospective)
//     ve yalnız önceki ayları görmüş eğriyle (walk-forward).
// ---------------------------------------------------------------------------

const Row = z.object({
  fixture_id: z.coerce.number(),
  model_version: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
  league_id: z.coerce.number().nullable(),
  kickoff: z.string(),
  p_home: z.coerce.number(),
  p_draw: z.coerce.number(),
  p_away: z.coerce.number(),
  p_over25: z.coerce.number().nullable(),
  p_btts_yes: z.coerce.number().nullable(),
  pick: z.enum(['1', 'X', '2']).nullable(),
  confidence: z.coerce.number().nullable(),
  correct: z.boolean().nullable(),
  result: z.enum(['H', 'D', 'A']).nullable(),
  home_score: z.coerce.number().nullable(),
  away_score: z.coerce.number().nullable(),
});
type Row = z.infer<typeof Row>;

const ROW_COLS = 'fixture_id, model_version, updated_at, league_id, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, pick, confidence, correct, result, home_score, away_score';
const PAGE = 1000;
const MAX_ROWS = 40000;

async function fetchSettled(ids: number[]): Promise<{ rows: Row[]; truncated: boolean; quarantined: number }> {
  const out: Row[] = [];
  let truncated = false;
  let quarantined = 0;
  const official = await resolveOfficialVersion();
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await officialFilter(db()
      .from('engine_predictions')
      .select(ROW_COLS)
      .eq('settled', true)
      .not('home_score', 'is', null)
      .in('league_id', ids), official)
      .order('kickoff', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const list = (data || []) as unknown[];
    for (const raw of list) {
      const p = Row.safeParse(raw);
      if (p.success) out.push(p.data); else quarantined++;
    }
    if (list.length < PAGE) break;
    if (from + PAGE >= MAX_ROWS) truncated = true;
  }
  if (quarantined) console.error(`[site/performance] ${quarantined} rows quarantined`);
  return { rows: pickOfficial(out, official), truncated, quarantined };
}

import { addRoi, finishRoi, mkRoi, isPickCorrect, type OddsRow, type Roi } from './roi';
export type { Roi };
export type OddsIndex = Map<number, { opening?: OddsRow; closing?: OddsRow; btts?: { pYes: number; pNo: number } }>;

const OddsSchema = z.object({
  fixture_id: z.coerce.number(), phase: z.string(), provider: z.string().nullable().optional(),
  home_odds: z.coerce.number(), draw_odds: z.coerce.number(), away_odds: z.coerce.number(), captured_at: z.string(),
});

/** Opening and closing 1X2 odds for exactly these fixtures, fetched in id chunks (no global row cap). */
async function fetchOddsFor(fixtureIds: number[]): Promise<OddsIndex> {
  const map: OddsIndex = new Map();
  const CHUNK = 200;
  for (let i = 0; i < fixtureIds.length; i += CHUNK) {
    const chunk = fixtureIds.slice(i, i + CHUNK);
    // KG oranı sütunlardan (raw jsonb ~75 KB/satır; 2026-09-12 build timeout'u).
    // Migration uygulanmamışsa sütunsuz tekrar dener; KG farkı o zaman boş kalır.
    const base = 'fixture_id, phase, provider, home_odds, draw_odds, away_odds, captured_at';
    // Denetim 2026-09-18 (B05): 6 faz varken fazsız sorgu + ×4 limit, captured_at DESC
    // sırasında en eski (opening) satırları kesiyordu. Anahtar (fixture_id, phase)
    // tekil → iki fazla ×2 tam sayıdır, kesilme olamaz. (weekly.ts aynı kalıp.)
    const q = (cols: string) => db().from('prediction_odds').select(cols).in('fixture_id', chunk).in('phase', ['opening', 'closing']).order('captured_at', { ascending: false }).limit(chunk.length * 2);
    let { data, error } = await q(`${base}, btts_yes_odds, btts_no_odds`);
    if (error && /btts_(yes|no)_odds/.test(error.message)) ({ data, error } = await q(base));
    if (error) { console.error('[site/performance] odds fetch failed', error.message); continue; }
    for (const raw of (data || []) as unknown[]) {
      const p = OddsSchema.safeParse(raw);
      if (!p.success) continue;
      const r = { ...p.data, provider: p.data.provider ?? null };
      const slot = map.get(r.fixture_id) ?? {};
      // ROI anlamı değişmez: 'opening' = ilk görüş, 'closing' = ≤90 dk; ara fazlar (h24…h3) burada sayılmaz.
      if ((r.phase === 'opening' || r.phase === 'closing') && !slot[r.phase]) slot[r.phase] = r; // newest first → keep the latest per phase
      // KG kitabı: kapanış varsa kapanış, yoksa ilk görülen (açılış). Sinyal karnesi için.
      if (!slot.btts || r.phase === 'closing') {
        const y = Number((raw as any)?.btts_yes_odds), n = Number((raw as any)?.btts_no_odds);
        if (y > 1 && n > 1) { const s = 1 / y + 1 / n; slot.btts = { pYes: 1 / y / s, pNo: 1 / n / s }; }
      }
      map.set(r.fixture_id, slot);
    }
  }
  return map;
}

export interface Bucket { n: number; won: number; acc: number | null; brier: number | null }
/** Per-league card: 1X2 in the base bucket, goal markets alongside (same settlement rules as `markets`). */
export interface LeagueBucket extends Bucket { league: SiteLeague; ou25: Bucket; btts: Bucket }
export interface MonthBucket extends Bucket { month: string }
export interface MarketBucket extends Bucket { market: '1x2' | 'ou25' | 'btts' }
export type { CalBin };

// ── Sinyal karnesi ──────────────────────────────────────────────────────────
// Soru: "model şu kadar diyorsa / piyasadan şu kadar ayrışıyorsa ne kadar tutuyor?"
// pazar × lig × kova. İki kova türü: model SEVİYESİ (seçilen tarafın ham
// olasılığı) ve piyasa FARKI (model − marjsız piyasa, yüzde puan; yalnız oranı
// kayıtlı maçlar). 2026-09-12 backtest'inin sitedeki kalıcı hali.
export { LEVEL_BUCKETS, EDGE_BUCKETS, CLASH_BUCKETS, levelBucket, edgeBucket, clashBucket } from './signal-buckets';
export type { SignalMarket, SignalKind, SignalCell, SignalLeagueRow, SignalTable } from './signal-buckets';
import { LEVEL_BUCKETS, EDGE_BUCKETS, CLASH_BUCKETS, levelBucket, edgeBucket, clashBucket, type SignalMarket, type SignalKind, type SignalCell, type SignalTable } from './signal-buckets';

export interface PerformanceReport {
  overall: Bucket;
  leagues: LeagueBucket[];
  markets: MarketBucket[];
  /** pazar × lig × (seviye | fark) kovaları */
  signals: SignalTable[];
  months: MonthBucket[];
  /** today's curve applied to every past row (retrospective; NOT an out-of-sample result) */
  calibration: CalBin[];
  /** each month scored with a curve fitted on earlier months only */
  calibrationWalkForward: { bins: CalBin[]; scored: number; warmup: number; firstScoredMonth: string | null; brierRaw: number | null; brierCalibrated: number | null };
  calibrationCurve: { segment: string; fittedAt: string | null; nSamples: number | null } | null;
  /** closing-price ROI (benchmark); `roiOpening` is the price available when the prediction was published */
  roi: Roi | null;
  roiOpening: Roi | null;
  quality: { decided: number; recomputedCorrect: number; truncated: boolean; quarantined: number; modelVersions: string[] };
  from: string | null;
  to: string | null;
  computedAt: string;
}

const mk = (): { n: number; won: number; sq: number } => ({ n: 0, won: 0, sq: 0 });
const fin = (b: { n: number; won: number; sq: number }): Bucket => ({ n: b.n, won: b.won, acc: b.n ? b.won / b.n : null, brier: b.n ? b.sq / b.n : null });

/** Multi-class Brier for one 1X2 row (0 = perfect, 2 = worst). */
function brier1x2(r: Pick<Row, 'p_home' | 'p_draw' | 'p_away' | 'result'>): number {
  const y = { H: [1, 0, 0], D: [0, 1, 0], A: [0, 0, 1] }[r.result!];
  return (r.p_home - y[0]) ** 2 + (r.p_draw - y[1]) ** 2 + (r.p_away - y[2]) ** 2;
}

export const getPerformance = unstable_cache(
  async (leagueSlug?: string | null): Promise<PerformanceReport> => {
    const idMap = await coveredLeagueIds();
    const slugOfId = new Map<number, string>();
    for (const [slug, ids] of Object.entries(idMap)) for (const id of ids) slugOfId.set(id, slug);
    const ids = leagueSlug ? idMap[leagueSlug] || [] : Object.values(idMap).flat();

    const [{ rows, truncated, quarantined }, ctx] = await Promise.all([fetchSettled(ids), loadContext()]);
    const decided = rows.filter((r) => r.result != null && r.pick != null && r.home_score != null && r.away_score != null);
    const odds = await fetchOddsFor(decided.map((r) => r.fixture_id));

    const overall = mk();
    const byLeague = new Map<string, ReturnType<typeof mk>>();
    const byLeagueOu = new Map<string, ReturnType<typeof mk>>();
    const byLeagueBtts = new Map<string, ReturnType<typeof mk>>();
    const byMonth = new Map<string, ReturnType<typeof mk>>();
    const ou = mk(), btts = mk();
    const bins = makeBins();
    const wfPoints: TPt[] = [];
    const roiClosing = mkRoi(), roiOpening = mkRoi();
    // Sinyal karnesi sayaçları: key = market|kind|league(or *)|bucket
    const sig = new Map<string, { n: number; won: number }>();
    const bump = (market: SignalMarket, kind: SignalKind, league: string | null, bucket: number, won: boolean) => {
      for (const lg of [null, league]) {
        if (lg === undefined) continue;
        const k = `${market}|${kind}|${lg ?? '*'}|${bucket}`;
        const c = sig.get(k) ?? { n: 0, won: 0 }; c.n++; if (won) c.won++; sig.set(k, c);
      }
    };
    let recomputedCorrect = 0;
    const versions = new Set<string>();

    for (const r of decided) {
      let won: boolean;
      if (r.correct == null) { won = isPickCorrect(r.pick, r.result!); recomputedCorrect++; } else won = r.correct;
      if (r.model_version) versions.add(r.model_version);
      const sq = brier1x2(r);
      const add = (b: ReturnType<typeof mk>) => { b.n++; if (won) b.won++; b.sq += sq; };
      add(overall);
      const slug = r.league_id != null ? slugOfId.get(r.league_id) : undefined;
      if (slug) { if (!byLeague.has(slug)) byLeague.set(slug, mk()); add(byLeague.get(slug)!); }
      const month = r.kickoff.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, mk());
      add(byMonth.get(month)!);

      // Calibration on the calibrated confidence shown to visitors (retrospective, today's curve).
      const conf = applyCurve(r.confidence, ctx.curves.pick);
      if (conf != null) addToBin(bins, conf, won);
      if (r.confidence != null) wfPoints.push({ x: r.confidence, y: won ? 1 : 0, t: Date.parse(r.kickoff) });

      // Goal markets: settled from the score, scored on the raw model probability (binary Brier, 0..1).
      const hs = r.home_score!, as = r.away_score!;
      const total = hs + as;
      const o = deriveOverUnder(r.p_over25);
      const addGoal = (map: Map<string, ReturnType<typeof mk>>, b: ReturnType<typeof mk>, hit: boolean, sq2: number) => {
        b.n++; if (hit) b.won++; b.sq += sq2;
        if (slug) { if (!map.has(slug)) map.set(slug, mk()); const lb = map.get(slug)!; lb.n++; if (hit) lb.won++; lb.sq += sq2; }
      };
      if (o && r.p_over25 != null) {
        const hit = o.pick === 'over' ? total > 2.5 : total < 2.5;
        addGoal(byLeagueOu, ou, hit, (r.p_over25 - (total > 2.5 ? 1 : 0)) ** 2);
      }
      const b = deriveBtts(r.p_btts_yes);
      const both = hs > 0 && as > 0;
      if (b && r.p_btts_yes != null) {
        const hit = (b.pick === 'yes') === both;
        addGoal(byLeagueBtts, btts, hit, (r.p_btts_yes - (both ? 1 : 0)) ** 2);
      }

      const od = odds.get(r.fixture_id);
      if (od?.closing) addRoi(roiClosing, r, od.closing, won);
      if (od?.opening) addRoi(roiOpening, r, od.opening, won);

      // Sinyal karnesi (skor + pick zaten doğrulandı)
      const lg = slug ?? null;
      const pickP = r.pick === '1' ? r.p_home : r.pick === '2' ? r.p_away : r.p_draw;
      bump('1x2', 'level', lg, levelBucket(pickP), won);
      const book = od?.closing ?? od?.opening;
      let clash: number | null = null;
      if (book) {
        const inv = [1 / book.home_odds, 1 / book.draw_odds, 1 / book.away_odds]; const sum = inv[0] + inv[1] + inv[2];
        const mp = r.pick === '1' ? inv[0] / sum : r.pick === '2' ? inv[2] / sum : inv[1] / sum;
        bump('1x2', 'edge', lg, edgeBucket(pickP - mp), won);
        clash = clashBucket(pickP - mp);
      }
      if (o && r.p_over25 != null) {
        const pSide = o.pick === 'over' ? r.p_over25 : 1 - r.p_over25;
        const hitO = o.pick === 'over' ? total > 2.5 : total < 2.5;
        bump('ou25', 'level', lg, levelBucket(pSide), hitO);
        if (clash != null && o.pick === 'over' && r.p_over25 >= MIN_OVER) bump('ou25', 'clash', lg, clash, hitO);
      }
      if (b && r.p_btts_yes != null) {
        const pSide = b.pick === 'yes' ? r.p_btts_yes : 1 - r.p_btts_yes;
        const hitB = (b.pick === 'yes') === both;
        bump('btts', 'level', lg, levelBucket(pSide), hitB);
        if (od?.btts) bump('btts', 'edge', lg, edgeBucket(pSide - (b.pick === 'yes' ? od.btts.pYes : od.btts.pNo)), hitB);
        if (clash != null && b.pick === 'yes' && r.p_btts_yes >= MIN_BTTS) bump('btts', 'clash', lg, clash, hitB);
      }
    }

    const signals: SignalTable[] = [];
    for (const [market, kind, buckets] of [['1x2', 'level', LEVEL_BUCKETS], ['1x2', 'edge', EDGE_BUCKETS], ['ou25', 'level', LEVEL_BUCKETS], ['ou25', 'clash', CLASH_BUCKETS], ['btts', 'level', LEVEL_BUCKETS], ['btts', 'edge', EDGE_BUCKETS], ['btts', 'clash', CLASH_BUCKETS]] as const) {
      const cell = (lg: string | null, i: number): SignalCell => { const c = sig.get(`${market}|${kind}|${lg ?? '*'}|${i}`) ?? { n: 0, won: 0 }; return { ...c, acc: c.n ? c.won / c.n : null }; };
      const all = buckets.map((_, i) => cell(null, i));
      const leagues = SITE_LEAGUES.map((l) => { const cells = buckets.map((_, i) => cell(l.slug, i)); return { league: l, n: cells.reduce((a, c) => a + c.n, 0), cells }; })
        .filter((row) => row.n >= 5).sort((a, b) => b.n - a.n);
      signals.push({ market, kind, buckets: [...buckets], all, leagues });
    }

    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, b]) => ({ month, ...fin(b) }));
    const leagues = SITE_LEAGUES.filter((l) => byLeague.has(l.slug))
      .map((l) => ({ league: l, ...fin(byLeague.get(l.slug)!), ou25: fin(byLeagueOu.get(l.slug) ?? mk()), btts: fin(byLeagueBtts.get(l.slug) ?? mk()) }))
      .sort((a, b) => b.n - a.n);

    return {
      overall: fin(overall),
      leagues,
      markets: [
        { market: '1x2', ...fin(overall) },
        { market: 'ou25', ...fin(ou) },
        { market: 'btts', ...fin(btts) },
      ],
      signals,
      months,
      calibration: finishBins(bins),
      calibrationWalkForward: walkForwardBins(wfPoints),
      calibrationCurve: ctx.curveMeta.pick,
      roi: finishRoi(roiClosing, 'closing', decided.length),
      roiOpening: finishRoi(roiOpening, 'opening', decided.length),
      quality: { decided: decided.length, recomputedCorrect, truncated, quarantined, modelVersions: [...versions].sort() },
      from: decided[0]?.kickoff ?? null,
      to: decided[decided.length - 1]?.kickoff ?? null,
      computedAt: new Date().toISOString(),
    };
  },
  ['site-performance-v4'],
  { revalidate: REVALIDATE.performance },
);
