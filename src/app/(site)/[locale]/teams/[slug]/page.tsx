import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_URL } from '@/lib/seo';
import { leagueCountryName } from '@/lib/site/countries';
import { getTeamBySlug, listTeams, listPublicForTeam } from '@/lib/site/team-data';
import { teamPath } from '@/lib/site/teams';
import { matchPath, formLetters, teamGoalStats, type PublicMatch } from '@/lib/site/match-public';
import { getStandings, type StandingRow } from '@/lib/site/standings';
import { venueFor } from '@/lib/site/stadiums';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import { Crest } from '@/components/site/PredictionTable';
import PublicMatchList from '@/components/site/PublicMatchList';
import LocalTime from '@/components/site/LocalTime';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, faqPageJsonLd, sportsTeamJsonLd, webPageJsonLd } from '@/lib/site/jsonld';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// ============================================================================
// Club page (SEO Faz 1b, 2026-10-17): /[locale]/teams/{slug}. Public facts only
// — table position, next fixtures, latest results, form, goals per match and
// the model's SETTLED record on the club's matches (settled verdicts are public
// since Faz 1a; upcoming predictions stay members-only). Auto-written sentences
// per club + FAQ + SportsTeam JSON-LD. No session read → ISR (30 min).
// ============================================================================
export const revalidate = 1800;

type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = await getTeamBySlug(params.slug);
  if (!team) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'team' });
  return {
    title: { absolute: t('metaTitle', { team: team.name }) },
    description: t('metaDescription', { team: team.name, league: team.league.name }),
    alternates: alternatesFor(params.locale as Locale, teamPath(team)),
  };
}

const score = (r: { homeScore: number | null; awayScore: number | null }) => (r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : '–');

export default async function TeamPage({ params }: { params: Params }) {
  unstable_setRequestLocale(params.locale);
  const team = await getTeamBySlug(params.slug);
  if (!team) notFound();
  const t = await getTranslations('team');
  const tm = await getTranslations('matches.match');
  const tn = await getTranslations('nav');
  const tp = await getTranslations('paywall');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const league = team.league;
  const [all, table, teams] = await Promise.all([
    listPublicForTeam(team.id).catch(() => [] as PublicMatch[]),
    getStandings(league.slug).catch(() => [] as StandingRow[]),
    listTeams().catch(() => []),
  ]);
  const now = Date.now();
  const results = all.filter((r) => r.settled && r.homeScore != null && r.awayScore != null).reverse(); // newest first
  const upcoming = all.filter((r) => !r.settled && Date.parse(r.kickoff) > now - 2 * 3600e3);
  const next = upcoming[0] ?? null;
  const row = table.find((r) => r.teamId === team.id) ?? null;
  const last10 = results.slice(0, 10);
  const letters = formLetters(team.id, results.slice(0, 5));
  const goals = teamGoalStats(team.id, last10);
  const verdicts = results.filter((r) => r.verdict);
  const won = verdicts.filter((r) => r.verdict!.outcome === 'won').length;
  const venue = venueFor(team.id);
  const updated = all.reduce<string | null>((m, r) => (r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
  const url = `${SITE_URL}/${params.locale}${teamPath(team)}`;
  const fmtLetters = (ls: Array<'W' | 'D' | 'L'>) => ls.map((l) => tm(`form${l}`)).join(' ');
  const dec = (x: number) => f.number(x, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const pct0 = (x: number) => f.number(x, 'percent0');
  const nextDate = next ? f.dateTime(new Date(next.kickoff), { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const nextVenue = next && next.homeId ? venueFor(next.homeId) : null;

  // Auto-written summary: position, form, next fixture, goals, settled record.
  const sentences: string[] = [];
  if (row) sentences.push(t('sPosition', { team: team.name, pos: row.pos, league: league.name, played: row.played, pts: row.pts, w: row.won, d: row.drawn, l: row.lost, gf: row.gf, ga: row.ga }));
  if (letters.length >= 3) sentences.push(t('sForm', { team: team.name, n: letters.length, form: fmtLetters(letters) }));
  if (next) sentences.push(t('sNext', { home: next.homeName, away: next.awayName, league: next.leagueName, date: nextDate, venue: nextVenue ? t('venueAt', { venue: nextVenue.venue }) : '' }));
  if (goals && goals.n >= 5) sentences.push(t('sGoals', { team: team.name, n: goals.n, gf: dec(goals.gfAvg), ga: dec(goals.gaAvg), over: pct0(goals.over25), btts: pct0(goals.btts) }));
  sentences.push(verdicts.length >= 3 ? t('sRecord', { team: team.name, won, n: verdicts.length, acc: pct0(won / verdicts.length) }) : t('sRecordNone', { team: team.name }));

  const faqs: Array<{ q: string; a: string }> = [];
  if (next) faqs.push({ q: t('faqNextQ', { team: team.name }), a: t('sNext', { home: next.homeName, away: next.awayName, league: next.leagueName, date: nextDate, venue: nextVenue ? t('venueAt', { venue: nextVenue.venue }) : '' }) });
  if (letters.length >= 3) faqs.push({ q: t('faqFormQ', { team: team.name }), a: t('sForm', { team: team.name, n: letters.length, form: fmtLetters(letters) }) });
  if (row) faqs.push({ q: t('faqPosQ', { team: team.name, league: league.name }), a: t('sPosition', { team: team.name, pos: row.pos, league: league.name, played: row.played, pts: row.pts, w: row.won, d: row.drawn, l: row.lost, gf: row.gf, ga: row.ga }) });
  if (verdicts.length >= 3) faqs.push({ q: t('faqRecordQ', { team: team.name }), a: t('sRecord', { team: team.name, won, n: verdicts.length, acc: pct0(won / verdicts.length) }) });

  const siblings = teams.filter((x) => x.league.slug === league.slug && x.id !== team.id);

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: tn('teams'), path: '/teams' }, { name: team.name, path: teamPath(team) }])} />
      <JsonLd data={sportsTeamJsonLd(params.locale as Locale, { url, name: team.name, crest: team.crest, league, venue: venue ? { name: venue.venue, city: venue.city ?? null } : null })} />
      <JsonLd data={webPageJsonLd(params.locale as Locale, { url, name: t('h1', { team: team.name }), dateModified: updated })} />
      {faqs.length > 0 && <JsonLd data={faqPageJsonLd(faqs)} />}
      <PageTitle
        eyebrow={`${league.name} · ${leagueCountryName(league, params.locale)}`}
        title={t('h1', { team: team.name })}
        lead={t('lead', { team: team.name, league: league.name })}
        aside={<Link href={`/leagues/${league.slug}`} className="text-xs underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>}
      />
      <div className="flex items-center gap-3 pb-4"><Crest src={team.crest} alt={tc('crestAlt', { team: team.name })} /><span className="text-sm text-s-muted">{venue ? t('homeVenue', { venue: venue.venue }) : league.name}</span></div>
      <div className="max-w-3xl space-y-2 pb-6 text-[15px] leading-relaxed">
        {sentences.map((s, i) => <p key={i}>{s}</p>)}
        {updated && <p className="text-xs text-s-muted">{tm('updated', { time: f.dateTime(new Date(updated), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) })}</p>}
      </div>

      {row && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-s-line py-5 sm:grid-cols-5">
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('statPos')}</dt><dd className="num mt-0.5 text-[22px] font-bold">{row.pos}.</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('statPts')}</dt><dd className="num mt-0.5 text-[22px] font-bold">{row.pts}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('statWdl')}</dt><dd className="num mt-0.5 text-[22px] font-bold">{row.won}–{row.drawn}–{row.lost}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('statGoals')}</dt><dd className="num mt-0.5 text-[22px] font-bold">{row.gf}–{row.ga}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('statForm')}</dt><dd className="mt-1 flex gap-1">{letters.length ? letters.map((l, i) => <span key={i} className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${l === 'W' ? 'bg-s-win' : l === 'D' ? 'bg-s-void' : 'bg-s-loss'}`}>{tm(`form${l}`)}</span>) : '–'}</dd></div>
        </dl>
      )}

      <section className="mt-10" aria-labelledby="upcoming-h">
        <SectionTitle id="upcoming-h" title={t('upcomingH')} sub={t('upcomingSub')} meta={<Link href="/matches" className="underline underline-offset-4">{tm('backHub')}</Link>} />
        <div className="mt-4">{upcoming.length ? <PublicMatchList rows={upcoming.slice(0, 8)} groupBy="day" /> : <p className="text-sm text-s-muted">{t('upcomingEmpty')}</p>}</div>
      </section>

      <aside className="rule-b-1 mt-8 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-labelledby="members-h">
        <div>
          <h2 id="members-h" className="text-[20px] font-extrabold">{tp('lockedTitle')}</h2>
          <p className="mt-1 max-w-lg text-[14px] text-s-muted">{t('membersLead', { team: team.name })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-primary" data-cta="team-trial">{tp('lockedCta')}</Link>
          <Link href={SIGNIN_HREF} rel="nofollow" className="text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
        </div>
      </aside>

      {results.length > 0 && (
        <section className="mt-10" aria-labelledby="results-h">
          <SectionTitle id="results-h" title={t('resultsH')} sub={t('resultsSub')} meta={<Link href={`/leagues/${league.slug}/results`} className="underline underline-offset-4">{t('archive', { league: league.name })}</Link>} />
          <div className="tbl-scroll mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-s-line text-left text-xs font-medium uppercase tracking-wider text-s-muted"><th className="py-1.5">{t('colDate')}</th><th className="py-1.5">{t('colMatch')}</th><th className="py-1.5 text-right">{t('colScore')}</th><th className="hidden py-1.5 sm:table-cell">{t('colPick')}</th><th className="py-1.5 text-right">{t('colOutcome')}</th></tr></thead>
              <tbody>
                {results.slice(0, 15).map((r) => {
                  const v = r.verdict;
                  const pickName = v ? (v.pick === '1' ? r.homeName : v.pick === '2' ? r.awayName : tc('draw')) : null;
                  return (
                    <tr key={r.fixtureId} className="border-b border-s-line">
                      <td className="py-1.5 text-xs text-s-muted"><LocalTime iso={r.kickoff} format="dayShort" /></td>
                      <td className="py-1.5"><Link href={matchPath(r)} className="hover:underline underline-offset-4">{r.homeName} – {r.awayName}</Link> <span className="text-xs text-s-muted">{r.leagueName}</span></td>
                      <td className="num py-1.5 text-right font-semibold">{score(r)}</td>
                      <td className="hidden py-1.5 text-s-muted sm:table-cell">{v ? `${pickName} · ${f.number(v.p, 'percent0')}` : '–'}</td>
                      <td className="py-1.5 text-right">{v ? <span className={`tag ${v.outcome === 'won' ? 'tag-win' : 'tag-loss'}`}>{v.outcome === 'won' ? tc('won') : tc('lost')}</span> : <span className="text-s-muted">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-s-muted">{t('recordNote')} <Link href={`/performance/${league.slug}`} className="underline underline-offset-4">{t('recordLink', { league: league.name })}</Link></p>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="mt-10 max-w-3xl" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-[20px]">{t('faqH')}</h2>
          <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
            {faqs.map((q, i) => <div key={i}><dt className="font-semibold">{q.q}</dt><dd className="text-s-muted">{q.a}</dd></div>)}
          </dl>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mt-10 border-t border-s-line pt-6">
          <SectionTitle title={t('otherTeams', { league: league.name })} />
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {siblings.map((x) => <li key={x.id}><Link href={teamPath(x)} className="chip">{x.name}</Link></li>)}
          </ul>
        </section>
      )}
      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm" aria-label={tm('moreNav')}>
        <Link href="/teams" className="underline underline-offset-4">{tn('teams')}</Link>
        <Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>
        <Link href={`/performance/${league.slug}`} className="underline underline-offset-4">{t('recordLink', { league: league.name })}</Link>
        <Link href="/methodology" className="underline underline-offset-4">{tm('methodLink')}</Link>
        <Link href="/glossary" className="underline underline-offset-4">{tn('glossary')}</Link>
      </nav>
    </Page>
  );
}
