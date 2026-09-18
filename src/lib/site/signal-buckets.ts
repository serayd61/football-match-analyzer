// Sinyal karnesi kovaları ve tipleri (saf; 'server-only' yok) — performance.ts
// ve match-standing.ts ortak kullanır, testler doğrudan içe alabilir.
import type { SiteLeague } from './leagues';

export type SignalMarket = '1x2' | 'ou25' | 'btts';
export type SignalKind = 'level' | 'edge' | 'clash';
export interface SignalCell { n: number; won: number; acc: number | null }
export interface SignalLeagueRow { league: SiteLeague; n: number; cells: SignalCell[] }
export interface SignalTable { market: SignalMarket; kind: SignalKind; buckets: string[]; all: SignalCell[]; leagues: SignalLeagueRow[] }
export const LEVEL_BUCKETS = ['<50%', '50–60%', '60–70%', '≥70%'] as const;
export const EDGE_BUCKETS = ['≤−5', '−5…0', '0…+5', '+5…+10', '>+10'] as const;
/** 1X2 uyuşmazlığı: |model seçimi − marjsız piyasa| yüzde puan. Gol pazarlarında,
 *  seçilen taraf günün-seçimi eşiğini (Üst ≥ %65, KG Var ≥ %60) geçtiğinde sayılır.
 *  Bulgu 2026-09-13 (n=231): ≥10 puan uyuşmazlıkta Üst 13/13, KG 22/24; <10'da %70 / %80.
 *  Örneklemin 2/3'ü Eredivisie; Eredivisie dışı 30–40 maça ulaşınca kurala tiebreak olarak girer. */
export const CLASH_BUCKETS = ['<5', '5–10', '≥10'] as const;
export const levelBucket = (p: number) => (p < 0.5 ? 0 : p < 0.6 ? 1 : p < 0.7 ? 2 : 3);
export const edgeBucket = (e: number) => { const pp = e * 100; return pp <= -5 ? 0 : pp < 0 ? 1 : pp < 5 ? 2 : pp < 10 ? 3 : 4; };
export const clashBucket = (e: number) => { const pp = Math.abs(e) * 100; return pp < 5 ? 0 : pp < 10 ? 1 : 2; };
