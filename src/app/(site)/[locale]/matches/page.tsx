import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { listPublicUpcoming, listPublicRecent } from '@/lib/site/match-public-data';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import PublicMatchList from '@/components/site/PublicMatchList';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd } from '@/lib/site/jsonld';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// Herkese açık maç merkezi (SEO, 2026-10-10): kapsamdaki liglerin önümüzdeki
// 7 gününün fikstürü + son 3 günün sonuçları, her satır /matches/{slug} ön
// izlemesine gider. Üyelik gerekmez, oturum okunmaz → ISR (15 dk). Model
// olasılıkları burada yok; /predictions akışı ve paywall aynen kalır.
export const revalidate = 900;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'matches.hub' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription', { count: SITE_LEAGUES.length }),
    alternates: alternatesFor(locale as Locale, '/matches'),
  };
}

export default async function MatchesHubPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('matches.hub');
  const tn = await getTranslations('nav');
  const tp = await getTranslations('paywall');
  const f = await getFormatter();
  const [upcoming, recent] = await Promise.all([
    listPublicUpcoming(7).catch(() => []),
    listPublicRecent(3, 60).catch(() => []),
  ]);
  // Son veri yazımı (satırların updated_at'i) — "şimdi" değil, gerçek güncelleme.
  const updated = [...upcoming, ...recent].reduce<string | null>((m, r) => (r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: t('title'), path: '/matches' }])} />
      <PageTitle title={t('title')} lead={t('lead', { count: SITE_LEAGUES.length })} aside={<Link href="/leagues" className="text-xs underline underline-offset-4">{tn('leagues')}</Link>} />
      <p className="pb-6 text-xs text-s-muted">
        {t('tzNote')}
        {updated && <> · {t('updated', { time: f.dateTime(new Date(updated), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) })}</>}
      </p>

      <section aria-labelledby="upcoming-h">
        <SectionTitle id="upcoming-h" title={t('upcomingH')} sub={t('upcomingSub')} />
        <div className="mt-4">
          {upcoming.length ? <PublicMatchList rows={upcoming} groupBy="day" /> : <EmptyState title={t('empty')} lead={t('emptyLead')} />}
        </div>
      </section>

      <aside className="rule-b-1 mt-8 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-labelledby="members-h">
        <div>
          <h2 id="members-h" className="text-[20px] font-extrabold">{tp('lockedTitle')}</h2>
          <p className="mt-1 max-w-lg text-[14px] text-s-muted">{t('lockedLead')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={REGISTER_HREF} className="btn btn-primary" data-cta="matches-hub-trial">{tp('lockedCta')}</Link>
          <Link href={SIGNIN_HREF} className="text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
        </div>
      </aside>

      {recent.length > 0 && (
        <section className="mt-10" aria-labelledby="recent-h">
          <SectionTitle id="recent-h" title={t('recentH')} sub={t('recentSub')} meta={<Link href="/performance" className="underline underline-offset-4">{tn('performance')}</Link>} />
          <div className="mt-4"><PublicMatchList rows={recent} groupBy="day" /></div>
        </section>
      )}

      <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line pt-4 text-sm" aria-label={t('moreNav')}>
        <Link href="/leagues" className="underline underline-offset-4">{t('linkLeagues')}</Link>
        <Link href="/methodology" className="underline underline-offset-4">{t('linkMethod')}</Link>
        <Link href="/performance" className="underline underline-offset-4">{t('linkRecord')}</Link>
      </nav>
    </Page>
  );
}
