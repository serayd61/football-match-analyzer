import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const PLANS = {
  PRO: {
    name: 'Pro Plan',
    price: 9.90,
    currency: 'USD',
    interval: 'month' as const,
    features: [
      'Tüm liglere erişim',
      '3 AI analizi (Claude, OpenAI, Gemini)',
      'Canlı bahis oranları',
      'Günlük maç tahminleri',
      'Kupon oluşturma',
    ],
    // Stripe trial YOK (2026-10-13): 7 günlük ücretsiz dönem kayıtta kartsız
    // veriliyor (profiles.trial_ends_at). Checkout'ta ikinci bir 7 gün daha
    // vermek toplam 14 gün bedava ediyordu; artık kart girilince hemen çekilir.
    trialDays: 0,
    stripePriceId: process.env.STRIPE_PRICE_ID!,
  },
};

export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
  trialDays,
}: {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  // Stripe tarafı trial günü; varsayılan 0 (hiçbir planda trial yok).
  trialDays?: number;
}) {
  // Müşteri önceden YARATILMAZ (2026-10-13): Checkout'u açıp kart girmeden
  // çıkan herkes Stripe'ta boş "müşteri" olarak birikiyordu ve abonelik
  // sanılıyordu. Daha önce abone olmuş (müşterisi olan) kullanıcı için mevcut
  // kayıt yeniden kullanılır ki fatura geçmişi/portal tek müşteride kalsın;
  // yeni kullanıcıda yalnız customer_email verilir, müşteriyi ödeme
  // tamamlanınca Stripe oluşturur. Stripe kuralı: customer ile customer_email
  // aynı oturumda olamaz.
  const customers = await stripe.customers.list({
    email: userEmail,
    limit: 1,
  });
  const existingCustomerId = customers.data[0]?.id;

 const sessionConfig: Stripe.Checkout.SessionCreateParams = {
  ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: userEmail }),
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: successUrl,
  cancel_url: cancelUrl,
  metadata: { userId },
  billing_address_collection: 'required',
  allow_promotion_codes: true,  // Promosyon kodu desteği
  // 3DS: 'any' (her kartta zorla) gerçek müşterileri de düşürüyordu —
  // 2026 Tem: tek gerçek abonelik past_due'da öldü, 8 denemeden 6'sı
  // başarısız. Çalıntı-kart savunması Radar kurallarında kalıyor; 3DS'i
  // Stripe'ın risk bazlı kararına bırak ('automatic').
  payment_method_options: {
    card: {
      request_three_d_secure: 'automatic',
    },
  },
};

  // trialDays > 0 verilmedikçe trial eklenmez: ödeme Checkout'ta hemen alınır.
  const effectiveTrialDays = trialDays ?? 0;
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
