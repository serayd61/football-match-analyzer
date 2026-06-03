export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert a unix-seconds timestamp to ISO, returning null if invalid. */
function tsToIso(sec?: number | null): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  const d = new Date(sec * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Newer Stripe API versions moved current_period_* off the subscription root
 * onto each subscription item. Read whichever is present.
 */
function subscriptionPeriod(sub: Stripe.Subscription): { start: string | null; end: string | null } {
  const anySub = sub as any;
  let start = anySub.current_period_start;
  let end = anySub.current_period_end;
  if (typeof end !== 'number') {
    const item = anySub.items?.data?.[0];
    if (item) {
      start = item.current_period_start ?? start;
      end = item.current_period_end ?? end;
    }
  }
  return { start: tsToIso(start), end: tsToIso(end) };
}

/** Resolve a Stripe customer's email from the event payload or via the API. */
async function getCustomerEmail(
  customerId: string | null | undefined,
  fallbackEmail?: string | null
): Promise<string | null> {
  if (fallbackEmail) return fallbackEmail;
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !(customer as any).deleted) {
      return (customer as Stripe.Customer).email ?? null;
    }
  } catch (e) {
    console.error('[stripe-webhook] customers.retrieve failed', customerId, e);
  }
  return null;
}

/**
 * Find the app user_id for a Stripe customer.
 * 1) by existing subscriptions.stripe_customer_id
 * 2) fallback: customer email -> users.email  (self-heal for events that
 *    arrived before stripe_customer_id was ever stored)
 */
async function resolveUserId(
  customerId: string | null | undefined,
  fallbackEmail?: string | null
): Promise<string | null> {
  if (customerId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  const email = await getCustomerEmail(customerId, fallbackEmail);
  if (email) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (user?.id) return user.id;
  }

  return null;
}

/** Update the subscription row for a user; insert one if it doesn't exist. */
async function upsertSubscription(userId: string, patch: Record<string, any>) {
  const payload = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(payload)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    console.error('[stripe-webhook] update failed', userId, error.message);
    throw error;
  }

  if (!data || data.length === 0) {
    const { error: insErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id: userId, ...payload });
    if (insErr) {
      console.error('[stripe-webhook] insert failed', userId, insErr.message);
      throw insErr;
    }
  }
}

/**
 * Stripe abonelik durumunu profiles.subscription_status'a da yansıt.
 * Erişim kontrolü (checkUserAccess) bu alanı okuduğu için, ödeme yapan/trial'daki
 * kullanıcının erişim alması bu senkrona bağlı. Profil email ile anahtarlanır.
 * Best-effort: hata webhook'u (ve para akışını) bozmasın.
 */
async function syncProfileStatus(email: string | null | undefined, status: 'active' | 'free') {
  if (!email) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ subscription_status: status })
      .ilike('email', email)
      .select('email');
    if (error) {
      console.error('[stripe-webhook] profiles update failed', email, error.message);
      return;
    }
    if (!data || data.length === 0) {
      const { error: insErr } = await supabaseAdmin
        .from('profiles')
        .insert({ email, subscription_status: status });
      if (insErr) console.error('[stripe-webhook] profiles insert failed', email, insErr.message);
    }
  } catch (e) {
    console.error('[stripe-webhook] syncProfileStatus error', email, e);
  }
}

/** Stripe abonelik durumu -> profiles.subscription_status eşlemesi. */
function mapStatusToProfile(stripeStatus: string): 'active' | 'free' {
  return stripeStatus === 'active' || stripeStatus === 'trialing' ? 'active' : 'free';
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error: any) {
    console.error('[stripe-webhook] signature verification failed:', error?.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = (session.customer as string) || null;
        const subscriptionId = (session.subscription as string) || null;
        const email = session.customer_details?.email || session.customer_email || null;

        let userId = session.metadata?.userId || null;
        if (!userId) userId = await resolveUserId(customerId, email);

        if (userId) {
          await upsertSubscription(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: 'trialing',
          });
          await syncProfileStatus(await getCustomerEmail(customerId, email), 'active');
        } else {
          console.warn('[stripe-webhook] checkout.session.completed: no user match', customerId, email);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userId = await resolveUserId(customerId);

        if (userId) {
          const { start, end } = subscriptionPeriod(subscription);
          await upsertSubscription(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: start,
            current_period_end: end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          });
          await syncProfileStatus(
            await getCustomerEmail(customerId),
            mapStatusToProfile(subscription.status),
          );
        } else {
          console.warn('[stripe-webhook] subscription.updated: no user match', customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userId = await resolveUserId(customerId);

        if (userId) {
          await upsertSubscription(userId, {
            stripe_customer_id: customerId,
            status: 'canceled',
          });
          await syncProfileStatus(await getCustomerEmail(customerId), 'free');
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = (invoice as any).subscription as string | null;
        const email = invoice.customer_email || null;
        const userId = await resolveUserId(customerId, email);

        if (userId) {
          const periodEnd =
            tsToIso((invoice as any).lines?.data?.[0]?.period?.end) ||
            tsToIso((invoice as any).period_end);
          await upsertSubscription(userId, {
            stripe_customer_id: customerId,
            ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
            status: 'active',
            ...(periodEnd ? { current_period_end: periodEnd } : {}),
          });
          await syncProfileStatus(await getCustomerEmail(customerId, email), 'active');
        } else {
          console.warn('[stripe-webhook] invoice.payment_succeeded: no user match', customerId, email);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = invoice.customer_email || null;
        const userId = await resolveUserId(customerId, email);

        if (userId) {
          await upsertSubscription(userId, {
            stripe_customer_id: customerId,
            status: 'past_due',
          });
          await syncProfileStatus(await getCustomerEmail(customerId, email), 'free');
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[stripe-webhook] handler error:', event?.type, error?.message);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
