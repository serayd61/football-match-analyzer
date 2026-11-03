import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CalendarDays, ListChecks, Ticket, ClipboardCheck, ArrowRight } from 'lucide-react';
import type { DayCount } from '@/lib/site/day-strip-rule';

// Panel genel bakışı (overview-1.0, 2026-11-03). Kullanıcı geri bildirimi:
// "aradığım şeyleri bulmak için uğraşmam gerekiyor; yarınki maçları bulamadım".
// Üye panelinin en üstünde beş kapı: bugün / yarın (kaç maç), uyan maçlar,
// günün kuponu, karne (son 7 gün tuttu–tutmadı → tutmayanlar) — artı sonraki
// günlerin şeridi. Sayılar hesaplanmış gelir; bileşen yalnız çizer.
// v1.1 (aynı gün, "cansız" geri bildirimi): bugün kartı marka yeşili dolu, büyük
// sayılar, renkli simge kutuları, karnede tuttu/tutmadı oran çubuğu + isabet %,
// dolu günler yeşil çip; kartlar hover'da hafif yükselir (card-hover).

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
  const n = (v: number | null) => (v == null || v === 0 ? t('ovNone') : t('ovMatches', { n: v }));
  const total = record ? record.won + record.lost : 0;
  const hit = total ? Math.round((record!.won / total) * 100) : null;

  const card = 'card card-hover !block min-w-0 !p-4 no-underline transition-transform hover:-translate-y-0.5';
  const eyebrow = 'flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em]';
  const tile = 'grid h-7 w-7 shrink-0 place-items-center rounded-lg';
  const big = 'num mt-2 block text-[34px] font-bold leading-none tracking-tight';

  return (
    <section className="mb-10" aria-labelledby="overview-title" data-testid="overview-strip">
      <h2 id="overview-title" className="sr-only">{t('overviewTitle')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {/* Bugün — marka yeşili, şeridin odağı */}
        <Link href="/predictions" className={`${card} !border-s-brand !bg-s-brand !text-s-brand-ink`}>
          <span className={`${eyebrow} text-white/80`}><span className={`${tile} bg-white/15`}><CalendarDays size={15} aria-hidden /></span>{tc('today')}</span>
          <span className={big}>{todayN ?? '–'}</span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-[12.5px] text-white/80">{n(todayN)} <ArrowRight size={14} aria-hidden className="shrink-0" /></span>
        </Link>

        {/* Yarın */}
        <Link href={tomorrow ? `/predictions?date=${tomorrow}` : '/predictions'} className={card}>
          <span className={`${eyebrow} text-s-accent-600`}><span className={`${tile} bg-s-accent-100 text-s-accent-700`}><CalendarDays size={15} aria-hidden /></span>{tc('tomorrow')}</span>
          <span className={`${big} ${tomorrowN ? 'text-s-ink' : 'text-s-muted'}`}>{tomorrowN ?? '–'}</span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-[12.5px] text-s-muted">{n(tomorrowN)} <ArrowRight size={14} aria-hidden className="shrink-0" /></span>
        </Link>

        {/* Uyan maçlar */}
        <Link href="/picks" className={card}>
          <span className={`${eyebrow} text-s-accent-600`}><span className={`${tile} bg-s-accent-100 text-s-accent-700`}><ListChecks size={15} aria-hidden /></span>{t('ovPicks')}</span>
          <span className="mt-2 block text-[16px] font-bold leading-snug text-s-ink">{t('ovPicksLead')}</span>
          <span className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-s-accent-600">{tc('viewAll')} <ArrowRight size={14} aria-hidden /></span>
        </Link>

        {/* Günün kuponu — ikinci vurgu rengi (amber) */}
        <Link href="/coupon" className={card}>
          <span className={`${eyebrow} text-s-accent2-700`}><span className={`${tile} bg-s-accent2-700/15 text-s-accent2-700`}><Ticket size={15} aria-hidden /></span>{t('ovCoupon')}</span>
          <span className="mt-2 block text-[16px] font-bold leading-snug text-s-ink">{t('ovCouponLead')}</span>
          <span className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-s-accent2-700">{tc('viewAll')} <ArrowRight size={14} aria-hidden /></span>
        </Link>

        {/* Karne — tuttu/tutmadı oran çubuğu */}
        <Link href="/performance?outcome=lost#results" className={`${card} col-span-2 md:col-span-1`}>
          <span className={`${eyebrow} text-s-muted`}><span className={`${tile} bg-s-raised text-s-ink`}><ClipboardCheck size={15} aria-hidden /></span>{t('ovRecord')}</span>
          {total > 0 ? (
            <>
              <span className="mt-2 flex items-baseline gap-2">
                <span className="num text-[34px] font-bold leading-none tracking-tight"><span className="text-s-win">{record!.won}</span><span className="text-s-muted/70"> – </span><span className="text-s-loss">{record!.lost}</span></span>
                {hit != null && <span className="num rounded-md bg-s-win/12 px-1.5 py-0.5 text-[12px] font-bold text-s-win">%{hit}</span>}
              </span>
              <span className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-s-loss/25" role="img" aria-label={`${record!.won} ${tc('won')} · ${record!.lost} ${tc('lost')}`}>
                <span className="h-full rounded-full bg-s-win" style={{ width: `${Math.round((record!.won / total) * 100)}%` }} />
              </span>
            </>
          ) : (
            <span className={`${big} text-s-muted`}>–</span>
          )}
          <span className="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-s-loss">{t('ovMisses')} <ArrowRight size={14} aria-hidden /></span>
        </Link>
      </div>

      {later.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-s-muted">
          <span className="font-semibold text-s-ink">{t('ovNext')}:</span>
          {later.map((d) => (
            <Link
              key={d.date}
              href={`/predictions?date=${d.date}`}
              title={d.covered === 0 ? t('ovNone') : undefined}
              className={`chip chip-sm ${d.covered > 0 ? '!border-s-accent/40 !bg-s-accent-100 !text-s-accent-800' : '!opacity-60'}`}
            >
              {dayLabel(d.date)} <span className={`num ml-1 rounded-full px-1.5 text-[11px] font-bold leading-[18px] ${d.covered > 0 ? 'bg-s-accent text-white' : 'bg-s-raised text-s-muted'}`}>{d.covered}</span>
            </Link>
          ))}
          <span className="basis-full text-[12px]">{t('ovNextNote')}</span>
        </div>
      )}
    </section>
  );
}
