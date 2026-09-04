import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { authOptions } from '@/lib/auth';
import { checkUserAccess, hasEnginePredictionAccess } from '@/lib/accessControl';
import { listDayRows } from '@/lib/site/fixtures';
import { todayYmd, addDays } from '@/lib/site/time';
import { getLiveNow, getMarketSnapshots, valueRadar, readWatchlist, teamDirectory, nextMatchForTeam, type ValueRow } from '@/lib/site/dashboard';
import { getTeamForm, type SitePrediction } from '@/lib/site/predictions';
import { standingsIndex, type StandingRow } from '@/lib/site/standings';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { Crest, pickLabel } from '@/components/site/PredictionTable';
import LocalTime from '@/components/site/LocalTime';
import FormStrip, { toFormItems } from '@/components/site/FormStrip';
import WatchlistPanel, { UnfollowButton } from '@/components/site/dashboard/WatchlistPanel';
import IntelCard from '@/components/site/dashboard/IntelCard';
import PurchaseTracker from '@/components/site/dashboard/PurchaseTracker';

// Signed-in dashboard in the public design system. Three blocks:
//   Today      — covered fixtures with the model's pick, market edge, live score
//   Value radar— largest model-vs-bookmaker gaps (paid)
//   Following  — the user's clubs: table position, form, next rated match
// plus the legacy LLM "Match Intelligence" widget behind a collapsible card.
// Per-user, so no ISR: `force-dynamic`. Shared data is still cached below.

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`; };
const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);

export default async function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect(`/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard`)}`);

  const [t, tc, tm, f] = await Promise.all([
    getTranslations('dashboard'), getTranslations('common'), getTranslations('match'), getFormatter(),
  ]);

  const today = todayYmd();
  const [access, engineAccess, todayAll, tomorrowAll, live, watch, directory] = await Promise.all([
    checkUserAccess(email).catch(() => null),
    hasEnginePredictionAccess(email).catch(() => false),
    listDayRows(today),
    listDayRows(addDays(today, 1)),
    getLiveNow(),
    readWatchlist(email),
    teamDirectory(),
  ]);
  const paid = !!(access?.isPro || engineAccess);
  const todayRows = todayAll.filter((r) => r.covered);
  const tomorrowRows = tomorrowAll.filter((r) => r.covered);
  const snaps = await getMarketSnapshots([...todayRows, ...tomorrowRows].filter((r) => r.hasModel).map((r) => r.fixtureId));
  // Computed for everyone: free users see the count behind a locked overlay.
  const radar = await valueRadar([...todayRows, ...tomorrowRows]);

  // Followed clubs: position, form and next rated match, in parallel.
  const followed = await Promise.all(watch.items.map(async (w) => {
    const [form, next, table] = await Promise.all([
      getTeamForm(w.teamId, 5),
      nextMatchForTeam(w.teamId),
      w.leagueSlug ? standingsIndex(w.leagueSlug) : Promise.resolve(new Map<number, StandingRow>()),
    ]);
    return { ...w, form: toFormItems(w.teamId, form), next, st: table.get(w.teamId) ?? null };
  }));
  const followedIds = new Set(watch.items.map((w) => w.teamId));

  const firstName = session?.user?.name?.split(' ')[0] || email.split('@')[0];
  const dateLabel = f.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const formLabels = { W: tm('formW'), D: tm('formD'), L: tm('formL'), vs: tm('vs'), home: tc('home'), away: tc('away') };

  const pickEdge = (r: SitePrediction) => {
    const s = snaps[r.fixtureId];
    if (!s || !r.pick) return null;
    return r.pick === '1' ? r.pHome - s.pHome : r.pick === 'X' ? r.pDraw - s.pDraw : r.pAway - s.pAway;
  };

  const DayRows = ({ rows }: { rows: SitePrediction[] }) => (
    <ul className="divide-y divide-s-line border-b border-s-line">
      {rows.map((r) => {
        const lv = live.get(r.fixtureId);
        const inPlay = !!lv && !lv.finished;
        const score = lv && lv.homeScore != null ? `${lv.homeScore}–${lv.awayScore}` : r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : null;
        const e = pickEdge(r);
        const inner = (
          <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-1 py-2 md:grid-cols-[4.5rem_minmax(12rem,1.4fr)_11rem_4.5rem_7rem]">
            <div className="text-sm">
              {inPlay ? (
                <span className="inline-flex items-center gap-1 text-s-accent"><span className="h-1.5 w-1.5 rounded-full bg-s-accent" aria-hidden />{t('live')}</span>
              ) : lv?.finished || r.settled ? (
                <span className="text-s-muted">{t('ft')}</span>
              ) : (
                <LocalTime iso={r.kickoff} />
              )}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Crest src={r.homeCrest} alt="" />
              <span className="truncate">{r.homeName}</span>
              <span className="num shrink-0 px-1 text-s-muted">{score ?? '–'}</span>
              <Crest src={r.awayCrest} alt="" />
              <span className="truncate">{r.awayName}</span>
            </div>
            <div className="col-start-2 flex min-w-0 items-baseline gap-1.5 text-xs text-s-muted md:col-start-auto md:text-sm md:text-s-ink">
              {r.hasModel ? <><span className="truncate">{pickLabel(r, tc)}</span><span className="num shrink-0 text-s-muted">{pct(r.confidence ?? r.confidenceRaw)}</span></> : <span className="text-s-muted">{t('pending')}</span>}
            </div>
            <div className="num hidden text-right text-sm md:block">{e == null ? <span className="text-s-muted">–</span> : <span className={e >= 0.03 ? 'text-s-win' : e <= -0.03 ? 'text-s-loss' : ''}>{pp(e)}</span>}</div>
            <div className="hidden truncate text-right text-xs text-s-muted md:block">{r.leagueName}</div>
          </div>
        );
        return (
          <li key={r.fixtureId}>
            {r.hasModel ? <Link href={`/predictions/${r.fixtureId}`} className="block hover:bg-s-raised">{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );

  const selLabel = (v: ValueRow) => {
    if (v.market === 'btts') return `${tc('btts')} · ${v.selection === 'yes' ? tc('yes') : tc('no')}`;
    return v.selection === '1' ? v.row.homeName : v.selection === '2' ? v.row.awayName : tc('draw');
  };

  return (
    <Page className="pb-16">
      <PurchaseTracker />
      <PageTitle
        eyebrow={dateLabel}
        title={t('greeting', { name: firstName })}
        lead={paid ? t('proLead') : access ? t('freeLead', { left: Math.max(0, access.analysesLimit - access.analysesUsed), limit: access.analysesLimit }) : undefined}
        aside={
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 items-center rounded-[2px] border px-2 text-xs font-medium ${paid ? 'border-s-brand text-s-brand' : 'border-s-line text-s-muted'}`}>
              {paid ? t('planPro') : t('planFree')}
            </span>
            {!paid && <a href="/pricing" className="inline-flex h-8 items-center rounded-sm bg-s-brand px-3 text-sm font-medium text-s-brand-ink hover:opacity-90">{t('upgrade')}</a>}
          </div>
        }
      />

      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          {/* ── Today ─────────────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('today')} meta={t('todayMeta', { n: todayRows.length, live: [...live.values()].filter((l) => !l.finished && todayRows.some((r) => r.fixtureId === l.id)).length })}>
              <div className="ml-auto hidden text-xs uppercase tracking-wider text-s-muted md:grid md:w-full md:grid-cols-[4.5rem_minmax(12rem,1.4fr)_11rem_4.5rem_7rem] md:gap-x-3 md:pt-2">
                <span>{tc('kickoff')}</span><span>{t('colMatch')}</span><span>{t('pickCol')}</span><span className="text-right">{t('edge')}</span><span className="text-right">{tc('league')}</span>
              </div>
            </SectionTitle>
            {todayRows.length ? <DayRows rows={todayRows} /> : (
              <div className="mt-3"><EmptyState title={t('noToday')} action={<Link href="/predictions" className="text-sm underline underline-offset-2">{tc('viewAll')}</Link>} /></div>
            )}
            {tomorrowRows.length > 0 && (
              <>
                <h3 className="mt-6 font-body text-xs font-medium uppercase tracking-wider text-s-muted">{tc('tomorrow')} · {tomorrowRows.length}</h3>
                <DayRows rows={tomorrowRows.slice(0, 12)} />
                {tomorrowRows.length > 12 && (
                  <p className="mt-2 text-xs"><Link href={`/predictions?date=${addDays(today, 1)}`} className="underline underline-offset-2">{tc('viewAll')}</Link></p>
                )}
              </>
            )}
          </section>

          {/* ── Value radar ───────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('valueTitle')} meta={t('valueMeta')} />
            {radar.length === 0 ? (
              <p className="mt-3 text-sm text-s-muted">{t('valueEmpty')}</p>
            ) : (
              <div className="relative mt-3">
                <div className={`tbl-scroll ${paid ? '' : 'pointer-events-none select-none blur-[5px]'}`} aria-hidden={!paid}>
                  <table className="text-sm">
                    <thead className="text-xs uppercase tracking-wider text-s-muted">
                      <tr className="border-b border-s-line">
                        <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
                        <th className="py-1.5 text-left font-medium">{t('colSelection')}</th>
                        <th className="py-1.5 text-right font-medium">{tc('model')}</th>
                        <th className="py-1.5 text-right font-medium">{tc('market')}</th>
                        <th className="py-1.5 text-right font-medium">{t('colOdds')}</th>
                        <th className="py-1.5 text-right font-medium">{t('edge')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paid ? radar : radar.slice(0, 4)).map((v) => (
                        <tr key={`${v.fixtureId}-${v.market}`} className="border-b border-s-line">
                          <td className="py-2 pr-3">
                            {paid ? <Link href={`/predictions/${v.fixtureId}`} className="hover:underline">{v.row.homeName} – {v.row.awayName}</Link> : <>{v.row.homeName} – {v.row.awayName}</>}
                            <span className="ml-2 text-xs text-s-muted"><LocalTime iso={v.row.kickoff} format="kickoff" /></span>
                          </td>
                          <td className="py-2 pr-3">{selLabel(v)}</td>
                          <td className="num py-2 text-right">{pct(v.model)}</td>
                          <td className="num py-2 text-right text-s-muted">{pct(v.market_p)}</td>
                          <td className="num py-2 text-right">{v.odds.toFixed(2)}</td>
                          <td className="num py-2 text-right text-s-win">{pp(v.edge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!paid && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="max-w-sm rounded-sm border border-s-line bg-s-surface p-5 text-center shadow-sm">
                      <p className="font-medium">{t('valueLocked', { n: radar.length })}</p>
                      <p className="mt-1 text-sm text-s-muted">{t('valueLockedLead')}</p>
                      <a href="/pricing" className="mt-4 inline-flex h-9 items-center rounded-sm bg-s-brand px-4 text-sm font-medium text-s-brand-ink hover:opacity-90">{t('upgrade')}</a>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-s-muted">{t('valueNote')}</p>
          </section>

          <IntelCard locale={locale} />
        </div>

        {/* ── Following ───────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <SectionTitle title={t('watchTitle')} meta={watch.available ? `${watch.items.length}/30` : undefined} />
          <p className="text-sm text-s-muted">{t('watchLead')}</p>
          <WatchlistPanel teams={directory} following={[...followedIds]} available={watch.available} />
          {watch.available && followed.length === 0 && <p className="text-sm text-s-muted">{t('watchEmpty')}</p>}
          <ul className="divide-y divide-s-line border-t border-s-line">
            {followed.map((w) => (
              <li key={w.teamId} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{w.teamName}</p>
                    <p className="text-xs text-s-muted">
                      {w.st ? t('position', { pos: w.st.pos, pts: w.st.pts, played: w.st.played }) : (directory.find((d) => d.id === w.teamId)?.league ?? '')}
                    </p>
                  </div>
                  <UnfollowButton teamId={w.teamId} label={t('unfollow')} />
                </div>
                {w.form.length > 0 && <div className="mt-2"><FormStrip items={w.form} labels={formLabels} /></div>}
                <p className="mt-2 text-sm">
                  {w.next ? (
                    <Link href={`/predictions/${w.next.fixtureId}`} className="hover:underline">
                      <span className="text-s-muted">{t('nextMatch')}: </span>
                      {w.next.homeName} – {w.next.awayName}
                      <span className="ml-2 text-xs text-s-muted"><LocalTime iso={w.next.kickoff} format="kickoff" /></span>
                      {w.next.pick && <span className="ml-2 text-xs text-s-muted">· {pickLabel(w.next, tc)} {pct(w.next.confidence ?? w.next.confidenceRaw)}</span>}
                    </Link>
                  ) : (
                    <span className="text-s-muted">{t('noNext')}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-s-muted">{t('disclaimer')}</p>
        </aside>
      </div>
    </Page>
  );
}
