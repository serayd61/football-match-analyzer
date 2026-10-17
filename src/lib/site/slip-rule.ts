// ============================================================================
// KUPONUM — kullanıcı kuponu kuralı (saf, testli) · slip-1.0 (2026-10-17)
// ----------------------------------------------------------------------------
// Üye, maç sayfasındaki pazar satırlarından ("Üst 2,5", "KG Var", "1/X/2") seçim
// ekleyip kendi kuponunu derler. Günün kuponundan (coupon-rule.ts, sunucu üretir)
// AYRIDIR: burada seçim kullanıcınındır, sunucu hiçbir şey önermez. Kupon istemcide
// (localStorage) durur; sonuçlar skor API'sinden bacak bazında eşlenir.
// Kurallar (slip-1.2, 2026-10-17): aynı maçtan birden çok pazar seçilebilir (1 + Üst 2,5 + KG);
// aynı maçın aynı pazarında yenisi eskisini değiştirir. En çok MAX_LEGS bacak, başlamış maç eklenmez. Toplam oran yalnız her bacağın oranı varsa; olasılık
// çarpımı bağımsızlık varsayımıyla "model tahmini"dir, garanti değildir.
// ============================================================================

export const SLIP_RULE_VERSION = 'slip-1.0';
export const SLIP_STORAGE_KEY = 'fa.slip.v1';
export const MAX_LEGS = 15;

// slip-1.1 (2026-10-17): Asya handikapı ('ah', çizgi ev perspektifinden; +0.5 = ev 0,5 alır) ve
// beraberlikte iade ('dnb') eklendi. Çeyrek çizgi iki yarım bahis gibi sonuçlanır (yarı tuttu / yarı tutmadı).
export type SlipMarket = '1x2' | 'ou25' | 'btts' | 'ah' | 'dnb';
export type SlipSelection = '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no' | 'home' | 'away';

export interface SlipLeg {
  fixtureId: number;
  kickoff: string;
  leagueLabel: string;
  homeName: string;
  awayName: string;
  market: SlipMarket;
  selection: SlipSelection;
  /** yalnız 'ah': handikap çizgisi, ev perspektifinden, 0,25 katı */
  line?: number;
  /** eklendiği anda gösterilen model olasılığı (0–1) */
  p: number;
  /** eklendiği anda gösterilen bahisçi ondalık oranı; yoksa null */
  odds: number | null;
  addedAt: string;
}

export interface SlipResult { homeScore: number | null; awayScore: number | null; settled: boolean; status: string }

export type LegId = Pick<SlipLeg, 'fixtureId' | 'market' | 'selection'> & { line?: number };
export const legKey = (l: LegId) => `${l.fixtureId}:${l.market}:${l.selection}${l.market === 'ah' ? `:${l.line}` : ''}`;
const sameLeg = (a: LegId, b: LegId) => legKey(a) === legKey(b);
/** aynı maçın aynı pazarı (handikapta çizgiden bağımsız): kuponda tek yer tutar */
export const slotKey = (l: Pick<SlipLeg, 'fixtureId' | 'market'>) => `${l.fixtureId}:${l.market}`;

const VALID_SEL: Record<SlipMarket, SlipSelection[]> = { '1x2': ['1', 'X', '2'], ou25: ['over', 'under'], btts: ['yes', 'no'], ah: ['home', 'away'], dnb: ['home', 'away'] };
const validLine = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 4 && Math.abs(x * 4 - Math.round(x * 4)) < 1e-9;

export function isValidLeg(x: unknown): x is SlipLeg {
  if (!x || typeof x !== 'object') return false;
  const l = x as Record<string, unknown>;
  return Number.isInteger(l.fixtureId) && (l.fixtureId as number) > 0
    && typeof l.kickoff === 'string' && Number.isFinite(Date.parse(l.kickoff))
    && typeof l.homeName === 'string' && typeof l.awayName === 'string' && typeof l.leagueLabel === 'string'
    && typeof l.market === 'string' && (l.market in VALID_SEL)
    && typeof l.selection === 'string' && VALID_SEL[l.market as SlipMarket].includes(l.selection as SlipSelection)
    && (l.market === 'ah' ? validLine(l.line) : l.line === undefined)
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
    const seen = new Set<string>();
    for (const l of legs) { if (isValidLeg(l) && !seen.has(slotKey(l))) { seen.add(slotKey(l)); out.push(l); } }
    return out.slice(0, MAX_LEGS);
  } catch { return []; }
}

export function serializeSlip(legs: SlipLeg[]): string { return JSON.stringify({ v: SLIP_RULE_VERSION, legs }); }

export type AddOutcome = 'added' | 'replaced' | 'removed' | 'full' | 'started';

/**
 * Aynı seçim tekrar eklenirse çıkarılır (toggle); aynı maçın aynı pazarındaki başka seçim eskisini
 * değiştirir; aynı maçın başka pazarı ayrı bacak olarak eklenir; başlamış maç eklenmez; dolu kupona yeni bacak girmez.
 */
export function toggleLeg(legs: SlipLeg[], leg: SlipLeg, now = Date.now()): { legs: SlipLeg[]; outcome: AddOutcome } {
  const same = legs.find((l) => slotKey(l) === slotKey(leg));
  if (same && sameLeg(same, leg)) return { legs: legs.filter((l) => !sameLeg(l, leg)), outcome: 'removed' };
  if (Date.parse(leg.kickoff) <= now) return { legs, outcome: 'started' };
  if (same) return { legs: legs.map((l) => (slotKey(l) === slotKey(leg) ? leg : l)), outcome: 'replaced' };
  if (legs.length >= MAX_LEGS) return { legs, outcome: 'full' };
  return { legs: [...legs, leg], outcome: 'added' };
}

/** Tek bacağı çıkarır (legKey ile); yalnız sayı verilirse o maçın tüm bacakları. */
export const removeLeg = (legs: SlipLeg[], id: number | LegId) => (typeof id === 'number' ? legs.filter((l) => l.fixtureId !== id) : legs.filter((l) => !sameLeg(l, id)));

export function hasLeg(legs: SlipLeg[], leg: LegId): boolean {
  return legs.some((l) => sameLeg(l, leg));
}

export interface SlipTotals {
  n: number;
  /** her bacağın oranı varsa çarpım; yoksa null */
  totalOdds: number | null;
  missingOdds: number;
  /** model olasılıkları çarpımı (bağımsızlık varsayımı; aynı maçın bacakları bağımsız değildir) */
  jointP: number;
  /** farklı maç sayısı */
  fixtures: number;
  /** ilk başlayan maç */
  firstKickoff: string | null;
}

export function slipTotals(legs: SlipLeg[]): SlipTotals {
  const missingOdds = legs.filter((l) => l.odds == null).length;
  const totalOdds = legs.length && !missingOdds ? Math.round(legs.reduce((a, l) => a * (l.odds as number), 1) * 100) / 100 : null;
  const jointP = legs.length ? legs.reduce((a, l) => a * l.p, 1) : 0;
  const kos = legs.map((l) => l.kickoff).sort();
  return { n: legs.length, totalOdds, missingOdds, jointP, fixtures: new Set(legs.map((l) => l.fixtureId)).size, firstKickoff: kos[0] ?? null };
}

export type LegOutcome = 'won' | 'lost' | 'void' | 'half_won' | 'half_lost';

/** Yarım çizgi için tek sonuç; ev perspektifinden (d = ev + çizgi − dep). */
const halfLine = (h: number, a: number, line: number): 'won' | 'lost' | 'void' => { const d = h + line - a; return d > 1e-9 ? 'won' : Math.abs(d) < 1e-9 ? 'void' : 'lost'; };
const invert = (o: LegOutcome): LegOutcome => (o === 'won' ? 'lost' : o === 'lost' ? 'won' : o === 'half_won' ? 'half_lost' : o === 'half_lost' ? 'half_won' : 'void');

/** Asya handikapı sonucu (ev perspektifinden); çeyrek çizgi = iki yarım bahis. */
export function asianOutcome(h: number, a: number, line: number): LegOutcome {
  const q = Math.abs(line * 4 - Math.round(line * 4)) < 1e-9 && Math.abs(line * 2 - Math.round(line * 2)) > 1e-9; // x.25 / x.75
  if (!q) return halfLine(h, a, line);
  const [x, y] = [halfLine(h, a, line - 0.25), halfLine(h, a, line + 0.25)];
  const wins = [x, y].filter((o) => o === 'won').length, voids = [x, y].filter((o) => o === 'void').length;
  if (wins === 2) return 'won'; if (wins === 1 && voids === 1) return 'half_won'; if (voids === 2) return 'void';
  if (voids === 1) return 'half_lost'; return 'lost';
}

/** Bacak sonucu; skor yoksa null. */
export function legOutcome(leg: Pick<SlipLeg, 'market' | 'selection' | 'line'>, r: SlipResult | null | undefined): LegOutcome | null {
  if (!r || r.homeScore == null || r.awayScore == null || !r.settled) return null;
  const h = r.homeScore, a = r.awayScore;
  const b = (x: boolean): LegOutcome => (x ? 'won' : 'lost');
  switch (leg.market) {
    case '1x2': return b(leg.selection === '1' ? h > a : leg.selection === 'X' ? h === a : h < a);
    case 'ou25': return b(leg.selection === 'over' ? h + a >= 3 : h + a < 3);
    case 'btts': return b(leg.selection === 'yes' ? h > 0 && a > 0 : !(h > 0 && a > 0));
    case 'dnb': return h === a ? 'void' : b(leg.selection === 'home' ? h > a : h < a);
    case 'ah': { const o = asianOutcome(h, a, leg.line ?? 0); return leg.selection === 'home' ? o : invert(o); }
  }
}

/** Geriye dönük: tuttu (tam/yarı/iade) → true, tutmadı (tam/yarı) → false, skor yoksa null. */
export function legHit(leg: Pick<SlipLeg, 'market' | 'selection' | 'line'>, r: SlipResult | null | undefined): boolean | null {
  const o = legOutcome(leg, r);
  return o == null ? null : o === 'won' || o === 'half_won' || o === 'void';
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
