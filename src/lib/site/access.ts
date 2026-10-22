// Public site access (2026-09-08): the site is members-only. A visitor never
// sees a fixture; a new account gets 7 days of full access from registration
// (profiles.trial_ends_at, written by /api/auth/register); after that the
// paid plan is required. Admins and live Stripe subscribers are always in.
//
// Pages call `requireSiteAccess` and render <AnonWall/> for `anon` and
// <Paywall/> when the result is `expired`. Reading the session makes the page
// dynamic, which is intended: gated HTML must never be cached for everyone.
import { getServerSession } from 'next-auth';
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

/**
 * Access for a members-only page. SEO Faz 0 (2026-10-17): anonymous visitors are
 * NOT redirected any more — every distinct `/login?callbackUrl=…` used to become
 * its own noindexed URL (343 in Search Console) and /login the most-linked page
 * on the site (4,718 internal links). Pages render <AnonWall/> (200, noindex)
 * instead; `signInHref(locale, path)` gives the wall's sign-in link.
 */
export async function requireSiteAccess(_locale: string, _path: string): Promise<SiteAccess> {
  return getSiteAccess();
}

/**
 * Sign-in link that brings the visitor back to `path` (locale-free) afterwards.
 * Localized (2026-10-22): the unprefixed /login is the legacy app route, whose
 * server redirect fires mid-stream — Googlebot got a 200 shell with no canonical
 * and Search Console listed 70 `/login?callbackUrl=…` URLs as duplicates.
 */
export function signInHref(locale: string, path: string, register = false): string {
  const qs = new URLSearchParams();
  if (register) qs.set('mode', 'register');
  qs.set('callbackUrl', `/${locale}${path}`);
  return `/${locale}/login?${qs.toString()}`;
}
