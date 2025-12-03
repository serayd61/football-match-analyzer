'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    // Giriş yapmamışsa kayıt sayfasına yönlendir
    if (!session) {
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'PRO' }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Bir hata oluştu');
      }
    } catch (error) {
      alert('Ödeme işlemi başlatılamadı');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-4 text-gray-400 hover:text-white">← Ana Sayfa</Link>
          <h1 className="text-4xl font-bold text-white mb-4">⚽ Pro Plan</h1>
          <p className="text-gray-400 text-lg">7 gün ücretsiz deneyin, istediğiniz zaman iptal edin</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-400">
            🎁 İlk 7 gün tamamen ücretsiz!
          </div>
        </div>

        <div className="max-w-md mx-auto bg-gray-800 rounded-2xl p-8 ring-2 ring-green-500">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Pro Plan</h3>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-white">CHF 9.99</span>
              <span className="text-gray-400">/ay</span>
            </div>
          </div>

          <ul className="space-y-3 mb-8">
            {[
              'Tüm liglere erişim',
              '3 AI analizi (Claude, OpenAI, Gemini)',
              'Canlı bahis oranları',
              'Günlük maç tahminleri',
              'Kupon oluşturma',
              'Telegram bildirimleri',
            ].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-gray-300">
                <span className="text-green-500">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : session ? 'Hemen Başla' : '7 Gün Ücretsiz Başla'}
          </button>

          <p className="text-center text-gray-500 text-sm mt-4">
            Kredi kartı gerekli • 7 gün ücretsiz • İstediğiniz zaman iptal
          </p>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>7 gün içinde iptal ederseniz hiçbir ücret alınmaz.</p>
          <p>İptal etmezseniz ayda CHF 9.99 otomatik çekilir.</p>
        </div>
      </div>
    </div>
  );
}
