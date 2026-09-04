import type { Metadata } from 'next';
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
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const perf = await getPerformance(null);
  const stats = new Map(perf.leagues.map((l) => [l.league.slug, l]));
  const th = 'py-1.5 text-[11px] font-medium uppercase tracking-wider text-s-muted';

  return (
    <Page>
      <PageTitle title={t('title')} lead={t('lead', { count: SITE_LEAGUES.length })} />
      <div className="tbl-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-s-line text-left">
              <th className={th}>{tc('league')}</th>
              <th className={th}>{t('country')}</th>
              <th className={`${th} text-right`}>{t('settled')}</th>
              <th className={`${th} text-right`}>{t('record')}</th>
              <th className={`${th} text-right`}>{t('hitRate')}</th>
              <th className={`${th} text-right`}>{t('brier')}</th>
            </tr>
          </thead>
          <tbody>
            {SITE_LEAGUES.map((l) => {
              const s = stats.get(l.slug);
              return (
                <tr key={l.slug} className="border-b border-s-line">
                  <td className="py-2"><Link href={`/leagues/${l.slug}`} className="font-medium hover:underline underline-offset-4">{l.name}</Link></td>
                  <td className="py-2 text-s-muted">{l.country}</td>
                  <td className="num py-2 text-right">{s ? f.number(s.n) : '0'}</td>
                  <td className="num py-2 text-right">{s ? `${s.won}–${s.n - s.won}` : '–'}</td>
                  <td className="num py-2 text-right">{s?.acc != null ? f.number(s.acc, 'percent1') : '–'}</td>
                  <td className="num py-2 text-right text-s-muted">{s?.brier != null ? s.brier.toFixed(3) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-s-muted">{t('note')}</p>
    </Page>
  );
}
