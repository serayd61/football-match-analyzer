'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { CalendarDays, ClipboardCheck, Trophy, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

// Mobile bottom tab bar (v3): the four places people actually go. Hidden ≥ lg.
export default function MobileTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { status } = useSession();
  const is = (h: string) => pathname === h || pathname.startsWith(h + '/');
  const account = status === 'authenticated' ? '/dashboard' : '/login';
  const items = [
    { href: '/predictions', label: t('predictions'), Icon: CalendarDays },
    { href: '/performance', label: t('performance'), Icon: ClipboardCheck },
    { href: '/leagues', label: t('leagues'), Icon: Trophy },
    { href: account, label: t('account'), Icon: UserRound },
  ];
  return (
    <nav className="tabbar lg:hidden" aria-label="Primary (mobile)">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={is(href) || (href === account && (is('/dashboard') || is('/account') || is('/login'))) ? 'page' : undefined}>
          <Icon size={20} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
