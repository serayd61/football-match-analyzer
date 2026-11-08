// Mobil LCP (ölçüm 2026-11-08): Next <Link> görüş alanına giren her bağlantı
// için RSC yükü ön yüklüyordu — anonim bir ziyarette /en/matches 18,7 KB ve
// /en/leagues 13,2 KB, yani ~32 KB kritik yolla yarışıyordu. Arama trafiğinden
// gelen ziyaretçi çoğunlukla tek sayfa görüyor; sabit gezinti (başlık, alt
// bilgi, mobil sekme çubuğu) ön yüklemesi bedava değil. prefetch={false} ile
// gezinti hâlâ istemci tarafı, yalnız tıklayınca indiriyor.
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
  // SEO 2026-10-10: ziyaretçi sekmesi herkese açık /matches; üyeye /predictions.
  const items = [
    status === 'authenticated' ? { href: '/predictions', label: t('predictions'), Icon: CalendarDays } : { href: '/matches', label: t('matches'), Icon: CalendarDays },
    { href: '/performance', label: t('performance'), Icon: ClipboardCheck },
    { href: '/leagues', label: t('leagues'), Icon: Trophy },
    // overview-1.0: üye sekmesi zaten /dashboard'a gidiyordu ama "Hesap" yazıyordu — adı gittiği yer olsun.
    { href: account, label: status === 'authenticated' ? t('dashboard') : t('account'), Icon: UserRound },
  ];
  return (
    <nav className="tabbar lg:hidden" aria-label="Primary (mobile)">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} rel={href === '/login' ? 'nofollow' : undefined} aria-current={is(href) || (href === account && (is('/dashboard') || is('/account') || is('/login'))) ? 'page' : undefined} prefetch={false}>
          <Icon size={20} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
