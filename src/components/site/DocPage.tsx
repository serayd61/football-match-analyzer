import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { Page, PageTitle } from '@/components/site/ui';

// Long-form pages (methodology, about, privacy, terms). Content lives in
// messages/*.json as { title, lead, updated?, sections: [{ h, p: [] }] } so
// every locale carries a complete, independently reviewable text.
export type DocKey = 'methodology' | 'about' | 'privacy' | 'terms';
export interface DocSection { h: string; p: string[] }

export async function docMetadata(locale: string, key: DocKey): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `docs.${key}` });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, `/${key}`) };
}

export default async function DocPage({ locale, doc, updated }: { locale: string; doc: DocKey; updated?: string }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations(`docs.${doc}`);
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const sections = t.raw('sections') as DocSection[];

  return (
    <Page>
      <div className="max-w-3xl">
      <PageTitle title={t('title')} lead={t('lead')} />
      {updated && <p className="text-xs text-s-muted">{tc('lastUpdated')}: {f.dateTime(new Date(`${updated}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      <nav aria-label={tc('contents')} className="mt-6 border-y border-s-line py-3 text-sm">
        <ol className="grid gap-1 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={i}><a href={`#s${i + 1}`} className="text-s-muted hover:text-s-ink hover:underline underline-offset-4">{s.h}</a></li>
          ))}
        </ol>
      </nav>
      <div className="mt-8 space-y-10">
        {sections.map((s, i) => (
          <section key={i} id={`s${i + 1}`} className="scroll-mt-20">
            <h2 className="text-2xl">{s.h}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
              {s.p.map((para, j) => (
                para.startsWith('- ') ? (
                  <ul key={j} className="list-disc space-y-1 pl-5">
                    {para.slice(2).split('\n- ').map((li, k) => <li key={k}>{li}</li>)}
                  </ul>
                ) : (
                  <p key={j}>{para}</p>
                )
              ))}
            </div>
          </section>
        ))}
      </div>
      </div>
    </Page>
  );
}
