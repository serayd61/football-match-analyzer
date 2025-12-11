'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const navItems = [
    { href: '/', label: 'Ana Sayfa', icon: '🏠' },
    { href: '/live', label: 'Canlı Skorlar', icon: '🔴', badge: 'LIVE' },
    { href: '/predictions', label: 'Tahminler', icon: '🎯' },
    { href: '/stats', label: 'İstatistikler', icon: '📊' },
  ];
  
  return (
    <nav className="bg-black/50 backdrop-blur-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="text-xl font-bold text-white">
              Football<span className="text-green-400">Analytics</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  pathname === item.href
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

