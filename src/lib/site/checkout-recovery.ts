// ============================================================================
// Checkout kurtarma maili — alıcı seçimi (saf, test edilir). 2026-11-04
// ----------------------------------------------------------------------------
// Neden: 13 Eki–4 Kas arası Stripe Checkout'u açan 11 kişinin hepsi ödemeden
// kapandı (kart yok / uluslararası işleme kapalı kart). Aynı gün PayPal +
// Google Pay açıldı, yıllık $49 ve PRO50 (%50, 3 ay) geldi. Bu kişilere tek
// seferlik "artık PayPal var + kod" maili.
// Kaynak: Stripe checkout.sessions (expired/open + unpaid). Hariç: aynı
// pencerede tamamlanmış oturumu olan, DB'de aktif abone, unsubscribe, daha
// önce alan.
// ============================================================================

export const CHECKOUT_RECOVERY_KEY = 'checkout-recovery-2026-11';
/** Fiyat $9.90'a indiği gün: bundan eski oturumlar eski fiyatla açılmıştı. */
export const CHECKOUT_RECOVERY_SINCE = '2026-10-13T00:00:00Z';

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
  opts: { unsubscribed?: Set<string>; alreadySent?: Set<string>; subscribed?: Set<string>; exclude?: Set<string> } = {},
): RecoveryRecipient[] {
  const paid = new Set<string>();
  const tries = new Map<string, { n: number; last: number }>();
  for (const s of sessions) {
    const email = (s.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (s.status === 'complete' || s.paymentStatus === 'paid') { paid.add(email); continue; }
    if (s.paymentStatus !== 'unpaid') continue;
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
