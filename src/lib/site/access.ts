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
import { type SiteAccess } from '@/lib/site/access-state';
import { isTwa } from '@/lib/site/twa';

// Tipler ve oturum okumayan yardımcılar `lib/site/access-state.ts`'te (saf
// modül, anonim ISR ağacı oradan içe alır); burada yalnız oturumu gerçekten
// okuyan işler var. Çağrı yerleri değişmesin diye hepsi yeniden ihraç edilir.
export { canSeeMatches, signInHref, ANON_ACCESS } from '@/lib/site/access-state';
export type { SiteAccess, SiteAccessState } from '@/lib/site/access-state';

const DAY = 86_400_000;

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
  const out: SiteAccess = paid && !trialLive
    ? { state: 'pro', email, trialEndsAt, trialDaysLeft: 0 }
    : trialLive
      ? { state: 'trial', email, trialEndsAt, trialDaysLeft: Math.max(0, Math.floor((end! - now) / DAY)) }
      : { state: 'expired', email, trialEndsAt, trialDaysLeft: 0 };
  // Teşhis izi (2026-11-10): Vercel logları UA tutmaz; "web mi Play uygulaması mı"
  // sorusu (fa_twa çerezi) buradan okunur. Tek satır, üye sayfası başına bir kez.
  console.log(`[site-access] ${email} ${out.state} ${isTwa() ? 'play-app' : 'web'}`);
  return out;
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

