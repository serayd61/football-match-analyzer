// ============================================================================
// Checkout kurtarma maili — alıcı seçimi (saf, test edilir).
// ----------------------------------------------------------------------------
// Tarihçe: 2026-11-04'te tek seferlik backfill olarak doğdu (13 Eki–4 Kas
// arası 11 kişi checkout'u ödemeden kapattı; aynı gün PayPal/Google Pay +
// PRO50 geldi, "artık PayPal var" maili atıldı — log'da 'checkout-recovery-
// 2026-11' anahtarıyla durur). 2026-11-10'dan beri günlük cron: kayan pencere
// içinde SÜRESİ DOLMUŞ (expired) + unpaid oturumlar evergreen anahtarla bir
// kez mail alır.
// Kaynak: Stripe checkout.sessions. Hariç: aynı pencerede tamamlanmış oturumu
// olan, DB'de aktif abone, unsubscribe, daha önce alan (status='sent').
// ============================================================================

/** Evergreen anahtar: adres başına EN FAZLA bir kurtarma maili (cron dönemi). */
export const CHECKOUT_RECOVERY_KEY = 'checkout-recovery';

export interface RecoverySession {
  email: string | null;
  status: 'open' | 'complete' | 'expired' | string;
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required' | string;
  /** unix seconds */
  created: number;
}
export interface RecoveryRecipient { email: string; attempts: number; lastAttempt: string }

export function selectRecoveryRecipients(
  sessions: RecoverySession[],
  opts: {
    unsubscribed?: Set<string>;
    alreadySent?: Set<string>;
    subscribed?: Set<string>;
    exclude?: Set<string>;
    /**
     * Yalnız status='expired' oturumları say. Günlük cron'da ŞART: 'open'
     * oturum hâlâ tamamlanabilir (24 saat geçerli) — checkout'un ortasındaki
     * birine "ödemen yarım kaldı" maili gitmesin.
     */
    onlyExpired?: boolean;
  } = {},
): RecoveryRecipient[] {
  const paid = new Set<string>();
  const tries = new Map<string, { n: number; last: number }>();
  for (const s of sessions) {
    const email = (s.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (s.status === 'complete' || s.paymentStatus === 'paid') { paid.add(email); continue; }
    if (s.paymentStatus !== 'unpaid') continue;
    if (opts.onlyExpired && s.status !== 'expired') continue;
    const t = tries.get(email) || { n: 0, last: 0 };
    t.n += 1; t.last = Math.max(t.last, s.created);
    tries.set(email, t);
  }
  const out: RecoveryRecipient[] = [];
  for (const [email, t] of tries) {
    if (paid.has(email)) continue;
    if (opts.unsubscribed?.has(email) || opts.alreadySent?.has(email) || opts.subscribed?.has(email) || opts.exclude?.has(email)) continue;
    out.push({ email, attempts: t.n, lastAttempt: new Date(t.last * 1000).toISOString() });
  }
  // En çok deneyen önce: canary/limit ile ilk partide en sıcak adaylar gider.
  return out.sort((a, b) => b.attempts - a.attempts || b.lastAttempt.localeCompare(a.lastAttempt));
}
