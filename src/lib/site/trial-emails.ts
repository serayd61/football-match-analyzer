// ============================================================================
// Deneme dönemi e-postaları — alıcı seçimi (saf, test edilir).
// ----------------------------------------------------------------------------
// Neden (2026-09-26): Eylül'de 35 kayıt, 31 deneme bitti, kayıttan sonra geri
// gelen 0, ücretliye geçen 0. Hoşgeldin maili var; ortası ve sonu yok.
//   mid    → kayıttan 2–3 gün sonra: bu haftanın gerçek karnesi + kalan gün
//   ending → deneme bitimine 1–2 gün kala: "yarın kapanıyor" + Pro bağlantısı
// Deneme bitişi profiles.trial_ends_at; yoksa kayıt + 7 gün (access.ts ile aynı).
// Aboneler (active/trialing/past_due), unsubscribe ve daha önce alanlar hariç.
// ============================================================================

export type TrialKind = 'mid' | 'ending';
export const TRIAL_CAMPAIGN_KEYS: Record<TrialKind, string> = { mid: 'trial-mid-2026-10', ending: 'trial-ending-2026-10' };
export const TRIAL_DAYS = 7;
const DAY = 86_400_000;

export interface TrialUser { email: string; name: string | null; createdAt: string; trialEndsAt?: string | null; subscriptionStatus?: string | null }
export interface TrialRecipient { email: string; name: string | null; daysLeft: number; trialEndsAt: string }

export function trialEndOf(u: Pick<TrialUser, 'createdAt' | 'trialEndsAt'>): number {
  const t = u.trialEndsAt ? Date.parse(u.trialEndsAt) : NaN;
  return Number.isFinite(t) ? t : Date.parse(u.createdAt) + TRIAL_DAYS * DAY;
}

/** Pencereler günlük cron için geniş tutulur (bir gün kaçarsa ertesi gün yakalar); dedup log ile. */
export function selectTrialRecipients(users: TrialUser[], kind: TrialKind, opts: { now?: number; unsubscribed?: Set<string>; alreadySent?: Set<string>; exclude?: Set<string> } = {}): TrialRecipient[] {
  const now = opts.now ?? Date.now();
  const out: TrialRecipient[] = [];
  const seen = new Set<string>();
  for (const u of users) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    if (opts.unsubscribed?.has(email) || opts.alreadySent?.has(email) || opts.exclude?.has(email)) continue;
    const st = (u.subscriptionStatus || '').toLowerCase();
    if (['active', 'trialing', 'trial', 'past_due'].includes(st)) continue;
    const created = Date.parse(u.createdAt);
    if (!Number.isFinite(created)) continue;
    const end = trialEndOf(u);
    if (end <= now) continue; // deneme bitmiş → bu seri değil (win-back ayrı)
    const ageDays = (now - created) / DAY;
    const leftDays = (end - now) / DAY;
    const ok = kind === 'mid' ? ageDays >= 2 && ageDays < 4 && leftDays > 2 : leftDays > 0 && leftDays <= 2;
    if (!ok) continue;
    seen.add(email);
    out.push({ email, name: u.name || null, daysLeft: Math.max(1, Math.ceil(leftDays)), trialEndsAt: new Date(end).toISOString() });
  }
  return out;
}
