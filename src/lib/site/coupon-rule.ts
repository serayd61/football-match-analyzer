// ============================================================================
// GÜNÜN KUPONU — kural (saf, testli) · duo-1.0 (2026-10-14)
// ----------------------------------------------------------------------------
// Önerilen seçimlerden (best-1.1, site_reco_picks) günde BİR kupon: iki bacak,
// toplam oran 2,0–2,6 bandında, bacak olasılıkları çarpımı en yüksek çift.
// Neden iki bacak ve 2,0–2,6: dondurulmuş oranlı seçimler %65 tutuyor; üç bacak
// (~3,5 oran) 0,65³ ≈ %27 tutar, iki bacak ≈ %42–50. Kupon isabeti + ROI birlikte
// kaydedilir; "yüksek başarı" iddiası kayıt neyse odur.
// Bacak koşulu: gösterilen olasılık ≥ LEG_MIN_P, bahisçi oranı > 1,15, maç başlamamış,
// aynı maçtan tek bacak. Bant dışı: ≥2,6'nın üstünde en düşük toplam; <2,0 → kupon yok.
// ============================================================================

export const COUPON_RULE_VERSION = 'duo-1.0';
export const COUPON_LEGS = 2;
export const TARGET_MIN = 2.0;
export const TARGET_MAX = 2.6;
export const LEG_MIN_P = 0.60;
export const LEG_MIN_ODDS = 1.15;

export type CouponMarket = '1x2' | 'ou25' | 'btts';
export type CouponSelection = '1' | '2' | 'over' | 'under' | 'yes';
export type CouponStatus = 'pending' | 'won' | 'lost' | 'void';

export interface CouponLeg {
  fixtureId: number;
  kickoff: string;
  leagueLabel: string;
  homeName: string;
  awayName: string;
  market: CouponMarket;
  selection: CouponSelection;
  /** gösterilen (kalibre/harman) olasılık */
  p: number;
  /** bahisçi ondalık oranı (marjlı) */
  odds: number;
  /** sonuçlanınca */
  homeScore?: number | null;
  awayScore?: number | null;
  won?: boolean | null;
}

export interface Coupon { legs: CouponLeg[]; totalOdds: number; pJoint: number }

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Adaylardan günün kuponu; uygun çift yoksa null. */
export function selectCoupon(cands: CouponLeg[], now: number | Date = Date.now()): Coupon | null {
  const t = typeof now === 'number' ? now : now.getTime();
  const seen = new Set<number>();
  const legs = cands
    .filter((c) => c.p >= LEG_MIN_P && c.odds > LEG_MIN_ODDS && Number.isFinite(c.odds) && new Date(c.kickoff).getTime() > t)
    .sort((a, b) => b.p - a.p)
    .filter((c) => (seen.has(c.fixtureId) ? false : (seen.add(c.fixtureId), true)));
  let best: Coupon | null = null, fallback: Coupon | null = null;
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const total = r2(legs[i].odds * legs[j].odds);
      if (total < TARGET_MIN) continue;
      const c: Coupon = { legs: [legs[i], legs[j]], totalOdds: total, pJoint: legs[i].p * legs[j].p };
      if (total <= TARGET_MAX) { if (!best || c.pJoint > best.pJoint) best = c; }
      else if (!fallback || total < fallback.totalOdds || (total === fallback.totalOdds && c.pJoint > fallback.pJoint)) fallback = c;
    }
  }
  const out = best ?? fallback;
  if (!out) return null;
  out.legs.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return out;
}

export function settleLeg(market: CouponMarket, selection: CouponSelection, h: number, a: number): boolean {
  if (market === 'ou25') return selection === 'over' ? h + a > 2.5 : h + a < 2.5;
  if (market === 'btts') return h > 0 && a > 0;
  return (h > a ? '1' : a > h ? '2' : 'X') === selection;
}

/** scores: fixtureId → [h, a] | null (null = maç iptal/ertelendi, skor gelmeyecek). */
export function settleCoupon(legs: CouponLeg[], scores: Map<number, [number, number] | null>): { status: CouponStatus; legs: CouponLeg[] } {
  const out = legs.map((l) => {
    if (!scores.has(l.fixtureId)) return { ...l, won: null };
    const sc = scores.get(l.fixtureId);
    if (sc == null) return { ...l, homeScore: null, awayScore: null, won: null };
    return { ...l, homeScore: sc[0], awayScore: sc[1], won: settleLeg(l.market, l.selection, sc[0], sc[1]) };
  });
  if (out.some((l) => l.won === false)) return { status: 'lost', legs: out };
  if (out.some((l) => scores.has(l.fixtureId) && scores.get(l.fixtureId) == null)) return { status: 'void', legs: out };
  if (out.every((l) => l.won === true)) return { status: 'won', legs: out };
  return { status: 'pending', legs: out };
}

export interface CouponTally { n: number; won: number; lost: number; voided: number; pending: number; stake: number; ret: number; legsN: number; legsWon: number }
export const emptyCouponTally = (): CouponTally => ({ n: 0, won: 0, lost: 0, voided: 0, pending: 0, stake: 0, ret: 0, legsN: 0, legsWon: 0 });

/** 1 birim sabit bahis; void iade, pending sayılmaz. */
export function addCoupon(t: CouponTally, status: CouponStatus, totalOdds: number, legs: CouponLeg[]): CouponTally {
  if (status === 'pending') { t.pending++; return t; }
  if (status === 'void') { t.voided++; return t; }
  t.n++; t.stake++;
  if (status === 'won') { t.won++; t.ret += totalOdds; } else t.lost++;
  for (const l of legs) if (l.won != null) { t.legsN++; if (l.won) t.legsWon++; }
  return t;
}
export const couponHit = (t: CouponTally) => (t.n ? t.won / t.n : null);
export const couponRoi = (t: CouponTally) => (t.stake ? (t.ret - t.stake) / t.stake : null);

// ---- Telegram / sosyal metin -------------------------------------------------
export type CouponLang = 'tr' | 'en';
const TZ: Record<CouponLang, string> = { tr: 'Europe/Istanbul', en: 'Europe/London' };
const fmtTime = (iso: string, lang: CouponLang) => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ[lang] }).format(new Date(iso));
const fmtDate = (ymd: string, lang: CouponLang) => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`));
const fmtOdds = (o: number, lang: CouponLang) => (lang === 'tr' ? o.toFixed(2).replace('.', ',') : o.toFixed(2));
const pct = (p: number) => `${Math.round(p * 100)}%`;

export function legLabel(l: Pick<CouponLeg, 'market' | 'selection' | 'homeName' | 'awayName'>, lang: CouponLang): string {
  if (l.market === '1x2') return l.selection === '1' ? l.homeName : l.awayName;
  if (l.market === 'ou25') return l.selection === 'over' ? (lang === 'tr' ? 'Üst 2,5' : 'Over 2.5') : (lang === 'tr' ? 'Alt 2,5' : 'Under 2.5');
  return lang === 'tr' ? 'KG Var' : 'BTTS Yes';
}

export function couponText(c: Coupon, ymd: string, lang: CouponLang, record: CouponTally | null, link: string): string {
  const tzl = lang === 'tr' ? 'TSİ' : 'UK time';
  const head = lang === 'tr' ? `Günün kuponu · ${fmtDate(ymd, lang)} · ${tzl}` : `Coupon of the day · ${fmtDate(ymd, lang)} · ${tzl}`;
  const lines = c.legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${legLabel(l, lang)} · ${pct(l.p)} · ${fmtOdds(l.odds, lang)}`);
  const total = lang === 'tr' ? `Toplam oran ${fmtOdds(c.totalOdds, lang)}` : `Total odds ${fmtOdds(c.totalOdds, lang)}`;
  const rec = record && record.n
    ? (lang === 'tr' ? `Son 30 gün: ${record.won}/${record.n} kupon tuttu · ROI ${roiText(record, lang)}` : `Last 30 days: ${record.won}/${record.n} coupons hit · ROI ${roiText(record, lang)}`)
    : (lang === 'tr' ? 'Kayıt yeni başladı; her kupon, tutsun tutmasın, burada sonuçlanır.' : 'Record just started; every coupon, hit or miss, is settled here.');
  return [head, '', ...lines, '', total, rec, link].join('\n');
}

export function roiText(t: CouponTally, lang: CouponLang): string {
  const r = couponRoi(t);
  if (r == null) return '–';
  const n = Math.round(r * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
}

export function couponResultText(c: { legs: CouponLeg[]; totalOdds: number; status: CouponStatus }, ymd: string, lang: CouponLang, record: CouponTally | null): string {
  const mark = c.status === 'won' ? '✓' : c.status === 'lost' ? '✗' : '–';
  const head = lang === 'tr' ? `Kupon sonucu · ${fmtDate(ymd, lang)} ${mark}` : `Coupon result · ${fmtDate(ymd, lang)} ${mark}`;
  const lines = c.legs.map((l) => `${l.homeName} ${l.homeScore ?? '?'}-${l.awayScore ?? '?'} ${l.awayName} · ${legLabel(l, lang)} ${l.won == null ? '–' : l.won ? '✓' : '✗'}`);
  const verdict = c.status === 'won'
    ? (lang === 'tr' ? `Tuttu · ${fmtOdds(c.totalOdds, lang)}` : `Hit · ${fmtOdds(c.totalOdds, lang)}`)
    : c.status === 'lost' ? (lang === 'tr' ? 'Tutmadı' : 'Missed') : (lang === 'tr' ? 'İptal (maç oynanmadı)' : 'Void (match not played)');
  const rec = record && record.n ? (lang === 'tr' ? `Son 30 gün: ${record.won}/${record.n} · ROI ${roiText(record, lang)}` : `Last 30 days: ${record.won}/${record.n} · ROI ${roiText(record, lang)}`) : '';
  return [head, '', ...lines, '', verdict, rec].filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\n').trim();
}
