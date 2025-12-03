import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const PLANS = {
  PRO: {
    name: 'Pro Plan',
    price: 9.99,
    currency: 'CHF',
    interval: 'month' as const,
    features: [
      'Tüm liglere erişim',
      '3 AI analizi (Claude, OpenAI, Gemini)',
      'Canlı bahis oranları',
      'Günlük maç tahminleri',
      'Kupon oluşturma',
    ],
    trialDays: 7,
    stripePriceId: process.env.STRIPE_PRICE_ID!,
  },
};

export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const customers = await stripe.customers.list({
    email: userEmail,
    limit: 1,
  });

  let customerId = customers.data[0]?.id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    billing_address_collection: 'required',
  });

  return session;
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
