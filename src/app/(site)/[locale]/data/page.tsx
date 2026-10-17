import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { listOpenDataRows } from '@/lib/site/open-data-data';
import { countByLeague, openDataPath, OPEN_DATA_ALL, OPEN_DATA_COLUMNS, OPEN_DATA_LICENSE, OPEN_DATA_LICENSE_NAME, OPEN_DATA_SINCE } from '@/lib/site/open-data';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, faqPageJsonLd, openDatasetJsonLd } from '@/lib/site/jsonld';

// Open data (SEO Faz 2.1, 2026-10-17): the settled prediction record as CSV/JSON,
// one file per league plus everything, under CC BY 4.0 with a link-back
// attribution. The page documents columns, licence, citation and the caveats;
// the files themselves are served by app/data/[file]/route.ts. Settled data
// only, no session → ISR (1 h), same window as the files.
export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'openData' });
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: alternatesFor(locale as Locale, '/data') };
}

const SNIPPET_PY = `import pandas as pd
df = pd.read_csv("https://footballanalytics.pro/data/all.csv")
df["brier"] = ((df.result == "1") - df.p_home) ** 2 + ((df.result == "X") - df.p_draw) ** 2 + ((df.result == "2") - df.p_away) ** 2
print(df.groupby("league").brier.mean())`;
const SNIPPET_R = `df <- read.csv("https://footballanalytics.pro/data/all.csv")
mean(df$pick_correct, na.rm = TRUE)`;

export default async function OpenDataPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('openData');
  const tn = await getTranslations('nav');
  const f = await getFormatter();
  const rows = await listOpenDataRows().catch(() => []);
  const counts = countByLeague(rows);
  const first = rows[0]?.kickoff_utc ?? null;
  const last = rows.length ? rows[rows.length - 1].kickoff_utc : null;
  const leaguesWithData = SITE_LEAGUES.filter((l) => (counts[l.slug] ?? 0) > 0);
  const files = [{ name: t('allLeagues'), slug: OPEN_DATA_ALL, rows: rows.length }, ...leaguesWithData.map((l) => ({ name: l.name, slug: l.slug, rows: counts[l.slug] }))];
  const day = (iso: string) => f.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });
  const caveats = t.raw('caveats') as string[];
  const faqs = (t.raw('faqs') as Array<{ q: string; a: string }>);
  const cols = t.raw('cols') as Record<string, string>;
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';
  const year = new Date().getUTCFullYear();
  const citation = t('citation', { year, url: 'https://footballanalytics.pro/data' });

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: t('title'), path: '/data' }])} />
      {rows.length > 0 && <JsonLd data={openDatasetJsonLd(locale as Locale, { name: t('metaTitle'), description: t('metaDescription'), rows: rows.length, dateModified: last ? new Date(last) : null, license: OPEN_DATA_LICENSE, since: OPEN_DATA_SINCE, files: files.map((x) => ({ name: x.name, csv: openDataPath(x.slug, 'csv'), json: openDataPath(x.slug, 'json') })) })} />}
      <JsonLd data={faqPageJsonLd(faqs)} />
      <PageTitle eyebrow={t('eyebrow')} title={t('h1')} lead={t('lead')} aside={<Link href="/performance" className="text-xs underline underline-offset-4">{t('recordLink')}</Link>} />

      <div className="max-w-3xl space-y-3 pb-6 text-[15px] leading-relaxed">
        {rows.length > 0 && first && last ? <p>{t('statsLine', { n: f.number(rows.length), leagues: leaguesWithData.length, from: day(first), to: day(last) })}</p> : <p className="text-s-muted">{t('empty')}</p>}
        <p>{t('intro')}</p>
      </div>

      <section className="mt-2" aria-labelledby="dl-h">
        <SectionTitle id="dl-h" title={t('downloadsH')} />
        <div className="tbl-scroll mt-3">
          <table className="w-full max-w-3xl text-sm">
            <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('colFile')}</th><th className={`${th} text-right`}>{t('colRows')}</th><th className={`${th} text-right`}>CSV</th><th className={`${th} text-right`}>JSON</th></tr></thead>
            <tbody>
              {files.map((x) => (
                <tr key={x.slug} className="border-b border-s-line">
                  <td className="py-1.5">{x.slug === OPEN_DATA_ALL ? <strong>{x.name}</strong> : <Link href={`/leagues/${x.slug}`} className="hover:underline underline-offset-4">{x.name}</Link>}</td>
                  <td className="num py-1.5 text-right">{f.number(x.rows)}</td>
                  <td className="py-1.5 text-right"><a href={openDataPath(x.slug, 'csv')} className="underline underline-offset-4" download>{`${x.slug}.csv`}</a></td>
                  <td className="py-1.5 text-right"><a href={openDataPath(x.slug, 'json')} className="underline underline-offset-4">{`${x.slug}.json`}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs text-s-muted">{t('downloadsNote')}</p>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="cols-h">
        <SectionTitle id="cols-h" title={t('columnsH')} />
        <div className="tbl-scroll mt-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('colName')}</th><th className={th}>{t('colDesc')}</th></tr></thead>
            <tbody>
              {OPEN_DATA_COLUMNS.map((c) => (
                <tr key={c} className="border-b border-s-line align-top"><td className="py-1.5 pr-4"><code className="text-[13px]">{c}</code></td><td className="py-1.5">{cols[c]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="use-h">
        <SectionTitle id="use-h" title={t('useH')} />
        <p className="mt-3 text-[15px] leading-relaxed">{t('useP')}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-s-line bg-s-surface p-3 text-[13px] leading-relaxed"><code>{SNIPPET_PY}</code></pre>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-s-line bg-s-surface p-3 text-[13px] leading-relaxed"><code>{SNIPPET_R}</code></pre>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="lic-h">
        <SectionTitle id="lic-h" title={t('licenseH')} />
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <p>{t('licenseP1', { license: OPEN_DATA_LICENSE_NAME })} <a href={OPEN_DATA_LICENSE} rel="license noopener" target="_blank" className="underline underline-offset-4">{OPEN_DATA_LICENSE_NAME}</a>.</p>
          <p>{t('licenseP2')}</p>
          <p className="text-xs uppercase tracking-wider text-s-muted">{t('citeLabel')}</p>
          <blockquote className="rounded-lg border border-s-line bg-s-surface p-3 text-sm">{citation}</blockquote>
        </div>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="cav-h">
        <SectionTitle id="cav-h" title={t('caveatsH')} />
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
          {caveats.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </section>

      <section className="mt-10 max-w-3xl" aria-labelledby="faq-h">
        <SectionTitle id="faq-h" title={t('faqH')} />
        <dl className="mt-3 space-y-4 text-[15px] leading-relaxed">
          {faqs.map((x, i) => <div key={i}><dt className="font-semibold">{x.q}</dt><dd className="mt-1">{x.a}</dd></div>)}
        </dl>
      </section>

      <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm" aria-label={t('moreNav')}>
        <Link href="/performance" className="underline underline-offset-4">{tn('performance')}</Link>
        <Link href="/methodology" className="underline underline-offset-4">{tn('methodology')}</Link>
        <Link href="/glossary" className="underline underline-offset-4">{tn('glossary')}</Link>
        <Link href="/leagues" className="underline underline-offset-4">{tn('leagues')}</Link>
      </nav>
    </Page>
  );
}
