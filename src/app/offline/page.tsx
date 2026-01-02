'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();

  useEffect(() => {
    const handleOnline = () => {
      router.push('/dashboard');
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-4xl animate-pulse">
          ⚽
        </div>
        <h1 className="text-white text-2xl font-bold mb-3">Çevrimdışısınız</h1>
        <p className="text-gray-400 mb-6">
          İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all"
        >
          Tekrar Dene
        </button>
        <div className="mt-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          📡 Bağlantı bekleniyor...
        </div>
      </div>
    </div>
  );
}

