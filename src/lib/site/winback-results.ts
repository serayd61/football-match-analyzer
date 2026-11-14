// ============================================================================
// Geri kazanım e-postası — "geçen sefer gönderdiklerimiz" (saf, test edilir).
// 2026-11-14, kullanıcı kararı: ayrı sonuç maili yok; serinin her maili, kişiye
// bir önceki mailde giden maçların sonucuyla açılır. Kaybeden de yazılır.
//
// Ne gönderildiği tahmin edilmez: cron her gönderim gününde o günün bacaklarını
// social_posts'a (kind=winback, key `winback|<gün>|email|en`, body=JSON) yazar;
// sonuç bloğu yalnız o kayıttan kurulur. Kayıt yoksa blok da yok.
// ============================================================================
import { settleShowcase, type ShowcaseMarket, type ShowcaseSelection } from './showcase-rule';

export interface SentLeg {
  fixtureId: number; home: string; away: string;
  market: 'ou25' | 'btts' | '1x2'; selection: string;
  /** e-postada yazan seçim, örn. "Over 2.5" */ label: string;
}
export interface ResultRow { home: string; away: string; label: string; score: string; won: boolean }
export interface WinbackResults { n: number; won: number; rows: ResultRow[] }

export const winbackRecordKey = (day: string) => `winback|${day}|email|en`;

const MARKETS = new Set(['ou25', 'btts', '1x2']);

export function encodeSentLegs(legs: SentLeg[]): string {
  return JSON.stringify(legs.map((l) => ({ fixtureId: l.fixtureId, home: l.home, away: l.away, market: l.market, selection: l.selection, label: l.label })));
}

/** Kayıt gövdesini okur; bozuk ya da eksik satır atılır (yanlış sonuç yazmaktansa hiç yazma). */
export function parseSentLegs(body: string | null | undefined): SentLeg[] {
  if (!body) return [];
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: SentLeg[] = [];
  for (const r of raw as any[]) {
    const fixtureId = Number(r?.fixtureId);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0 || !MARKETS.has(r?.market)) continue;
    if (typeof r.home !== 'string' || typeof r.away !== 'string' || typeof r.label !== 'string' || !r.home || !r.away || !r.label) continue;
    out.push({ fixtureId, home: r.home, away: r.away, market: r.market, selection: String(r.selection ?? ''), label: r.label });
  }
  return out;
}

/** Skoru olan bacakları sonuçlandırır. Hiçbiri bitmemişse null (blok basılmaz). */
export function settleSent(legs: SentLeg[], scores: Map<number, [number, number]>): WinbackResults | null {
  const rows: ResultRow[] = [];
  for (const l of legs) {
    const sc = scores.get(l.fixtureId);
    if (!sc) continue;
    rows.push({ home: l.home, away: l.away, label: l.label, score: `${sc[0]}–${sc[1]}`, won: settleShowcase(l.market as ShowcaseMarket, l.selection as ShowcaseSelection, sc[0], sc[1]) });
  }
  return rows.length ? { n: rows.length, won: rows.filter((r) => r.won).length, rows } : null;
}

/** Konu satırına taşınacak gün: çoğunluğu tutmuş. */
export function isWinningDay(r: Pick<WinbackResults, 'n' | 'won'> | null | undefined): boolean {
  return !!r && r.n > 0 && r.won * 2 > r.n;
}
