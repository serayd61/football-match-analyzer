// ============================================================================
// KAPSAM DIŞI YÜKSEK GÜVEN LİSTESİ — kural (saf, test edilebilir)
// ----------------------------------------------------------------------------
// Neden (2026-09-23): kupon kuralı beyaz liste + gol pazarı + marj ister; beyaz
// liste dışı 340 ligde hiçbir ayak kaydedilmiyordu. 180 günlük geriye bakış
// (9.276 maç) modelin sıralamasının orada da çalıştığını gösterdi: 1X2 ≥%80 →
// %75, Üst ≥%85 → %76, Alt ≥%75 → %64, KG ≥%80 → %69. Bu modül o eşiklerin
// üstündeki ayakları seçer; kayıt + sonuçlandırma + Telegram DM daily.ts'te.
// Bu liste kupon DEĞİLDİR: site/sosyal yayına çıkmaz, karne için kanıt toplar.
// ============================================================================
import type { AfOdds } from '@/lib/data-sources/api-football-pure';

export const TIER_B_VERSION = 'tierb-1.0';
export const TIER_B_THRESHOLDS = { x12: 0.80, over: 0.85, under: 0.75, btts: 0.80 } as const;
/** Tek taraflı maçta KG önerilmez (goals-1.1 kuralı ile aynı). */
export const TIER_B_MAX_LAMBDA_RATIO_BTTS = 1.6;
/** Kadın, altyapı, rezerv, hazırlık: liste dışı. Alt ligler (3. Divisjon, Highland…) BİLEREK içeride — Üst orada güçlü. */
export const TIER_B_NOISE = /friendl|hazırlık|premier league 2|professional development|\(w\)|women|frauen|femen|feminin|kvinn|dames|\bu-?(15|16|17|18|19|20|21|23)\b|youth|junior|reserve|reserves|\bii\b|\bb\b|primavera|next pro|amateur/i;

export type TierBMarket = '1x2' | 'ou25' | 'btts';
export type TierBSelection = '1' | 'X' | '2' | 'over' | 'under' | 'yes';

export interface TierBInput {
  fixtureId: number; leagueId: number | null; leagueName: string | null;
  home: string; away: string; kickoff: string;
  pHome: number | null; pDraw: number | null; pAway: number | null;
  pOver25: number | null; pBtts: number | null;
  lambdaHome?: number | null; lambdaAway?: number | null;
}

export interface TierBLeg {
  fixtureId: number; leagueId: number | null; leagueName: string | null;
  home: string; away: string; kickoff: string;
  market: TierBMarket; selection: TierBSelection; modelP: number; threshold: number;
  /** eşik üstü mesafe (puan) — maç içi tie-break */
  edge: number;
}

export interface TierBSelectOptions {
  /** beyaz liste lig kimlikleri (kuponun kendi alanı; buraya girmez) */
  whitelist: Set<number>;
  now: Date;
  noise?: RegExp;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Bir maçın adayları; eşik üstü mesafeye göre en iyisi seçilir (tek ayak/maç). */
export function candidateLegs(row: TierBInput): TierBLeg[] {
  const base = { fixtureId: row.fixtureId, leagueId: row.leagueId, leagueName: row.leagueName, home: row.home, away: row.away, kickoff: row.kickoff };
  const out: TierBLeg[] = [];
  const leg = (market: TierBMarket, selection: TierBSelection, p: number, threshold: number) => {
    if (p >= threshold) out.push({ ...base, market, selection, modelP: r3(p), threshold, edge: r3(p - threshold) });
  };
  if (row.pHome != null && row.pDraw != null && row.pAway != null) {
    const ps: Array<[TierBSelection, number]> = [['1', row.pHome], ['X', row.pDraw], ['2', row.pAway]];
    const [sel, p] = ps.reduce((a, b) => (b[1] > a[1] ? b : a));
    leg('1x2', sel, p, TIER_B_THRESHOLDS.x12);
  }
  if (row.pOver25 != null) {
    leg('ou25', 'over', row.pOver25, TIER_B_THRESHOLDS.over);
    leg('ou25', 'under', 1 - row.pOver25, TIER_B_THRESHOLDS.under);
  }
  if (row.pBtts != null) {
    const lh = row.lambdaHome, la = row.lambdaAway;
    const ratio = lh != null && la != null && lh > 0 && la > 0 ? Math.max(lh, la) / Math.min(lh, la) : null;
    if (ratio == null || ratio <= TIER_B_MAX_LAMBDA_RATIO_BTTS) leg('btts', 'yes', row.pBtts, TIER_B_THRESHOLDS.btts);
  }
  return out;
}

export function selectTierB(rows: TierBInput[], opts: TierBSelectOptions): TierBLeg[] {
  const noise = opts.noise ?? TIER_B_NOISE;
  const seen = new Set<number>();
  const out: TierBLeg[] = [];
  for (const row of rows) {
    if (seen.has(row.fixtureId)) continue;
    if (Date.parse(row.kickoff) <= opts.now.getTime()) continue;
    if (row.leagueId != null && opts.whitelist.has(row.leagueId)) continue;
    if (row.leagueName && noise.test(row.leagueName)) continue;
    const c = candidateLegs(row);
    if (!c.length) continue;
    seen.add(row.fixtureId);
    out.push(c.reduce((a, b) => (b.edge > a.edge ? b : a)));
  }
  return out.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixtureId - b.fixtureId);
}

/** Sonuç: kazandı mı? */
export function legWon(market: TierBMarket, selection: string, hs: number, as: number): boolean {
  if (market === '1x2') return selection === '1' ? hs > as : selection === 'X' ? hs === as : hs < as;
  if (market === 'ou25') return selection === 'over' ? hs + as >= 3 : hs + as <= 2;
  return selection === 'yes' ? hs > 0 && as > 0 : !(hs > 0 && as > 0);
}

// ---- Oran / marj (API-Football) -------------------------------------------
export interface LegPrice { odds: number; marketP: number; margin: number }

/** Seçilen tarafın oranı + marjsız (çarpımsal devig) piyasa olasılığı + model marjı (puan). */
export function priceLeg(market: TierBMarket, selection: string, odds: AfOdds): LegPrice | null {
  let sides: Array<[string, number | null]>;
  if (market === '1x2') sides = [['1', odds.home], ['X', odds.draw], ['2', odds.away]];
  else if (market === 'ou25') sides = [['over', odds.over25], ['under', odds.under25]];
  else sides = [['yes', odds.bttsYes], ['no', odds.bttsNo]];
  if (sides.some(([, o]) => o == null)) return null;
  const inv = sides.map(([s, o]) => [s, 1 / (o as number)] as const);
  const sum = inv.reduce((a, [, v]) => a + v, 0);
  const mine = sides.find(([s]) => s === selection);
  if (!mine) return null;
  const marketP = (1 / (mine[1] as number)) / sum;
  return { odds: mine[1] as number, marketP: r3(marketP), margin: 0 };
}

export function withMargin(price: LegPrice, modelP: number): LegPrice {
  return { ...price, margin: Math.round((modelP - price.marketP) * 1000) / 10 };
}

// ---- Karne ---------------------------------------------------------------
export interface TierBRecordRow { market: TierBMarket; won: boolean | null; odds: number | null; settled_at: string | null }
export interface TierBRecord { n: number; won: number; lost: number; pending: number; void: number; byMarket: Record<TierBMarket, { n: number; won: number }>; priced: number; roi: number | null }

/** Sonuçlanmış ayaklardan karne; ROI yalnız oranlı ayaklarda (1 birim/ayak). */
export function tierBRecord(rows: TierBRecordRow[]): TierBRecord {
  const rec: TierBRecord = { n: 0, won: 0, lost: 0, pending: 0, void: 0, byMarket: { '1x2': { n: 0, won: 0 }, ou25: { n: 0, won: 0 }, btts: { n: 0, won: 0 } }, priced: 0, roi: null };
  let stake = 0, ret = 0;
  for (const r of rows) {
    if (r.won == null) { if (r.settled_at) rec.void++; else rec.pending++; continue; }
    rec.n++; rec.byMarket[r.market].n++;
    if (r.won) { rec.won++; rec.byMarket[r.market].won++; } else rec.lost++;
    if (r.odds != null) { rec.priced++; stake += 1; ret += r.won ? r.odds : 0; }
  }
  if (stake > 0) rec.roi = Math.round(((ret - stake) / stake) * 1000) / 10;
  return rec;
}

// ---- Telegram DM metni (Türkçe, admin) ------------------------------------
const MARKET_TR: Record<TierBMarket, (s: string) => string> = {
  '1x2': (s) => `MS ${s}`,
  ou25: (s) => (s === 'over' ? 'Üst 2,5' : 'Alt 2,5'),
  btts: (s) => (s === 'yes' ? 'KG Var' : 'KG Yok'),
};
const pct = (p: number) => `%${Math.round(p * 100)}`;
const hhmm = (iso: string, tz: string) => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

export interface DmLeg extends TierBLeg { price?: LegPrice | null }
export interface DmYesterday { date: string; rows: Array<{ home: string; away: string; market: TierBMarket; selection: string; won: boolean | null; hs: number | null; as: number | null }> }

export function formatTierBDm(date: string, legs: DmLeg[], record: TierBRecord, yesterday: DmYesterday | null, tz = 'Europe/Istanbul'): string {
  const lines: string[] = [];
  lines.push(`🧪 Kapsam dışı yüksek güven — ${date}`);
  lines.push(`Eşik: MS ≥%80 · Üst ≥%85 · Alt ≥%75 · KG ≥%80 (λ oranı ≤1,6). Kupon değil, karne için.`);
  lines.push('');
  if (!legs.length) lines.push('Bugün eşik üstü ayak yok.');
  for (const l of legs) {
    const price = l.price ? ` @${l.price.odds.toFixed(2)} (piyasa ${pct(l.price.marketP)}, marj ${l.price.margin >= 0 ? '+' : ''}${l.price.margin.toFixed(1)})` : '';
    lines.push(`• ${hhmm(l.kickoff, tz)} ${l.home} – ${l.away} · ${MARKET_TR[l.market](l.selection)} ${pct(l.modelP)}${price}`);
    lines.push(`  ${l.leagueName ?? '?'}`);
  }
  if (yesterday && yesterday.rows.length) {
    lines.push('');
    const w = yesterday.rows.filter((r) => r.won === true).length, n = yesterday.rows.filter((r) => r.won != null).length;
    lines.push(`Dün (${yesterday.date}): ${w}/${n}`);
    for (const r of yesterday.rows) {
      const mark = r.won == null ? '⏳' : r.won ? '✅' : '❌';
      const sc = r.hs != null && r.as != null ? ` ${r.hs}-${r.as}` : '';
      lines.push(`${mark} ${r.home} – ${r.away}${sc} · ${MARKET_TR[r.market](r.selection)}`);
    }
  }
  lines.push('');
  const acc = record.n ? ` (${pct(record.won / record.n)})` : '';
  const bm = (k: TierBMarket, name: string) => (record.byMarket[k].n ? `${name} ${record.byMarket[k].won}/${record.byMarket[k].n}` : null);
  const parts = [bm('1x2', 'MS'), bm('ou25', 'Ü/A'), bm('btts', 'KG')].filter(Boolean).join(' · ');
  lines.push(`Karne 30 gün: ${record.won}/${record.n}${acc}${parts ? ` — ${parts}` : ''}${record.roi != null ? ` · ROI ${record.roi >= 0 ? '+' : ''}${record.roi}% (${record.priced} oranlı)` : ''}${record.pending ? ` · ${record.pending} bekliyor` : ''}`);
  return lines.join('\n');
}
