// Public site access (2026-09-08): the site is members-only. A visitor never
// sees a fixture; a new account gets 7 days of full access from registration
// (profiles.trial_ends_at, written by /api/auth/register); after that the
// paid plan is required. Admins and live Stripe subscribers are always in.
//
// Pages call `requireSiteAccess` (anonymous → /login redirect) and render
// <Paywall/> when the result is `expired`. Reading the session makes the page
// dynamic, which is intended: gated HTML must never be cached for everyone.
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin/emails';
import { hasEnginePredictionAccess, trialEndMs } from '@/lib/accessControl';

export type SiteAccessState = 'anon' | 'trial' | 'pro' | 'expired';
export interface SiteAccess {
  state: SiteAccessState;
  email: string | null;
  trialEndsAt: string | null;
  /** Whole days left in the registration trial (0 on the last day). */
  trialDaysLeft: number;
}

const DAY = 86_400_000;

export const canSeeMatches = (a: SiteAccess): boolean => a.state === 'trial' || a.state === 'pro';

export async function getSiteAccess(): Promise<SiteAccess> {
  const session = await getServerSession(authOptions).catch(() => null);
  const email = session?.user?.email?.toLowerCase() || null;
  if (!email) return { state: 'anon', email: null, trialEndsAt: null, trialDaysLeft: 0 };
  if (isAdminEmail(email)) return { state: 'pro', email, trialEndsAt: null, trialDaysLeft: 0 };

  let trialEndsAt: string | null = null;
  let createdAt: string | null = null;
  try {
    const { data } = await getSupabaseAdmin()
      .from('profiles')
      .select('trial_ends_at, created_at')
      .ilike('email', email)
      .maybeSingle();
    trialEndsAt = data?.trial_ends_at ?? null;
    createdAt = data?.created_at ?? null;
  } catch (e) {
    console.error('[site-access] profile read failed', e);
  }
  // Legacy rows without trial_ends_at: 7 days from the profile's creation.
  if (!trialEndsAt && createdAt) {
    const c = trialEndMs(createdAt);
    if (c != null) trialEndsAt = new Date(c + 7 * DAY).toISOString();
  }

  const now = Date.now();
  const end = trialEndMs(trialEndsAt);
  const trialLive = end != null && end > now;

  // Paid (Stripe / manual with end date). Checked after the cheap trial read so a
  // trialing user is labelled "trial", not "pro", even though both unlock.
  const paid = await hasEnginePredictionAccess(email).catch(() => false);
  if (paid && !trialLive) return { state: 'pro', email, trialEndsAt, trialDaysLeft: 0 };
  if (trialLive) return { state: 'trial', email, trialEndsAt, trialDaysLeft: Math.max(0, Math.floor((end! - now) / DAY)) };
  return { state: 'expired', email, trialEndsAt, trialDaysLeft: 0 };
}

/** Anonymous visitors are sent to sign-in and come back to `path` afterwards. */
export async function requireSiteAccess(locale: string, path: string): Promise<SiteAccess> {
  const access = await getSiteAccess();
  // Sign-in lives on the localized site (2026-09-11); callbackUrl brings the visitor back.
  if (access.state === 'anon') redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}${path}`)}`);
  return access;
}
