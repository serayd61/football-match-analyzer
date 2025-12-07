'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

export default function FloatingBackButton() {
  const pathname = usePathname();
  const { lang } = useLanguage();

  const labels = {
    tr: { back: 'Analizler' },
    en: { back: 'Analysis' },
    de: { back: 'Analysen' },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  // Only show on specific pages, not on dashboard or login
  const showOnPages = ['/coupons', '/leaderboard', '/profile', '/pricing'];
  const shouldShow = showOnPages.some(page => pathname.startsWith(page));

  if (!shouldShow) return null;

  return (
    <Link
      href="/dashboard"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-full shadow-2xl shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span className="hidden sm:inline">📊 {l.back}</span>
      <span className="sm:hidden">📊</span>
    </Link>
  );
}
