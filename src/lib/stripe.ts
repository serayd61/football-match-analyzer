import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const PLANS = {
  PRO: {
    name: 'Pro Plan',
    price: 19.99,
    currency: 'USD',
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
  // Haftalık düşük-eşik giriş: trial YOK (haftalık zaten deneme işlevi görür;
  // trial+haftalık birleşince ilk ödeme 2 hafta sonraya kayar ve kötüye
  // kullanılır). Webhook değişmez: mapStatusToProfile interval'den bağımsız.
  PRO_WEEKLY: {
    name: 'Pro Weekly',
    price: 6.99,
    currency: 'USD',
    interval: 'week' as const,
    features: [] as string[],
    trialDays: 0,
    stripePriceId: process.env.STRIPE_PRICE_ID_WEEKLY || '',
  },
};

export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
  isUpgrade = false,
  trialDays,
}: {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  isUpgrade?: boolean;
  // Plan bazlı trial: verilmezse eski davranış (yeni kullanıcıya 7 gün).
  // 0 → trial yok (haftalık plan).
  trialDays?: number;
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

 const sessionConfig: Stripe.Checkout.SessionCreateParams = {
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: successUrl,
  cancel_url: cancelUrl,
  metadata: { userId },
  billing_address_collection: 'required',
  allow_promotion_codes: true,  // Promosyon kodu desteği
  // 3D Secure'u her uygun kartta zorla → çalıntı kart denemelerini engeller,
  // sorumluluğu kart sağlayıcıya kaydırır (chargeback koruması). AB-dışı
  // kartlarda da 'any' ile tetiklenir (varsayılan 'automatic' tetiklemiyordu).
  payment_method_options: {
    card: {
      request_three_d_secure: 'any',
    },
  },
};

  // Sadece yeni kullanıcılar için trial ver; plan bazlı override mümkün
  // (haftalık planda trialDays=0 gelir → trial hiç eklenmez)
  const effectiveTrialDays = trialDays ?? (!isUpgrade ? 7 : 0);
  if (effectiveTrialDays > 0) {
    sessionConfig.subscription_data = {
      trial_period_days: effectiveTrialDays,
      metadata: { userId },
    };
  } else {
    sessionConfig.subscription_data = {
      metadata: { userId },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session;
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
