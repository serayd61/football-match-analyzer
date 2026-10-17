import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_URL } from '@/lib/seo';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { listPublicForDay } from '@/lib/site/match-public-data';
import { dayHubNeighbours, dayHubPath, namedHubFor, type DayHub as Hub } from '@/lib/site/day-hub';
import { zonedStartOfDay } from '@/lib/site/time';
import { Page, PageTitle, EmptyState } from '@/components/site/ui';
import PublicMatchList from '@/components/site/PublicMatchList';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, faqPageJsonLd, webPageJsonLd } from '@/lib/site/jsonld';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// Day hub (SEO Faz 1b, 2026-10-17): every covered fixture of one calendar day,
// grouped by league, with an auto-written summary line (count, leagues, first
// and last kick-off, settled verdicts) and a FAQ. Rendered by the /matches/[slug]
// route when the slug is today|tomorrow|yesterday|yyyy-mm-dd (lib/site/day-hub.ts).
// No model figure: the list is the public PublicMatch view.

const DATE_FMT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } as const;
const TIME_FMT = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' } as const;

export async function dayHubMetadata(locale: string, hub: Hub): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'dayHub' });
  const f = await getFormatter({ locale });
  const date = f.dateTime(zonedStartOfDay(hub.ymd), { day: 'numeric', month: 'long' });
  const rows = await listPublicForDay(hub.ymd).catch(() => []);
  const leagues = new Set(rows.map((r) => r.league?.slug)).size;
  const key = hub.kind === 'date' ? 'metaTitleDate' : hub.kind === 'today' ? 'metaTitleToday' : hub.kind === 'tomorrow' ? 'metaTitleTomorrow' : 'metaTitleYesterday';
  return {
    title: t(key, { date }),
    description: t('metaDescription', { count: rows.length, leagues, date }),
    alternates: alternatesFor(locale as Locale, dayHubPath(hub.ymd)),
  };
}

export default async function DayHub({ locale, hub }: { locale: string; hub: Hub }) {
  // A dated URL for today/tomorrow/yesterday has a named twin: send the visitor (and the crawler) there.
  if (hub.kind === 'date') {
    const named = namedHubFor(hub.ymd);
    if (named) redirect(`/${locale}/matches/${named}`);
  }
  const t = await getTranslations('dayHub');
  const th = await getTranslations('matches.hub');
  const tn = await getTranslations('nav');
  const tp = await getTranslations('paywall');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const rows = await listPublicForDay(hub.ymd).catch(() => []);
  const date = f.dateTime(zonedStartOfDay(hub.ymd), DATE_FMT);
  const leagueSlugs = [...new Set(rows.map((r) => r.league!.slug))];
  const first = rows[0], last = rows[rows.length - 1];
  const settled = rows.filter((r) => r.settled && r.homeScore != null);
  const verdicts = rows.filter((r) => r.verdict);
  const won = verdicts.filter((r) => r.verdict!.outcome === 'won').length;
  const updated = rows.reduce<string | null>((m, r) => (r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
  const path = dayHubPath(hub.ymd);
  const url = `${SITE_URL}/${locale}${path}`;
  const { prev, next } = dayHubNeighbours(hub.ymd);
  const title = hub.kind === 'date' ? t('titleDate', { date }) : t(hub.kind === 'today' ? 'titleToday' : hub.kind === 'tomorrow' ? 'titleTomorrow' : 'titleYesterday');

  const sentences: string[] = [];
  if (rows.length) {
    sentences.push(t('sCount', { count: rows.length, leagues: leagueSlugs.length, date }));
    if (first && last && first.fixtureId !== last.fixtureId) sentences.push(t('sFirstLast', { home: first.homeName, away: first.awayName, league: first.leagueName, time: f.dateTime(new Date(first.kickoff), TIME_FMT), lhome: last.homeName, laway: last.awayName, ltime: f.dateTime(new Date(last.kickoff), TIME_FMT) }));
    else if (first) sentences.push(t('sSingle', { home: first.homeName, away: first.awayName, league: first.leagueName, time: f.dateTime(new Date(first.kickoff), TIME_FMT) }));
    if (settled.length) sentences.push(verdicts.length ? t('sSettled', { settled: settled.length, won, n: verdicts.length }) : t('sSettledNoVerdict', { settled: settled.length }));
  }
  const faqs: Array<{ q: string; a: string }> = [];
  if (rows.length) {
    faqs.push({ q: t('faqCountQ', { date }), a: t('sCount', { count: rows.length, leagues: leagueSlugs.length, date }) + ' ' + t('faqCountA', { leagues: leagueSlugs.map((s) => SITE_LEAGUES.find((l) => l.slug === s)?.name ?? s).join(', ') }) });
    if (first) faqs.push({ q: t('faqFirstQ', { date }), a: t('faqFirstA', { home: first.homeName, away: first.awayName, league: first.leagueName, time: f.dateTime(new Date(first.kickoff), TIME_FMT) }) });
    faqs.push({ q: t('faqProbQ'), a: t('faqProbA') });
  }

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: th('title'), path: '/matches' }, { name: title, path }])} />
      <JsonLd data={webPageJsonLd(locale as Locale, { url, name: title, dateModified: updated })} />
      {faqs.length > 0 && <JsonLd data={faqPageJsonLd(faqs)} />}
      <PageTitle eyebrow={t('eyebrow')} title={title} lead={t('lead', { date })} aside={<Link href="/matches" className="text-xs underline underline-offset-4">{t('weekHub')}</Link>} />
      <nav className="flex flex-wrap items-center gap-2 pb-4 text-sm" aria-label={t('dayNav')}>
        {prev ? <Link href={prev} className="chip chip-sm" rel="prev">← {t('prevDay')}</Link> : <span className="chip chip-sm opacity-50">← {t('prevDay')}</span>}
        <Link href="/matches/yesterday" className="chip chip-sm" aria-current={hub.kind === 'yesterday' ? 'page' : undefined}>{tc('yesterday')}</Link>
        <Link href="/matches/today" className="chip chip-sm" aria-current={hub.kind === 'today' ? 'page' : undefined}>{tc('today')}</Link>
        <Link href="/matches/tomorrow" className="chip chip-sm" aria-current={hub.kind === 'tomorrow' ? 'page' : undefined}>{tc('tomorrow')}</Link>
        {next ? <Link href={next} className="chip chip-sm" rel="next">{t('nextDay')} →</Link> : <span className="chip chip-sm opacity-50">{t('nextDay')} →</span>}
      </nav>
      <div className="max-w-3xl space-y-2 pb-6 text-[15px] leading-relaxed">
        {sentences.map((s, i) => <p key={i}>{s}</p>)}
        <p className="text-xs text-s-muted">
          {th('tzNote')}
          {updated && <> · {th('updated', { time: f.dateTime(new Date(updated), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) })}</>}
        </p>
      </div>

      {rows.length ? <PublicMatchList rows={rows} groupBy="league" showLeague={false} /> : <EmptyState title={t('empty')} lead={t('emptyLead')} />}

      <aside className="rule-b-1 mt-8 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-labelledby="members-h">
        <div>
          <h2 id="members-h" className="text-[20px] font-extrabold">{tp('lockedTitle')}</h2>
          <p className="mt-1 max-w-lg text-[14px] text-s-muted">{th('lockedLead')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-primary" data-cta="day-hub-trial">{tp('lockedCta')}</Link>
          <Link href={SIGNIN_HREF} rel="nofollow" className="text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
        </div>
      </aside>

      {faqs.length > 0 && (
        <section className="mt-8 max-w-3xl" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-[20px]">{t('faqH')}</h2>
          <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
            {faqs.map((q, i) => <div key={i}><dt className="font-semibold">{q.q}</dt><dd className="text-s-muted">{q.a}</dd></div>)}
          </dl>
        </section>
      )}

      <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line pt-4 text-sm" aria-label={th('moreNav')}>
        <Link href="/matches" className="underline underline-offset-4">{t('weekHub')}</Link>
        {leagueSlugs.map((s) => { const l = SITE_LEAGUES.find((x) => x.slug === s); return l ? <Link key={s} href={`/leagues/${s}`} className="underline underline-offset-4">{l.name}</Link> : null; })}
        <Link href="/performance" className="underline underline-offset-4">{th('linkRecord')}</Link>
        <Link href="/glossary" className="underline underline-offset-4">{tn('glossary')}</Link>
      </nav>
    </Page>
  );
}
