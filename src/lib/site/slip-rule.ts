// ============================================================================
// KUPONUM — kullanıcı kuponu kuralı (saf, testli) · slip-1.0 (2026-10-17)
// ----------------------------------------------------------------------------
// Üye, maç sayfasındaki pazar satırlarından ("Üst 2,5", "KG Var", "1/X/2") seçim
// ekleyip kendi kuponunu derler. Günün kuponundan (coupon-rule.ts, sunucu üretir)
// AYRIDIR: burada seçim kullanıcınındır, sunucu hiçbir şey önermez. Kupon istemcide
// (localStorage) durur; sonuçlar skor API'sinden bacak bazında eşlenir.
// Kurallar: aynı maçtan tek bacak (yenisi eskisini değiştirir), en çok MAX_LEGS,
// başlamış maç eklenmez. Toplam oran yalnız her bacağın oranı varsa; olasılık
// çarpımı bağımsızlık varsayımıyla "model tahmini"dir, garanti değildir.
// ============================================================================

export const SLIP_RULE_VERSION = 'slip-1.0';
export const SLIP_STORAGE_KEY = 'fa.slip.v1';
export const MAX_LEGS = 10;

export type SlipMarket = '1x2' | 'ou25' | 'btts';
export type SlipSelection = '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no';

export interface SlipLeg {
  fixtureId: number;
  kickoff: string;
  leagueLabel: string;
  homeName: string;
  awayName: string;
  market: SlipMarket;
  selection: SlipSelection;
  /** eklendiği anda gösterilen model olasılığı (0–1) */
  p: number;
  /** eklendiği anda gösterilen bahisçi ondalık oranı; yoksa null */
  odds: number | null;
  addedAt: string;
}

export interface SlipResult { homeScore: number | null; awayScore: number | null; settled: boolean; status: string }

export const legKey = (l: Pick<SlipLeg, 'fixtureId' | 'market' | 'selection'>) => `${l.fixtureId}:${l.market}:${l.selection}`;

const VALID_SEL: Record<SlipMarket, SlipSelection[]> = { '1x2': ['1', 'X', '2'], ou25: ['over', 'under'], btts: ['yes', 'no'] };

export function isValidLeg(x: unknown): x is SlipLeg {
  if (!x || typeof x !== 'object') return false;
  const l = x as Record<string, unknown>;
  return Number.isInteger(l.fixtureId) && (l.fixtureId as number) > 0
    && typeof l.kickoff === 'string' && Number.isFinite(Date.parse(l.kickoff))
    && typeof l.homeName === 'string' && typeof l.awayName === 'string' && typeof l.leagueLabel === 'string'
    && typeof l.market === 'string' && (l.market in VALID_SEL)
    && typeof l.selection === 'string' && VALID_SEL[l.market as SlipMarket].includes(l.selection as SlipSelection)
    && typeof l.p === 'number' && l.p >= 0 && l.p <= 1
    && (l.odds === null || (typeof l.odds === 'number' && l.odds > 1))
    && typeof l.addedAt === 'string';
}

/** localStorage içeriğini güvenle okur: bozuk/eski kayıt → boş. */
export function parseStoredSlip(raw: string | null | undefined): SlipLeg[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    const legs: unknown[] = Array.isArray(v) ? v : Array.isArray(v?.legs) ? v.legs : [];
    const out: SlipLeg[] = [];
    const seen = new Set<number>();
    for (const l of legs) { if (isValidLeg(l) && !seen.has(l.fixtureId)) { seen.add(l.fixtureId); out.push(l); } }
    return out.slice(0, MAX_LEGS);
  } catch { return []; }
}

export function serializeSlip(legs: SlipLeg[]): string { return JSON.stringify({ v: SLIP_RULE_VERSION, legs }); }

export type AddOutcome = 'added' | 'replaced' | 'removed' | 'full' | 'started';

/**
 * Aynı seçim tekrar eklenirse çıkarılır (toggle); aynı maçın başka seçimi eskisini değiştirir;
 * başlamış maç eklenmez; dolu kupona yeni maç girmez.
 */
export function toggleLeg(legs: SlipLeg[], leg: SlipLeg, now = Date.now()): { legs: SlipLeg[]; outcome: AddOutcome } {
  const same = legs.find((l) => l.fixtureId === leg.fixtureId);
  if (same && same.market === leg.market && same.selection === leg.selection) return { legs: legs.filter((l) => l.fixtureId !== leg.fixtureId), outcome: 'removed' };
  if (Date.parse(leg.kickoff) <= now) return { legs, outcome: 'started' };
  if (same) return { legs: legs.map((l) => (l.fixtureId === leg.fixtureId ? leg : l)), outcome: 'replaced' };
  if (legs.length >= MAX_LEGS) return { legs, outcome: 'full' };
  return { legs: [...legs, leg], outcome: 'added' };
}

export const removeLeg = (legs: SlipLeg[], fixtureId: number) => legs.filter((l) => l.fixtureId !== fixtureId);

export function hasLeg(legs: SlipLeg[], leg: Pick<SlipLeg, 'fixtureId' | 'market' | 'selection'>): boolean {
  return legs.some((l) => l.fixtureId === leg.fixtureId && l.market === leg.market && l.selection === leg.selection);
}

export interface SlipTotals {
  n: number;
  /** her bacağın oranı varsa çarpım; yoksa null */
  totalOdds: number | null;
  missingOdds: number;
  /** model olasılıkları çarpımı (bağımsızlık varsayımı) */
  jointP: number;
  /** ilk başlayan maç */
  firstKickoff: string | null;
}

export function slipTotals(legs: SlipLeg[]): SlipTotals {
  const missingOdds = legs.filter((l) => l.odds == null).length;
  const totalOdds = legs.length && !missingOdds ? Math.round(legs.reduce((a, l) => a * (l.odds as number), 1) * 100) / 100 : null;
  const jointP = legs.length ? legs.reduce((a, l) => a * l.p, 1) : 0;
  const kos = legs.map((l) => l.kickoff).sort();
  return { n: legs.length, totalOdds, missingOdds, jointP, firstKickoff: kos[0] ?? null };
}

/** Bacak sonucu: skor yoksa null. */
export function legHit(leg: Pick<SlipLeg, 'market' | 'selection'>, r: SlipResult | null | undefined): boolean | null {
  if (!r || r.homeScore == null || r.awayScore == null || !r.settled) return null;
  const h = r.homeScore, a = r.awayScore;
  switch (leg.selection) {
    case '1': return h > a; case 'X': return h === a; case '2': return h < a;
    case 'over': return h + a >= 3; case 'under': return h + a < 3;
    case 'yes': return h > 0 && a > 0; case 'no': return !(h > 0 && a > 0);
  }
}

export type SlipStatus = 'pending' | 'won' | 'lost' | 'empty';

/** Kupon durumu: bir bacak kaybettiyse kaybetti; hepsi tuttuysa tuttu; aksi hâlde bekliyor. */
export function slipStatus(legs: SlipLeg[], results: Record<number, SlipResult | undefined>): SlipStatus {
  if (!legs.length) return 'empty';
  const hits = legs.map((l) => legHit(l, results[l.fixtureId]));
  if (hits.some((h) => h === false)) return 'lost';
  if (hits.every((h) => h === true)) return 'won';
  return 'pending';
}

/** Paylaşım metni; etiketler çağırandan (i18n). */
export function slipText(legs: SlipLeg[], label: (l: SlipLeg) => string, fmt: { time: (iso: string) => string; odds: (o: number) => string; pct: (p: number) => string; title: string; total: string; note: string }): string {
  const t = slipTotals(legs);
  const lines = legs.map((l) => `${fmt.time(l.kickoff)} ${l.homeName} – ${l.awayName}: ${label(l)} · ${fmt.pct(l.p)}${l.odds != null ? ` · ${fmt.odds(l.odds)}` : ''}`);
  const total = t.totalOdds != null ? `${fmt.total} ${fmt.odds(t.totalOdds)}` : null;
  return [fmt.title, ...lines, total, fmt.note].filter(Boolean).join('\n');
}
