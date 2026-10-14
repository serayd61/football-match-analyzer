import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { couponPageData, type StoredCoupon } from '@/lib/site/coupon';
import { couponHit, couponRoi, legLabel, TARGET_MIN, TARGET_MAX, type CouponLeg } from '@/lib/site/coupon-rule';
import { todayYmd } from '@/lib/site/time';
import { requireSiteAccess } from '@/lib/site/access';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { StatRow, StatCell } from '@/components/site/StatCell';
import { Paywall, TrialNotice } from '@/components/site/Paywall';
import LocalTime from '@/components/site/LocalTime';

// Günün kuponu (2026-10-14): önerilen seçimlerden iki bacak, toplam oran 2,0–2,6;
// 07:30 UTC'de üretilir ve donar, skorla sonuçlanır, Telegram'a gider. Üyelere özel.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'coupon' });
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: alternatesFor(locale as Locale, '/coupon'), robots: { index: false, follow: false } };
}

const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const pp = (x: number | null) => { if (x == null) return '–'; const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`; };

export default async function CouponPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const today = todayYmd();
  const access = await requireSiteAccess(locale, '/coupon');
  const [t, f] = await Promise.all([getTranslations('coupon'), getFormatter()]);
  if (access.state === 'expired') {
    return (<Page><div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div><Paywall /></Page>);
  }
  const { today: coupon, history, record } = await couponPageData(today);
  const lang = locale === 'tr' ? 'tr' : 'en';
  const fo = (o: number) => f.number(o, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusLabel = (s: StoredCoupon['status']) => ({ pending: t('statusPending'), won: t('statusWon'), lost: t('statusLost'), void: t('statusVoid') })[s];
  const statusTone = (s: StoredCoupon['status']) => (s === 'won' ? 'bg-s-win text-white' : s === 'lost' ? 'bg-s-loss text-white' : 'border border-s-line text-s-muted');
  const dateLabel = (ymd: string) => f.dateTime(new Date(`${ymd}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' });
  const roi = couponRoi(record);

  const Legs = ({ legs, from }: { legs: CouponLeg[]; from: string }) => (
    <table className="text-sm">
      <thead className="text-xs uppercase tracking-wider text-s-muted">
        <tr className="border-b border-s-line">
          <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
          <th className="py-1.5 text-left font-medium">{t('colSelection')}</th>
          <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
          <th className="py-1.5 text-right font-medium">{t('colOdds')}</th>
          <th className="py-1.5 text-right font-medium">{t('colResult')}</th>
        </tr>
      </thead>
      <tbody>
        {legs.map((l) => (
          <tr key={l.fixtureId} className="border-b border-s-line">
            <td className="py-2.5 pr-3">
              <Link href={`/predictions/${l.fixtureId}?back=${encodeURIComponent(from)}`} className="hover:underline">{l.homeName} – {l.awayName}</Link>
              <span className="mt-0.5 block text-xs text-s-muted">{l.leagueLabel} · <LocalTime iso={l.kickoff} format="time" /></span>
            </td>
            <td className="py-2.5 pr-3 font-semibold">{legLabel(l, lang)}</td>
            <td className="num py-2.5 pr-3 text-right">{pct(l.p)}</td>
            <td className="num py-2.5 pr-3 text-right font-semibold">{fo(l.odds)}</td>
            <td className="num py-2.5 text-right">
              {l.homeScore != null && l.awayScore != null ? <span>{l.homeScore}–{l.awayScore} <span className={l.won ? 'text-s-win' : 'text-s-loss'}>{l.won ? '✓' : '✗'}</span></span> : <span className="text-xs text-s-muted">{t('statusPending')}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <Page>
      <div className="pt-5"><TrialNotice access={access} /></div>
      <PageTitle eyebrow={`${t('eyebrow')} · ${dateLabel(today)}`} title={t('title')} lead={t('lead', { min: fo(TARGET_MIN), max: fo(TARGET_MAX) })} />

      <StatRow cols={4} className="mb-8">
        <StatCell first label={t('statCoupons')} value={record.n} note={t('statCouponsNote', { pending: record.pending })} />
        <StatCell label={t('statHit')} value={pct(couponHit(record))} note={t('statHitNote', { won: record.won, n: record.n })} tone={record.n ? 'accent' : 'muted'} />
        <StatCell label={t('statRoi')} value={pp(roi)} note={t('statRoiNote')} tone={roi == null ? 'muted' : roi >= 0 ? 'accent' : undefined} />
        <StatCell label={t('statLegs')} value={pct(record.legsN ? record.legsWon / record.legsN : null)} note={t('statLegsNote', { won: record.legsWon, n: record.legsN })} tone="muted" />
      </StatRow>

      <section aria-labelledby="coupon-today">
        <SectionTitle id="coupon-today" title={t('todayTitle')} meta={coupon ? <span className="num">{t('totalOdds')} {fo(coupon.totalOdds)} · <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusTone(coupon.status)}`}>{statusLabel(coupon.status)}</span></span> : undefined} />
        {coupon ? (
          <div className="tbl-scroll mt-3"><Legs legs={coupon.legs} from="from=coupon" /></div>
        ) : (
          <div className="mt-3"><EmptyState title={t('emptyTitle')} lead={t('emptyLead')} action={<Link href="/picks" className="btn btn-secondary btn-sm">{t('toPicks')}</Link>} /></div>
        )}
        <p className="mt-3 max-w-3xl text-xs text-s-muted">{t('todayNote')}</p>
      </section>

      <section className="mt-14" aria-labelledby="coupon-history">
        <SectionTitle id="coupon-history" title={t('historyTitle')} sub={t('historyLead')} />
        {history.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-s-muted">{t('historyEmpty')}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-8">
            {history.map((c) => (
              <section key={c.date}>
                <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-s-line pb-2 text-[15px] font-bold text-s-ink">
                  <span>{dateLabel(c.date)}</span>
                  <span className="num text-[13px] font-semibold text-s-muted">{t('totalOdds')} {fo(c.totalOdds)}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusTone(c.status)}`}>{statusLabel(c.status)}</span>
                </h3>
                <div className="tbl-scroll"><Legs legs={c.legs} from="from=coupon" /></div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-10 !gap-2 text-[13.5px] text-s-muted">
        <h2 className="text-[15px] font-bold text-s-ink">{t('howTitle')}</h2>
        <p>{t('howRule', { min: fo(TARGET_MIN), max: fo(TARGET_MAX) })}</p>
        <p>{t('howRecord')}</p>
        <p>{t('howTelegram')} <a href="https://t.me/fanalytics_pro" className="font-semibold text-s-ink hover:underline" rel="noopener" target="_blank">@fanalytics_pro</a></p>
      </section>
    </Page>
  );
}
