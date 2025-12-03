'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLanguage();

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
        <div className="text-2xl font-bold text-white">⚽ {t('appName')}</div>
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <Link href="/pricing" className="text-gray-300 hover:text-white">{t('pricing')}</Link>
          <Link href="/login" className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">
            {t('login')}
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 mb-6">
          🎁 {t('trialBadge')}
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          {t('heroTitle')}<br />
          <span className="text-green-500">{t('heroTitleHighlight')}</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          {t('heroDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-xl shadow-lg">
            {t('startFree')} →
          </Link>
          <Link href="/pricing" className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white text-lg rounded-xl">
            {t('seePricing')}
          </Link>
        </div>
      </div>

      <div className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-white mb-3">{t('feature1Title')}</h3>
            <p className="text-gray-400">{t('feature1Desc')}</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-3">{t('feature2Title')}</h3>
            <p className="text-gray-400">{t('feature2Desc')}</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-3">{t('feature3Title')}</h3>
            <p className="text-gray-400">{t('feature3Desc')}</p>
          </div>
        </div>
      </div>

      <footer className="py-12 px-6 border-t border-gray-800 text-center text-gray-500">
        <p>⚽ {t('appName')} - {t('appDesc')}</p>
        <p className="text-sm mt-2">{t('madeBy')} 🚀</p>
      </footer>
    </div>
  );
}
