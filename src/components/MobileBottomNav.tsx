'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Maçlar', icon: '⚽' },
    { href: '/coupons', label: 'Kuponlar', icon: '🎫' },
    { href: '/leaderboard', label: 'Liderlik', icon: '🏆' },
    { href: '/profile', label: 'Profil', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 safe-area-inset-bottom">
      <div className="grid grid-cols-4 h-16">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive 
                  ? 'text-green-400' 
                  : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-green-400' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

