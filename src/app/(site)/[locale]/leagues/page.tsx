import type { Metadata } from 'next';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd } from '@/lib/site/jsonld';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { getPerformance } from '@/lib/site/performance';
import { Page, PageTitle } from '@/components/site/ui';

export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'leagues' });
  return { title: t('title'), description: t('lead', { count: SITE_LEAGUES.length }), alternates: alternatesFor(locale as Locale, '/leagues') };
}

export default async function LeaguesPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('leagues');
  const f = await getFormatter();
  const perf = await getPerformance(null);
  const stats = new Map(perf.leagues.map((l) => [l.league.slug, l]));

  // v3: one card per league (name, country, hit rate, W–L, sample bar). Grouped by country order of SITE_LEAGUES.
  const tn = await getTranslations('nav');
  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: t('title'), path: '/leagues' }])} />
      <PageTitle title={t('title')} lead={t('lead', { count: SITE_LEAGUES.length })} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SITE_LEAGUES.map((l) => {
          const s = stats.get(l.slug);
          const acc = s?.acc ?? null;
          const tone = acc == null || !s || s.n < 10 ? '' : acc >= 0.55 ? 'text-s-win' : acc < 0.45 ? 'text-s-loss' : '';
          return (
            <li key={l.slug}>
              <Link href={`/leagues/${l.slug}`} className="card card-hover !gap-3 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px]">{l.name}</h2>
                    <p className="text-[13px] text-s-muted">{l.country}</p>
                  </div>
                  <span className={`num shrink-0 text-[24px] font-bold leading-none ${tone}`}>{acc != null ? f.number(acc, 'percent1') : '–'}</span>
                </div>
                <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-s-raised" aria-hidden>
                  {s && s.n > 0 && <span className="bg-s-accent" style={{ width: `${Math.round((s.won / s.n) * 100)}%` }} />}
                </div>
                <dl className="num flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-s-muted">
                  <div><dt className="inline">{t('settled')}: </dt><dd className="inline font-semibold text-s-ink">{s ? f.number(s.n) : '0'}</dd></div>
                  <div><dt className="inline">{t('record')}: </dt><dd className="inline font-semibold text-s-ink">{s ? `${s.won}–${s.n - s.won}` : '–'}</dd></div>
                  <div><dt className="inline">{t('brier')}: </dt><dd className="inline">{s?.brier != null ? s.brier.toFixed(3) : '–'}</dd></div>
                </dl>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-s-muted">{t('note')}</p>
    </Page>
  );
}
