'use client';

// ============================================================================
// DashboardTopBar — modern app shell top bar for the rebuilt dashboard.
// Preserves all original nav links, profile menu, language, sign-out, refresh.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, BarChart3, Star, Trophy, User, Settings, LogOut,
  TrendingUp, LayoutGrid, Menu, X, RefreshCw, ChevronDown, Target, Zap,
} from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { cx } from '@/components/ui';

type NavLink = { href: string; label: string; icon: React.ReactNode };

export default function DashboardTopBar({
  t,
  userName,
  userEmail,
  onRefresh,
  refreshing,
  analysesLeft,
  analysesLimit,
  onAnalysesClick,
}: {
  t: any;
  userName?: string | null;
  userEmail?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Free kullanıcının bugün kalan analiz hakkı; null/undefined = chip gizli (Pro). */
  analysesLeft?: number | null;
  analysesLimit?: number | null;
  onAnalysesClick?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const navLinks: NavLink[] = [
    { href: '/tahminler', label: t.predictions || 'Predictions', icon: <Target size={16} /> },
    { href: '/league-stats', label: t.leagueStats || 'League Stats', icon: <Trophy size={16} /> },
    { href: '/performance', label: t.performanceTracking || 'Performance', icon: <BarChart3 size={16} /> },
    { href: '/favorites', label: t.favorites || 'Favorites', icon: <Star size={16} /> },
  ];

  const menuLinks: NavLink[] = [
    { href: '/profile', label: t.profile || 'Profile', icon: <User size={16} /> },
    { href: '/settings', label: t.settings || 'Settings', icon: <Settings size={16} /> },
    { href: '/performance', label: t.performanceTracking || 'Performance', icon: <BarChart3 size={16} /> },
    { href: '/odds-analysis', label: t.oddsAnalysisRecords || 'Odds Analysis', icon: <TrendingUp size={16} /> },
    { href: '/odds-patterns', label: t.patternAnalysis || 'Patterns', icon: <LayoutGrid size={16} /> },
  ];

  const initials = (userName || userEmail || 'U').trim().slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface-0/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand">
            <Activity size={18} className="text-[#06281d]" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-[15px] font-semibold text-content tracking-tight">
              {t.title || 'Football Analytics'}
            </div>
            <div className="text-[10px] font-medium text-content-subtle uppercase tracking-[0.14em]">
              {t.subtitle || 'AI Match Intelligence'}
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Free günlük analiz sayacı — tıklanınca öne çıkan maçlara götürür */}
          {analysesLeft != null && analysesLimit != null && (
            <button
              onClick={onAnalysesClick}
              title={t.freeAnalysesChip || 'Free analyses today'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                analysesLeft > 0
                  ? 'border-brand-400/40 bg-brand-400/10 text-brand-300 hover:bg-brand-400/20'
                  : 'border-line bg-surface-2 text-content-subtle hover:bg-surface-3'
              }`}
            >
              <Zap size={13} />
              {analysesLeft}/{analysesLimit}
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              title={t.refresh || 'Refresh'}
              className="hidden sm:grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}

          <div className="hidden sm:block">
            <LanguageSelector />
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <span className="w-8 h-8 rounded-full grid place-items-center bg-surface-3 border border-line text-[11px] font-bold text-content">
                {initials}
              </span>
              <span className="hidden md:block text-[13px] font-medium text-content max-w-[120px] truncate">
                {userName || userEmail?.split('@')[0]}
              </span>
              <ChevronDown size={14} className="hidden md:block text-content-subtle" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface-2 shadow-elev-3 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-line">
                    <div className="text-sm font-semibold text-content truncate">{userName || '—'}</div>
                    <div className="text-xs text-content-subtle truncate mt-0.5">{userEmail}</div>
                  </div>
                  <div className="py-1.5">
                    {menuLinks.map((l) => (
                      <Link
                        key={l.href + l.label}
                        href={l.href}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-content-muted hover:text-content hover:bg-surface-3 transition-colors"
                      >
                        <span className="text-content-subtle">{l.icon}</span>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                  <div className="py-1.5 border-t border-line">
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-[13px] text-negative hover:bg-negative/10 transition-colors"
                    >
                      <LogOut size={16} />
                      {t.logout || 'Sign out'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Mobile slide-over */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-surface-1 border-l border-line z-50 lg:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-line">
                <span className="text-sm font-semibold text-content">{t.menu || 'Menu'}</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:bg-surface-3"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-1">
                {[...navLinks, ...menuLinks].map((l, i) => (
                  <Link
                    key={l.href + l.label + i}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-content-muted hover:text-content hover:bg-surface-3 transition-colors"
                  >
                    <span className="text-content-subtle">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
                <div className="pt-3 mt-2 border-t border-line">
                  <div className="px-2 pb-3">
                    <LanguageSelector />
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center gap-3 px-3 py-3 w-full rounded-lg text-sm font-medium text-negative hover:bg-negative/10 transition-colors"
                  >
                    <LogOut size={16} />
                    {t.logout || 'Sign out'}
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
