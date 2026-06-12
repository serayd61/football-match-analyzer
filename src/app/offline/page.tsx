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
    <div className="fa-shell min-h-screen flex items-center justify-center p-4">
      <div className="fa-card max-w-md mx-auto p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand rounded-2xl flex items-center justify-center text-4xl animate-pulse">
          ⚽
        </div>
        <h1 className="text-content text-2xl font-semibold tracking-tight mb-3">Çevrimdışısınız</h1>
        <p className="text-content-muted mb-6">
          İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="fa-btn fa-btn-primary fa-btn-lg"
        >
          Tekrar Dene
        </button>
        <div className="mt-6 p-3 bg-negative/10 border border-negative/30 rounded-lg text-negative text-sm">
          📡 Bağlantı bekleniyor...
        </div>
      </div>
    </div>
  );
}

