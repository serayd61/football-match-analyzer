// ============================================================================
// ÖNERİLEN SEÇİM — kural best-1.0 (saf, testli)
// ----------------------------------------------------------------------------
// Neden (5 Eki, kullanıcı): "%35 '1' dedi, maç 2 bitti → tutmadı" ölçüsü
// sistemi yanlış ölçüyor; sistem o maçta 1X2'de zaten net değil. Her maç için
// sistemin en emin olduğu pazar seçilmeli, karne de onunla tutulmalı.
//
// Kural: adaylar 1X2 favorisi, Üst/Alt 2.5, KG Var/Yok (çifte şans aday DEĞİL —
// hemen her maçta ~%80, hep o kazanırdı). Her adayın "dürüst olasılığı" ham
// model değeri değil, aynı durumdaki geçmiş maçların isabetidir:
//   genel kova (pazar × taraf × 5 puanlık dilim) → ham p'ye doğru büzülür,
//   lig kovası → genel kovaya doğru büzülür (az örnekli ligde genel baskın).
// Seçim: q ≥ minQ ve (gol pazarlarında) q − taban oran ≥ minLift olan adaylar
// arasında en yüksek q. Hiçbiri geçmezse "net seçim yok".
// Neden ham p değil (90g ölçüm): Ü/A seçildiğinde ham %68.8 → gerçek %57.9,
// KG %61.1 → %57.3; ham p ile seçilirse şişik pazar hep öne çıkar.
// ============================================================================

export const RECO_RULE_VERSION = 'best-1.0';

export type RecoMarket = '1x2' | 'ou25' | 'btts';
export type RecoSelection = '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no';

/** Marjsız piyasa olasılıkları (varsa). 1X2 üçlüsü toplamı 1; gol pazarları "Üst"/"Var" tarafı. */
export interface RecoMarketInput {
  pHome?: number | null; pDraw?: number | null; pAway?: number | null;
  pOver25?: number | null;
  pBttsYes?: number | null;
}

export interface RecoInput {
  leagueId: number | null;
  pHome: number | null; pDraw: number | null; pAway: number | null;
  pOver25: number | null;
  pBttsYes: number | null;
  /** oran varsa (kapsanan ligler): model %30 + piyasa %70 harmanı adayın güvendiği p olur */
  market?: RecoMarketInput | null;
}

/** Piyasa ağırlığı — lib/odds/blend.ts DEFAULT_MARKET_WEIGHT ve goal-blend ile aynı (backtest 2026-09-20). */
export const RECO_MARKET_WEIGHT = 0.7;

export interface RecoCandidate {
  market: RecoMarket;
  selection: RecoSelection;
  /** modelin ham olasılığı (seçilen taraf) */
  pRaw: number;
  /** kuralın güvendiği olasılık: oran varsa harman, yoksa ham */
  p: number;
  /** piyasa harmanı uygulandı mı */
  blended: boolean;
  /** kova anahtarı: [mkt|]pazar:taraf-sınıfı:dilim — harmanlı adaylar ayrı kovada */
  key: string;
}

/** Önerilemeyen taraflar (180g backtest, 5 Eki): beraberlik n=4 %50 (iddia %91),
 *  KG Yok n=122 %52.5 (iddia %66). Kova sayaçlarına girerler, öneriye girmezler. */
export const RECO_EXCLUDED: ReadonlySet<string> = new Set(['1x2:X', 'btts:no']);

export interface RecoGate {
  minQ: number; minLift: number;
  /** kapı gösterilen olasılığa (RecoMeta) uygulanır — varsayılan true (6 Eki: "≥%60" deyip %59 gösteriliyordu) */
  onDisplay?: boolean;
}
export const RECO_GATE: RecoGate = { minQ: 0.60, minLift: 0.05, onDisplay: true };

/** Büzülme ağırlıkları (sanal örnek sayısı). */
export const K_GLOBAL = 30;
export const K_LEAGUE = 20;

const fin = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);
const BIN = 0.05;
const binOf = (p: number) => Math.min(19, Math.max(0, Math.floor(p / BIN + 1e-9)));

/** 1X2'de ev/deplasman favorisi aynı sınıfta ('fav'), beraberlik ayrı. */
function sideClass(market: RecoMarket, selection: RecoSelection): string {
  if (market === '1x2') return selection === 'X' ? 'draw' : 'fav';
  return selection;
}

export function bucketKey(market: RecoMarket, selection: RecoSelection, p: number, blended = false): string {
  return `${blended ? 'mkt|' : ''}${market}:${sideClass(market, selection)}:${binOf(p)}`;
}

const mix = (model: number, mkt: number | null | undefined, w = RECO_MARKET_WEIGHT) => (fin(mkt) ? (1 - w) * model + w * mkt : model);

/** Her pazarın model (oran varsa harman) tarafı — pazar başına bir aday. */
export function candidatesFor(i: RecoInput): RecoCandidate[] {
  const out: RecoCandidate[] = [];
  const m = i.market ?? null;
  if (fin(i.pHome) && fin(i.pDraw) && fin(i.pAway)) {
    const has = !!m && fin(m.pHome) && fin(m.pDraw) && fin(m.pAway);
    const raw: Array<[RecoSelection, number]> = [['1', i.pHome], ['X', i.pDraw], ['2', i.pAway]];
    const bl: Array<[RecoSelection, number]> = has ? [['1', mix(i.pHome, m!.pHome)], ['X', mix(i.pDraw, m!.pDraw)], ['2', mix(i.pAway, m!.pAway)]] : raw;
    const [sel, p] = bl.reduce((a, b) => (b[1] > a[1] ? b : a));
    const pRaw = raw.find((x) => x[0] === sel)![1];
    out.push({ market: '1x2', selection: sel, pRaw, p, blended: has, key: bucketKey('1x2', sel, p, has) });
  }
  if (fin(i.pOver25)) {
    const has = !!m && fin(m.pOver25);
    const over = has ? mix(i.pOver25, m!.pOver25) : i.pOver25;
    const sel: RecoSelection = over >= 0.5 ? 'over' : 'under';
    const p = sel === 'over' ? over : 1 - over;
    const pRaw = sel === 'over' ? i.pOver25 : 1 - i.pOver25;
    out.push({ market: 'ou25', selection: sel, pRaw, p, blended: has, key: bucketKey('ou25', sel, p, has) });
  }
  if (fin(i.pBttsYes)) {
    const has = !!m && fin(m.pBttsYes);
    const yes = has ? mix(i.pBttsYes, m!.pBttsYes) : i.pBttsYes;
    const sel: RecoSelection = yes >= 0.5 ? 'yes' : 'no';
    const p = sel === 'yes' ? yes : 1 - yes;
    const pRaw = sel === 'yes' ? i.pBttsYes : 1 - i.pBttsYes;
    out.push({ market: 'btts', selection: sel, pRaw, p, blended: has, key: bucketKey('btts', sel, p, has) });
  }
  return out;
}

export function settleReco(market: RecoMarket, selection: RecoSelection, h: number, a: number): boolean {
  if (market === 'ou25') return selection === 'over' ? h + a > 2.5 : h + a < 2.5;
  if (market === 'btts') return (h > 0 && a > 0) === (selection === 'yes');
  return (h > a ? '1' : a > h ? '2' : 'X') === selection;
}

interface Cell { n: number; won: number }
const shrink = (c: Cell | undefined, prior: number, k: number) => (c && c.n ? (c.won + k * prior) / (c.n + k) : prior);

/** Geçmiş maçlardan öğrenilen kova ve taban oran sayaçları (yalnız ileriye dönük beslenir). */
export interface RecoStatsOpts { kGlobal: number; kLeague: number }

export class RecoStats {
  constructor(readonly opts: RecoStatsOpts = { kGlobal: K_GLOBAL, kLeague: K_LEAGUE }) {}
  readonly global = new Map<string, Cell>();
  readonly league = new Map<string, Cell>();
  readonly base = new Map<string, Cell>();

  private bump(m: Map<string, Cell>, k: string, won: boolean) {
    const c = m.get(k) ?? { n: 0, won: 0 };
    c.n++; if (won) c.won++;
    m.set(k, c);
  }

  /** Sonuçlanmış bir maçı sayaçlara ekler. */
  add(i: RecoInput, h: number, a: number): void {
    for (const c of candidatesFor(i)) {
      const won = settleReco(c.market, c.selection, h, a);
      this.bump(this.global, c.key, won);
      if (i.leagueId != null) this.bump(this.league, `${i.leagueId}|${c.key}`, won);
    }
    // Taban oran: modelden bağımsız, her maçta her gol tarafı.
    for (const sel of ['over', 'under'] as const) this.bump(this.base, `ou25:${sel}`, settleReco('ou25', sel, h, a));
    for (const sel of ['yes', 'no'] as const) this.bump(this.base, `btts:${sel}`, settleReco('btts', sel, h, a));
  }

  /** Dürüst olasılık: genel kova ham p'ye, lig kovası genele büzülür. */
  honestP(c: RecoCandidate, leagueId: number | null): number {
    const g = shrink(this.global.get(c.key), c.p, this.opts.kGlobal);
    return leagueId == null ? g : shrink(this.league.get(`${leagueId}|${c.key}`), g, this.opts.kLeague);
  }

  /** Gol taraflarının taban oranı; 1X2 için null (sabit naif strateji yok, yalnız minQ kapısı). */
  baseRate(market: RecoMarket, selection: RecoSelection): number | null {
    if (market === '1x2') return null;
    const c = this.base.get(`${market}:${selection}`);
    return c && c.n ? c.won / c.n : null;
  }
}

export interface RecoScored extends RecoCandidate { q: number; /** gösterilen olasılık (meta yoksa q) */ pDisplay: number; base: number | null; passes: boolean }
export interface RecoResult { pick: RecoScored | null; candidates: RecoScored[] }

export function recommend(i: RecoInput, stats: RecoStats, gate: RecoGate = RECO_GATE, meta?: RecoMeta | null): RecoResult {
  const candidates = candidatesFor(i).map((c): RecoScored => {
    const q = stats.honestP(c, i.leagueId);
    const pDisplay = meta ? meta.displayP({ market: c.market, selection: c.selection, q }) : q;
    const base = stats.baseRate(c.market, c.selection);
    const g = gate.onDisplay === false ? q : pDisplay;
    const passes = !RECO_EXCLUDED.has(`${c.market}:${c.selection}`) && g >= gate.minQ && (base == null || g - base >= gate.minLift);
    return { ...c, q, pDisplay, base, passes };
  });
  const pick = candidates.filter((c) => c.passes).reduce<RecoScored | null>((best, c) => (!best || c.q > best.q ? c : best), null);
  return { pick, candidates };
}

// ---- Gösterim kalibrasyonu ---------------------------------------------------
// Seçim, adaylar arasında en yüksek q'yu alır → "kazananın laneti": seçilenin q'su
// sistematik olarak iyimser (backtest: iddia %69.0, gerçek %65.1). Gösterilen
// olasılık bu yüzden kuralın KENDİ geçmiş seçimlerinden gelir: (pazar×taraf, q
// dilimi) kaydı → aynı q diliminin havuz kaydına → q'ya büzülür. Seçimi etkilemez.
export const K_META = 50;
const metaBin = (q: number) => Math.min(9, Math.max(0, Math.floor((q - 0.5) / 0.05)));

export class RecoMeta {
  readonly pooled = new Map<number, Cell>();
  readonly byMarket = new Map<string, Cell>();
  constructor(readonly k = K_META) {}

  private keys(p: { market: RecoMarket; selection: RecoSelection; q: number }) {
    const b = metaBin(p.q);
    return { b, mk: `${p.market}:${p.selection}|${b}` };
  }

  /** Gösterilecek olasılık. */
  displayP(p: { market: RecoMarket; selection: RecoSelection; q: number }): number {
    const { b, mk } = this.keys(p);
    const pooled = shrink(this.pooled.get(b), p.q, this.k);
    return shrink(this.byMarket.get(mk), pooled, this.k);
  }

  /** Sonuçlanmış bir önerilen seçimi kayda ekler. */
  add(p: { market: RecoMarket; selection: RecoSelection; q: number }, won: boolean): void {
    const { b, mk } = this.keys(p);
    for (const [m, k] of [[this.pooled, b], [this.byMarket, mk]] as const) {
      const c = (m as Map<any, Cell>).get(k) ?? { n: 0, won: 0 };
      c.n++; if (won) c.won++;
      (m as Map<any, Cell>).set(k, c);
    }
  }
}

// ---- Geçmişten model kurulumu (walk-forward, backtest ile aynı sıra) ---------
// Her UTC günü: önce o günün maçlarına seçim yapılır (yalnız önceki günlerle),
// sonra o günün sonuçları kova sayaçlarına, seçimlerin sonucu RecoMeta'ya eklenir.
// İlk burnInDays gün seçimleri meta'ya girmez (sayaçlar henüz boş).
export interface RecoHistoryRow extends RecoInput { kickoff: string; h: number; a: number }
export interface RecoModel { stats: RecoStats; meta: RecoMeta; days: number; rows: number; metaPicks: number }

export function buildRecoModel(rows: RecoHistoryRow[], gate: RecoGate = RECO_GATE, burnInDays = 30): RecoModel {
  const stats = new RecoStats();
  const meta = new RecoMeta();
  const byDay = new Map<string, RecoHistoryRow[]>();
  for (const r of rows) {
    const d = r.kickoff.slice(0, 10);
    const list = byDay.get(d);
    if (list) list.push(r); else byDay.set(d, [r]);
  }
  const days = [...byDay.keys()].sort();
  const start = days.length ? new Date(Date.parse(days[0]) + burnInDays * 86_400_000).toISOString().slice(0, 10) : '';
  let metaPicks = 0;
  for (const d of days) {
    const today = byDay.get(d)!;
    const done: Array<[RecoScored, boolean]> = [];
    if (d >= start) {
      for (const r of today) {
        const { pick } = recommend(r, stats, gate, meta);
        if (pick) done.push([pick, settleReco(pick.market, pick.selection, r.h, r.a)]);
      }
    }
    for (const r of today) stats.add(r, r.h, r.a);
    for (const [p, won] of done) meta.add(p, won);
    metaPicks += done.length;
  }
  return { stats, meta, days: days.length, rows: rows.length, metaPicks };
}
