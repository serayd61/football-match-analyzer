import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CalendarDays, ListChecks, Ticket, ClipboardCheck, XCircle } from 'lucide-react';
import type { DayCount } from '@/lib/site/day-strip-rule';

// Panel genel bakışı (overview-1.0, 2026-11-03). Kullanıcı geri bildirimi:
// "aradığım şeyleri bulmak için uğraşmam gerekiyor; yarınki maçları bulamadım".
// Üye panelinin en üstünde beş kapı: bugün / yarın (kaç maç), uyan maçlar,
// günün kuponu, karne (son 7 gün tuttu–tutmadı) ve tutmayanlar — artı
// sonraki günlerin şeridi (hangi günde kaç tahmin var). Sayılar hesaplanmış
// gelir; bileşen yalnız çizer.

export interface OverviewProps {
  today: string;
  /** dün…bugün+5 (day-availability) */
  days: DayCount[];
  /** sonuçlanan son 7 gün */
  record: { won: number; lost: number } | null;
  /** gün etiketi (sunucu formatı: Bugün / Yarın / Çar 5 Kas) */
  dayLabel: (ymd: string) => string;
}

export default async function OverviewStrip({ today, days, record, dayLabel }: OverviewProps) {
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('common');
  const count = (d: string) => days.find((x) => x.date === d)?.covered ?? null;
  const todayN = count(today);
  const tomorrow = days.find((x) => x.date > today)?.date ?? null;
  const tomorrowN = tomorrow ? count(tomorrow) : null;
  const later = days.filter((x) => x.date > (tomorrow ?? today));
  const card = 'card card-hover !block min-w-0 !p-4 no-underline';
  const n = (v: number | null) => (v == null ? t('ovNone') : v === 0 ? t('ovNone') : t('ovMatches', { n: v }));

  return (
    <section className="mb-10" aria-labelledby="overview-title" data-testid="overview-strip">
      <h2 id="overview-title" className="sr-only">{t('overviewTitle')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Link href="/predictions" className={card}>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-s-muted"><CalendarDays size={14} aria-hidden /> {tc('today')}</span>
          <span className="num mt-1 block text-[22px] font-bold leading-tight">{todayN ?? '–'}</span>
          <span className="block text-[12px] text-s-muted">{n(todayN)}</span>
        </Link>
        <Link href={tomorrow ? `/predictions?date=${tomorrow}` : '/predictions'} className={card}>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-s-muted"><CalendarDays size={14} aria-hidden /> {tc('tomorrow')}</span>
          <span className="num mt-1 block text-[22px] font-bold leading-tight">{tomorrowN ?? '–'}</span>
          <span className="block text-[12px] text-s-muted">{n(tomorrowN)}</span>
        </Link>
        <Link href="/picks" className={card}>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-s-muted"><ListChecks size={14} aria-hidden /> {t('ovPicks')}</span>
          <span className="mt-1 block text-[15px] font-semibold leading-tight">{t('ovPicksLead')}</span>
        </Link>
        <Link href="/coupon" className={card}>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-s-muted"><Ticket size={14} aria-hidden /> {t('ovCoupon')}</span>
          <span className="mt-1 block text-[15px] font-semibold leading-tight">{t('ovCouponLead')}</span>
        </Link>
        <Link href="/performance?outcome=lost#results" className={`${card} col-span-2 md:col-span-1`}>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-s-muted"><ClipboardCheck size={14} aria-hidden /> {t('ovRecord')}</span>
          {record && record.won + record.lost > 0 ? (
            <span className="num mt-1 block text-[22px] font-bold leading-tight"><span className="text-s-win">{record.won}</span><span className="text-s-muted"> – </span><span className="text-s-loss">{record.lost}</span></span>
          ) : (
            <span className="mt-1 block text-[22px] font-bold leading-tight">–</span>
          )}
          <span className="flex items-center gap-1 text-[12px] text-s-muted"><XCircle size={12} aria-hidden /> {t('ovMisses')}</span>
        </Link>
      </div>
      {later.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-s-muted">
          <span>{t('ovNext')}:</span>
          {later.map((d) => (
            <Link key={d.date} href={`/predictions?date=${d.date}`} className={`chip chip-sm ${d.covered === 0 ? '!opacity-60' : ''}`} title={d.covered === 0 ? t('ovNone') : undefined}>
              {dayLabel(d.date)} <span className="chip-n num">{d.covered}</span>
            </Link>
          ))}
          <span className="basis-full text-[12px]">{t('ovNextNote')}</span>
        </p>
      )}
    </section>
  );
}
