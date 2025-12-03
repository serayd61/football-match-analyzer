'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-white">⚽ Football Analytics</div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-gray-300 hover:text-white">Fiyatlar</Link>
          <Link href="/login" className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">
            Giriş Yap
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 mb-6">
          🎁 7 Gün Ücretsiz Deneyin
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          AI Destekli<br />
          <span className="text-green-500">Futbol Tahminleri</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          3 farklı yapay zeka (Claude, OpenAI, Gemini) birlikte çalışarak 
          en doğru maç tahminlerini ve bahis analizlerini üretiyor.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-xl shadow-lg">
            Ücretsiz Başla →
          </Link>
          <Link href="/pricing" className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white text-lg rounded-xl">
            Fiyatları Gör
          </Link>
        </div>
      </div>

      <div className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">3 AI Consensus</h3>
            <p className="text-gray-400">Claude, OpenAI ve Gemini birlikte analiz yaparak en güvenilir tahminleri oluşturur.</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-3">Canlı Bahis Oranları</h3>
            <p className="text-gray-400">Anlık bahis oranlarını AI analizi ile karşılaştırarak value betting fırsatları bulun.</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-3">20 Avrupa Ligi</h3>
            <p className="text-gray-400">Premier League, La Liga, Serie A, Bundesliga ve daha fazlası tek platformda.</p>
          </div>
        </div>
      </div>

      <footer className="py-12 px-6 border-t border-gray-800 text-center text-gray-500">
        <p>⚽ Football Analytics Pro - AI Destekli Maç Tahmin Sistemi</p>
        <p className="text-sm mt-2">Bu site Serkan Aydın tarafından yapılmıştır 🚀</p>
      </footer>
    </div>
  );
}
