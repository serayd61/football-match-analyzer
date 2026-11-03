// ---------------------------------------------------------------------------
// Gün şeridi kuralı (overview-1.0, 2026-11-03). Saf: sunucu/istemci/test ortak.
//
// Kullanıcı geri bildirimi: "yalnızca 1–2 Kasım analizlerini görebiliyorum,
// yarınki maçları bulamadım". Tahmin listesi tek güne bakıyordu ve hangi
// günlerde veri olduğu hiçbir yerde görünmüyordu. Şerit dün + bugün + 5 gün
// ilerisini sayılarıyla gösterir; ufuk (verisi olan son gün) ve "bu günün
// tahminleri ne zaman gelir" notu buradan türetilir.
//
// Motor penceresi: Hetzner engine-sync saat başı D, D+1, D+2 maçlarını
// puanlar (engine-sync.py DAYS_AHEAD=2) → bir gün en erken maç gününe 2 gün
// kala dolar. PUBLISH_LEAD_DAYS bu sözleşmeyi taşır; motor penceresi
// değişirse yalnız bu sabit değişir.
// ---------------------------------------------------------------------------
import { addDays } from './time';

export const STRIP_PAST_DAYS = 1;
export const STRIP_FUTURE_DAYS = 5;
/** Bir maç gününün tahminleri en geç kaç gün önce yayımlanır. */
export const PUBLISH_LEAD_DAYS = 2;

export interface DayCount {
  date: string;
  /** kapsanan liglerde resmi sürüm tahmini olan maç sayısı */
  covered: number;
}

/** Şeridin günleri: bugün − STRIP_PAST_DAYS … bugün + STRIP_FUTURE_DAYS, ardışık. */
export function stripDays(today: string, past = STRIP_PAST_DAYS, future = STRIP_FUTURE_DAYS): string[] {
  const out: string[] = [];
  for (let i = -past; i <= future; i++) out.push(addDays(today, i));
  return out;
}

/** Bugünden itibaren tahmini olan SON gün; hiç yoksa null. */
export function horizonOf(counts: DayCount[], today: string): string | null {
  let last: string | null = null;
  for (const c of counts) if (c.date >= today && c.covered > 0 && (!last || c.date > last)) last = c.date;
  return last;
}

/** Ufkun ötesindeki bir gün için tahminlerin ekleneceği en geç gün. */
export function publishDayFor(date: string): string {
  return addDays(date, -PUBLISH_LEAD_DAYS);
}

/**
 * Boş bir gün için hangi açıklamanın doğru olduğu:
 *  - 'past'    → geçmiş gün, kapsamda maç olmamış
 *  - 'pending' → gelecekte ve ufkun ötesinde: tahminler publishDayFor(date) itibarıyla gelir
 *  - 'none'    → ufuk içinde ama kapsamda maç yok (ara hafta / milli ara)
 */
export function emptyReason(date: string, today: string, horizon: string | null): 'past' | 'pending' | 'none' {
  if (date < today) return 'past';
  if (date > addDays(today, PUBLISH_LEAD_DAYS) && (!horizon || date > horizon)) return 'pending';
  return 'none';
}

/** Sonuç filtresi uygulanmış listede sayfa sayısına esas toplam. */
export function shownResultsTotal(outcome: 'won' | 'lost' | null, totals: { total: number; won: number; lost: number }): number {
  return outcome === 'won' ? totals.won : outcome === 'lost' ? totals.lost : totals.total;
}

export function parseOutcome(raw: string | undefined): 'won' | 'lost' | null {
  return raw === 'won' || raw === 'lost' ? raw : null;
}
