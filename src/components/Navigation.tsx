'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

export default function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { lang } = useLanguage();

  const labels = {
    tr: {
      home: 'Ana Sayfa',
      dashboard: 'Dashboard',
      live: 'Canlı',
      predictions: 'Tahminler',
      aiPerformance: 'AI Performans',
      contact: 'İletişim',
      admin: 'Admin',
      menu: 'Menü',
      login: 'Giriş Yap',
    },
    en: {
      home: 'Home',
      dashboard: 'Dashboard',
      live: 'Live',
      predictions: 'Predictions',
      aiPerformance: 'AI Performance',
      contact: 'Contact',
      admin: 'Admin',
      menu: 'Menu',
      login: 'Sign In',
    },
    de: {
      home: 'Startseite',
      dashboard: 'Dashboard',
      live: 'Live',
      predictions: 'Vorhersagen',
      aiPerformance: 'KI Leistung',
      contact: 'Kontakt',
      admin: 'Admin',
      menu: 'Menü',
      login: 'Anmelden',
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const navItems = [
    { href: '/', label: l.home, icon: '🏠' },
    { href: '/dashboard', label: l.dashboard, icon: '📊' },
    { href: '/live', label: l.live, icon: '🔴', badge: 'LIVE' },
    { href: '/predictions', label: l.predictions, icon: '🎯' },
    { href: '/ai-performance', label: l.aiPerformance, icon: '🧠', badge: 'NEW' },
    { href: '/contact', label: l.contact, icon: '📬' },
    { href: '/admin', label: l.admin, icon: '⚙️', badge: 'PRO' },
  ];

  // Scroll effect - MUST be before any conditional return
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Dashboard ve login sayfalarında navigasyonu gizle
  if (pathname === '/dashboard' || pathname === '/login') {
    return null;
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-gray-900/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">⚽</span>
              <span className="text-lg sm:text-xl font-bold text-white">
                Football<span className="text-green-400">Analytics</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                PRO
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    pathname === item.href
                      ? 'bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Mobile Menu Panel */}
        <div className={`fixed top-0 right-0 h-full w-72 bg-gray-900 z-50 transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <span className="text-lg font-bold text-white">{l.menu}</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav Items */}
            <div className="flex-1 overflow-y-auto py-4">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all ${
                    pathname === item.href
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-center font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition"
              >
                {l.login}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed navigation */}
      <div className="h-16" />
    </>
  );
}
