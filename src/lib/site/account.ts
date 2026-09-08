// Account page data (2026-09-08): who the member is, where their access comes
// from (registration trial / Stripe / manual grant) and what Stripe knows.
// Read-only; writes stay in the Stripe webhook and the checkout/portal routes.
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSiteAccess, type SiteAccess } from '@/lib/site/access';

export interface AccountBilling {
  /** A Stripe subscription or customer exists → portal can open. */
  hasStripe: boolean;
  status: string | null;          // Stripe status: active, trialing, past_due, canceled, …
  plan: string | null;
  periodEnd: string | null;       // ISO; next renewal (or end, if cancelling)
  cancelAtPeriodEnd: boolean;
  /** Manual/legacy grant end (profiles.subscription_end) when no Stripe row is live. */
  manualEnd: string | null;
}

export interface AccountSummary {
  email: string;
  name: string | null;
  memberSince: string | null;
  access: SiteAccess;
  billing: AccountBilling;
}

export async function getAccountSummary(access: SiteAccess): Promise<AccountSummary | null> {
  const email = access.email;
  if (!email) return null;
  const db = getSupabaseAdmin();
  const [{ data: user }, { data: profile }] = await Promise.all([
    db.from('users').select('id, name, created_at').ilike('email', email).maybeSingle(),
    db.from('profiles').select('name, created_at, subscription_end, subscription_id').ilike('email', email).maybeSingle(),
  ]);
  let sub: any = null;
  if (user?.id) {
    const { data } = await db
      .from('subscriptions')
      .select('status, plan, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    sub = data;
  }
  const hasStripe = !!(sub?.stripe_subscription_id || sub?.stripe_customer_id || profile?.subscription_id);
  return {
    email,
    name: user?.name || profile?.name || null,
    memberSince: user?.created_at || profile?.created_at || null,
    access,
    billing: {
      hasStripe,
      status: sub?.status ?? null,
      plan: sub?.plan ?? null,
      periodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
      manualEnd: profile?.subscription_end ?? null,
    },
  };
}

export { getSiteAccess };
