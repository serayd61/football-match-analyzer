import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { getPublicMatch, listPublicUpcoming } from '@/lib/site/match-public-data';
import { fixtureIdFromSlug, isCanonicalSlug, matchPath, formLetters, h2hTally, type PublicMatch } from '@/lib/site/match-public';
import { getHeadToHead, getTeamForm, type SitePrediction } from '@/lib/site/predictions';
import { getStandings, type StandingRow } from '@/lib/site/standings';
import { venueFor } from '@/lib/site/stadiums';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { isTwa } from '@/lib/site/twa';
import { Page, SectionTitle } from '@/components/site/ui';
import { Crest, StatusChip } from '@/components/site/PredictionTable';
import LocalTime from '@/components/site/LocalTime';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, sportsEventsJsonLd } from '@/lib/site/jsonld';
import PublicMatchList from '@/components/site/PublicMatchList';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';
import { SITE_URL } from '@/lib/seo';

// ============================================================================
// Herkese açık maç ön izlemesi (SEO, 2026-10-10)
// URL: /[locale]/matches/{ev}-vs-{deplasman}-{fixtureId}. Kimlik sondaki sayı;
// slug kanonik değilse 308 ile kanoniğe gider (aynı maç tek URL).
// Gösterilen: lig, başlama (saat dilimiyle), stat, puan durumu, son beş maç,
// geçmiş karşılaşmalar, bittiyse skor. GÖSTERİLMEYEN: olasılık, seçim, güven,
// gol beklentisi, pazarlar, seçimin tuttu/tutmadı bilgisi — hepsi /predictions
// altında, üyelik kuralı değişmedi (lib/site/match-public.ts tek kapı).
// Oturum yalnız "tam tahmini aç" bağlantısı için okunur; içerik herkese aynı.
// ============================================================================
export const dynamic = 'force-dynamic';

type Params = { locale: string; slug: string };

async function load(slug: string): Promise<PublicMatch | null> {
  const id = fixtureIdFromSlug(slug);
  return id ? getPublicMatch(id) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const m = await load(params.slug);
  if (!m) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'matches.match' });
  const f = await getFormatter({ locale: params.locale });
  const date = f.dateTime(new Date(m.kickoff), { day: 'numeric', month: 'short', year: 'numeric' });
  const played = m.settled && m.homeScore != null && m.awayScore != null;
  const vars = { home: m.homeName, away: m.awayName, league: m.leagueName, date, hs: m.homeScore ?? 0, as: m.awayScore ?? 0 };
  return {
    title: played ? t('metaTitleSettled', vars) : t('metaTitle', vars),
    description: played ? t('metaDescriptionSettled', vars) : t('metaDescription', vars),
    alternates: alternatesFor(params.locale as Locale, matchPath(m)),
    openGraph: { title: `${m.homeName} – ${m.awayName}`, images: [`/api/og/match/${m.fixtureId}`] },
  };
}

const score = (r: { homeScore: number | null; awayScore: number | null }) => (r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : '–');

export default async function PublicMatchPage({ params }: { params: Params }) {
  unstable_setRequestLocale(params.locale);
  const m = await load(params.slug);
  if (!m) notFound();
  if (!isCanonicalSlug(params.slug, m)) permanentRedirect(`/${params.locale}${matchPath(m)}`);
  const league = m.league!;

  const t = await getTranslations('matches.match');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');
  const tp = await getTranslations('paywall');
  const f = await getFormatter();

  const [access, table, formHome, formAway, h2h, leagueUpcoming] = await Promise.all([
    getSiteAccess(),
    getStandings(league.slug).catch(() => [] as StandingRow[]),
    m.homeId ? getTeamForm(m.homeId, 5, m.kickoff).catch(() => [] as SitePrediction[]) : Promise.resolve([] as SitePrediction[]),
    m.awayId ? getTeamForm(m.awayId, 5, m.kickoff).catch(() => [] as SitePrediction[]) : Promise.resolve([] as SitePrediction[]),
    m.homeId && m.awayId ? getHeadToHead(m.homeId, m.awayId, 6, m.kickoff).catch(() => [] as SitePrediction[]) : Promise.resolve([] as SitePrediction[]),
    listPublicUpcoming(10).catch(() => [] as PublicMatch[]),
  ]);
  const unlocked = canSeeMatches(access);
  const twa = isTwa();

  const rowOf = (id: number | null) => (id ? table.find((r) => r.teamId === id) : undefined);
  const stHome = rowOf(m.homeId), stAway = rowOf(m.awayId);
  const venue = venueFor(m.homeId);
  const played = m.settled && m.homeScore != null && m.awayScore != null;
  const isPast = played || Date.parse(m.kickoff) < Date.now();
  const letters = (teamId: number | null, rows: SitePrediction[]) => (teamId ? formLetters(teamId, rows) : []);
  const lh = letters(m.homeId, formHome), la = letters(m.awayId, formAway);
  const tally = m.homeId ? h2hTally(m.homeId, h2h) : null;
  const related = leagueUpcoming.filter((r) => r.league?.slug === league.slug && r.fixtureId !== m.fixtureId).slice(0, 6);
  const statusKey = { scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished', postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown' } as const;
  const pageUrl = `${SITE_URL}/${params.locale}${matchPath(m)}`;
  const fmtLetters = (ls: Array<'W' | 'D' | 'L'>) => ls.map((l) => t(`form${l}`)).join(' ');

  // Ön izleme cümleleri: yalnız elde olan gerçek veriden; eksik veri cümlesi atlanır.
  const sentences: string[] = [];
  if (played) sentences.push(t('sFinal', { home: m.homeName, away: m.awayName, hs: m.homeScore!, as: m.awayScore! }));
  if (stHome && stAway) sentences.push(t('sTable', { home: m.homeName, away: m.awayName, league: league.name, hpos: stHome.pos, hpts: stHome.pts, hp: stHome.played, apos: stAway.pos, apts: stAway.pts, ap: stAway.played }));
  if (lh.length >= 3 && la.length >= 3) sentences.push(t('sForm', { home: m.homeName, away: m.awayName, hform: fmtLetters(lh), aform: fmtLetters(la), n: Math.min(lh.length, la.length) }));
  if (tally && tally.n > 0) sentences.push(t('sH2h', { n: tally.n, home: m.homeName, away: m.awayName, hw: tally.homeWins, d: tally.draws, aw: tally.awayWins }));
  else if (!played) sentences.push(t('sNoH2h'));
  if (venue && !played) sentences.push(t('sVenue', { home: m.homeName, venue: venue.venue, city: venue.city ?? '' }));

  const formList = (teamId: number | null, rows: SitePrediction[]) => (
    <ul className="divide-y divide-s-line border-b border-s-line">
      {rows.filter((r) => r.homeScore != null && r.awayScore != null).map((r) => {
        const home = r.homeId === teamId;
        const gf = home ? r.homeScore! : r.awayScore!, ga = home ? r.awayScore! : r.homeScore!;
        const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
        const inner = (
          <>
            <span className="w-16 shrink-0 text-xs text-s-muted"><LocalTime iso={r.kickoff} format="dayShort" /></span>
            <span className="w-5 shrink-0 text-center text-[10px] font-semibold uppercase text-s-muted">{home ? t('formHomeShort') : t('formAwayShort')}</span>
            <span className="min-w-0 flex-1 truncate">{home ? r.awayName : r.homeName}</span>
            <span className="num shrink-0 font-semibold">{score(r)}</span>
            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${res === 'W' ? 'bg-s-win' : res === 'D' ? 'bg-s-void' : 'bg-s-loss'}`}>{t(`form${res}`)}</span>
          </>
        );
        // Kapsam dışı (kupa vb.) maçın herkese açık sayfası yok → düz satır.
        return <li key={r.fixtureId}>{r.league ? <Link href={matchPath(r)} className="flex items-center gap-2 py-1.5 hover:bg-s-raised/60">{inner}</Link> : <span className="flex items-center gap-2 py-1.5">{inner}</span>}</li>;
      })}
    </ul>
  );

  const stCell = (r: StandingRow | undefined, name: string, crest: string | null) => (
    <tr className="border-t border-s-line">
      <td className="num py-2 pr-2 text-s-muted">{r ? `${r.pos}.` : '–'}</td>
      <td className="py-2 pr-2"><span className="flex items-center gap-2"><Crest src={crest} alt={tc('crestAlt', { team: name })} /><span className="truncate font-medium">{name}</span></span></td>
      <td className="num py-2 text-right">{r?.played ?? '–'}</td>
      <td className="num py-2 text-right">{r ? `${r.won}-${r.drawn}-${r.lost}` : '–'}</td>
      <td className="num py-2 text-right">{r ? `${r.gf}:${r.ga}` : '–'}</td>
      <td className="num py-2 text-right font-semibold">{r?.pts ?? '–'}</td>
    </tr>
  );

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: tn('leagues'), path: '/leagues' }, { name: league.name, path: `/leagues/${league.slug}` }, { name: `${m.homeName} – ${m.awayName}`, path: matchPath(m) }])} />
      {!played && <JsonLd data={sportsEventsJsonLd(params.locale as Locale, league, [m], () => t('eventDescription', { league: league.name, home: m.homeName, away: m.awayName }), pageUrl)} />}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-6 text-[13px]">
        <Link href="/matches" className="font-semibold text-s-muted hover:text-s-ink">← {t('backHub')}</Link>
        <Link href={`/leagues/${league.slug}`} className="font-semibold text-s-muted hover:text-s-ink">{league.name}</Link>
      </p>

      {/* ── Başlık: takımlar, başlama, durum, stat ─────────────────── */}
      <header className="mt-3 border-b border-s-line pb-5">
        <p className="kicker">{league.name} · {t('eyebrow')}</p>
        <h1 className="mt-2 text-[28px] leading-tight sm:text-[36px] hyphens-auto [overflow-wrap:anywhere]">
          <span className="inline-flex items-center gap-2"><Crest src={m.homeCrest} alt={tc('crestAlt', { team: m.homeName })} />{m.homeName}</span>
          {' '}<span className="mx-2 text-s-muted">{played ? <span className="num">{m.homeScore}–{m.awayScore}</span> : t('vs')}</span>{' '}
          <span className="inline-flex items-center gap-2"><Crest src={m.awayCrest} alt={tc('crestAlt', { team: m.awayName })} />{m.awayName}</span>
        </h1>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('kickoff')}</dt><dd className="mt-0.5 font-semibold"><LocalTime iso={m.kickoff} format="kickoffZone" /></dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{tc('status')}</dt><dd className="mt-0.5"><StatusChip status={m.status} label={tc(statusKey[m.status])} /></dd></div>
          {venue && <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('venue')}</dt><dd className="mt-0.5 font-semibold">{venue.venue}{venue.city ? <span className="font-normal text-s-muted">, {venue.city}</span> : null}</dd></div>}
        </dl>
        <p className="mt-2 text-xs text-s-muted">{t('tzNote')}</p>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
        <div className="min-w-0 space-y-10">
          {/* ── Ön izleme ───────────────────────────────────────────── */}
          <section aria-labelledby="preview-h">
            <SectionTitle id="preview-h" title={played ? t('reviewH') : t('previewH')} />
            <div className="mt-3 max-w-3xl space-y-3 text-[15px] leading-relaxed">
              {sentences.length ? sentences.map((s, i) => <p key={i}>{s}</p>) : <p className="text-s-muted">{t('noData')}</p>}
              <p className="text-s-muted">{t('sourceNote')} <Link href="/methodology" className="underline underline-offset-4">{t('methodLink')}</Link></p>
            </div>
          </section>

          {/* ── Puan durumu (iki kulüp) ─────────────────────────────── */}
          {(stHome || stAway) && (
            <section aria-labelledby="table-h">
              <SectionTitle id="table-h" title={t('tableH', { league: league.name })} meta={<Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('fullTable')}</Link>} />
              <table className="num mt-3 w-full text-[14px]">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-s-muted"><th className="pb-1 pr-2 font-medium">#</th><th className="pb-1 pr-2 font-medium">{t('colTeam')}</th><th className="pb-1 text-right font-medium">{t('colPlayed')}</th><th className="pb-1 text-right font-medium">{t('colWdl')}</th><th className="pb-1 text-right font-medium">{t('colGoals')}</th><th className="pb-1 text-right font-medium">{t('colPts')}</th></tr></thead>
                <tbody>{stCell(stHome, m.homeName, m.homeCrest)}{stCell(stAway, m.awayName, m.awayCrest)}</tbody>
              </table>
            </section>
          )}

          {/* ── Form ────────────────────────────────────────────────── */}
          {(formHome.length > 0 || formAway.length > 0) && (
            <section aria-labelledby="form-h">
              <SectionTitle id="form-h" title={t('formH')} sub={t('formSub')} />
              <div className="mt-3 grid gap-6 sm:grid-cols-2 text-[14px]">
                <div><h3 className="mb-1 text-[15px] font-semibold">{m.homeName}</h3>{formHome.length ? formList(m.homeId, formHome) : <p className="text-s-muted">{t('formNone')}</p>}</div>
                <div><h3 className="mb-1 text-[15px] font-semibold">{m.awayName}</h3>{formAway.length ? formList(m.awayId, formAway) : <p className="text-s-muted">{t('formNone')}</p>}</div>
              </div>
            </section>
          )}

          {/* ── Geçmiş karşılaşmalar ────────────────────────────────── */}
          <section aria-labelledby="h2h-h">
            <SectionTitle id="h2h-h" title={t('h2hH')} sub={t('h2hSub')} />
            {h2h.length ? (
              <ul className="mt-3 divide-y divide-s-line border-b border-s-line text-[14px]">
                {h2h.map((r) => {
                  const inner = (<><span className="w-24 shrink-0 text-xs text-s-muted"><LocalTime iso={r.kickoff} format="dayShort" /></span><span className="min-w-0 flex-1 truncate">{r.homeName} <span className="num font-semibold">{score(r)}</span> {r.awayName}</span><span className="shrink-0 text-xs text-s-muted">{r.leagueName}</span></>);
                  return <li key={r.fixtureId}>{r.league ? <Link href={matchPath(r)} className="flex items-center gap-3 py-1.5 hover:bg-s-raised/60">{inner}</Link> : <span className="flex items-center gap-3 py-1.5">{inner}</span>}</li>;
                })}
              </ul>
            ) : <p className="mt-3 text-[14px] text-s-muted">{t('sNoH2h')}</p>}
          </section>
        </div>

        {/* ── Model tahmini: üyelere ───────────────────────────────── */}
        <aside className="h-fit rounded-[14px] border border-s-line bg-s-surface p-5 shadow-[var(--s-shadow)] lg:sticky lg:top-20" aria-labelledby="model-h">
          <p className="kicker">{t('modelKicker')}</p>
          <h2 id="model-h" className="mt-2 text-[22px]">{t('modelH')}</h2>
          <p className="mt-2 text-[14px] text-s-muted">{isPast ? t('modelLockedSettled') : t('modelLockedLead')}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px]">
            <li>{t('bullet1x2')}</li><li>{t('bulletGoals')}</li><li>{t('bulletConf')}</li><li>{t('bulletRecord')}</li>
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            {unlocked ? (
              <Link href={`/predictions/${m.fixtureId}`} className="btn btn-primary" data-cta="match-preview-open">{t('modelOpen')} →</Link>
            ) : (
              <>
                <Link href={`${REGISTER_HREF}&callbackUrl=${encodeURIComponent(`/${params.locale}/predictions/${m.fixtureId}`)}`} className="btn btn-primary" data-cta="match-preview-trial">{twa ? tn('signUp') : tp('lockedCta')}</Link>
                <Link href={`${SIGNIN_HREF}?callbackUrl=${encodeURIComponent(`/${params.locale}/predictions/${m.fixtureId}`)}`} className="text-center text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
                {!twa && <p className="text-center text-xs text-s-muted">{tp('lockedLead')}</p>}
              </>
            )}
          </div>
          {m.updatedAt && <p className="mt-4 border-t border-s-line pt-3 text-xs text-s-muted">{t('updated', { time: f.dateTime(new Date(m.updatedAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) })}</p>}
        </aside>
      </div>

      {/* ── İlgili ──────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="border-t border-s-line pt-8 pb-10" aria-labelledby="related-h">
          <SectionTitle id="related-h" title={t('relatedH', { league: league.name })} meta={<Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>} />
          <div className="mt-4"><PublicMatchList rows={related} groupBy="none" showLeague={false} /></div>
        </section>
      )}
      <nav className="flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm" aria-label={t('moreNav')}>
        <Link href="/matches" className="underline underline-offset-4">{t('backHub')}</Link>
        <Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>
        <Link href="/methodology" className="underline underline-offset-4">{t('methodLink')}</Link>
        <Link href="/performance" className="underline underline-offset-4">{tn('performance')}</Link>
      </nav>
    </Page>
  );
}
