// ============================================================================
// KUPON PAYLAŞIMI — kısa bağlantı kodu (saf, testli) · slip-1.3 (2026-10-17)
// ----------------------------------------------------------------------------
// Kupon istemcide durur; paylaşmak için bacaklar URL'ye kodlanır: /{locale}/s/{code}.
// Takım adı, lig, saat ve skor sayfada veritabanından okunur (fixtureId yeter), bu yüzden
// kod kısadır: `v1~<fid>_<pazar+seçim>[_l<çizgi>]_p<yüzde>[_o<oran>]~…` (en çok MAX_LEGS bacak).
// Örnek: v1~5103665_m1_p72_o1.90~5103665_oo_p70  → Botafogo (1X2 ev) %72 @1.90 + Üst 2,5 %70.
// Yalnız [0-9A-Za-z._~-] kullanılır; WhatsApp/Telegram bağlantıyı bölmeden algılar.
// ============================================================================

import { MAX_LEGS, type SlipLeg, type SlipMarket, type SlipSelection } from './slip-rule';

export const SHARE_VERSION = 'v1';
export const SHARE_PATH = '/s';

export type SharedLeg = Pick<SlipLeg, 'fixtureId' | 'market' | 'selection' | 'line' | 'p' | 'odds'>;

const M: Record<SlipMarket, string> = { '1x2': 'm', ou25: 'o', btts: 'b', ah: 'h', dnb: 'd' };
const S: Record<SlipSelection, string> = { '1': '1', X: 'X', '2': '2', over: 'o', under: 'u', yes: 'y', no: 'n', home: 'h', away: 'a' };
const M_INV = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k])) as Record<string, SlipMarket>;
const S_INV = Object.fromEntries(Object.entries(S).map(([k, v]) => [v, k])) as Record<string, SlipSelection>;
const VALID: Record<SlipMarket, SlipSelection[]> = { '1x2': ['1', 'X', '2'], ou25: ['over', 'under'], btts: ['yes', 'no'], ah: ['home', 'away'], dnb: ['home', 'away'] };

export function encodeSlip(legs: SharedLeg[]): string {
  const parts = legs.slice(0, MAX_LEGS).map((l) => {
    const f = [`${l.fixtureId}`, `${M[l.market]}${S[l.selection]}`];
    if (l.market === 'ah') f.push(`l${l.line ?? 0}`);
    f.push(`p${Math.round(l.p * 100)}`);
    if (l.odds != null) f.push(`o${l.odds.toFixed(2)}`);
    return f.join('_');
  });
  return [SHARE_VERSION, ...parts].join('~');
}

/** Geçersiz kod → boş dizi; geçersiz bacaklar atlanır; aynı maç+pazar yinelenirse ilki kalır. */
export function decodeSlip(code: string | null | undefined): SharedLeg[] {
  if (!code || !/^[0-9A-Za-z._~-]{3,2000}$/.test(code)) return [];
  const [ver, ...parts] = code.split('~');
  if (ver !== SHARE_VERSION) return [];
  const out: SharedLeg[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const f = part.split('_');
    const fixtureId = Number(f[0]);
    const ms = f[1] || '';
    const market = M_INV[ms[0]], selection = S_INV[ms.slice(1)];
    if (!Number.isInteger(fixtureId) || fixtureId <= 0 || !market || !selection || !VALID[market].includes(selection)) continue;
    let line: number | undefined, p: number | null = null, odds: number | null = null;
    for (const x of f.slice(2)) {
      const v = Number(x.slice(1));
      if (!Number.isFinite(v)) continue;
      if (x[0] === 'l') line = v; else if (x[0] === 'p') p = v / 100; else if (x[0] === 'o') odds = v;
    }
    if (p == null || p < 0 || p > 1) continue;
    if (market === 'ah') { if (line == null || Math.abs(line) > 4 || Math.abs(line * 4 - Math.round(line * 4)) > 1e-9) continue; } else line = undefined;
    if (odds != null && odds <= 1) odds = null;
    const slot = `${fixtureId}:${market}`;
    if (seen.has(slot)) continue;
    seen.add(slot);
    out.push({ fixtureId, market, selection, ...(line != null ? { line } : {}), p, odds });
    if (out.length >= MAX_LEGS) break;
  }
  return out;
}

export const sharePath = (locale: string, legs: SharedLeg[]) => `/${locale}${SHARE_PATH}/${encodeSlip(legs)}`;
