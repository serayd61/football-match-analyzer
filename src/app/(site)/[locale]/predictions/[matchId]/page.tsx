import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { getPrediction, getMarketSnapshot, getHeadToHead, getTeamForm, type SitePrediction } from '@/lib/site/predictions';
import { scoreMatrix, outcomeProbs, overProb, bttsProb, topScores, handicapTable, fairHandicap, handicapAt } from '@/lib/site/poisson';
import { getMarketBook } from '@/lib/site/markets';
import { Page, SectionTitle } from '@/components/site/ui';
import ProbBar from '@/components/site/ProbBar';
import LocalTime from '@/components/site/LocalTime';
import OutcomeBadge from '@/components/site/OutcomeBadge';
import FormStrip, { toFormItems } from '@/components/site/FormStrip';
import { standingsIndex } from '@/lib/site/standings';

export const revalidate = 900;

function parseId(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: { locale: string; matchId: string } }): Promise<Metadata> {
  const id = parseId(params.matchId);
  const p = id ? await getPrediction(id) : null;
  // Throwing here (before the streaming shell starts) keeps the 404 status;
  // the loading.tsx boundary would otherwise commit a 200 first.
  if (!p) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'match' });
  const title = `${p.homeName} – ${p.awayName}`;
  return {
    title,
    description: t('metaDescription', { home: p.homeName, away: p.awayName, league: p.leagueName, pHome: Math.round(p.pHome * 100), pDraw: Math.round(p.pDraw * 100), pAway: Math.round(p.pAway * 100) }),
    alternates: alternatesFor(params.locale as Locale, `/predictions/${p.fixtureId}`),
    openGraph: { title, images: [`/api/og/match/${p.fixtureId}`] },
  };
}

const pct = (x: number | null | undefined, dash = '–') => (x == null ? dash : `${Math.round(x * 100)}%`);
const odds = (p: number) => (p > 0 ? (1 / p).toFixed(2) : '–');
const pp = (x: number) => { const v = Math.round(x * 100); return v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`; };

export default async function MatchPage({ params }: { params: { locale: string; matchId: string } }) {
  unstable_setRequestLocale(params.locale);
  const id = parseId(params.matchId);
  if (!id) notFound();
  const p = await getPrediction(id);
  if (!p) notFound();

  const t = await getTranslations('match');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  const ts = await getTranslations('standings');
  const table = p.league ? await standingsIndex(p.league.slug) : new Map();
  const stRow = (id: number | null) => (id ? table.get(id) : undefined);
  const [market, book, h2h, formHome, formAway] = await Promise.all([
    getMarketSnapshot(p.fixtureId),
    getMarketBook(p.fixtureId),
    p.homeId && p.awayId ? getHeadToHead(p.homeId, p.awayId) : Promise.resolve([] as SitePrediction[]),
    p.homeId ? getTeamForm(p.homeId) : Promise.resolve([] as SitePrediction[]),
    p.awayId ? getTeamForm(p.awayId) : Promise.resolve([] as SitePrediction[]),
  ]);

  const sm = p.lambdaHome != null && p.lambdaAway != null ? scoreMatrix(p.lambdaHome, p.lambdaAway) : null;
  const derived = sm ? outcomeProbs(sm) : null;
  const lines = sm ? [1.5, 2.5, 3.5].map((l) => ({ line: l, over: overProb(sm, l) })) : [];
  const scores = sm ? topScores(sm, 6) : [];
  const ah = sm ? handicapTable(sm).filter((l) => l.line >= -1.5 && l.line <= 1.5) : [];
  const fair = sm ? fairHandicap(sm) : null;

  const formH = p.homeId ? toFormItems(p.homeId, formHome) : [];
  const formA = p.awayId ? toFormItems(p.awayId, formAway) : [];
  const formLabels = { W: t('formW'), D: t('formD'), L: t('formL'), vs: t('vs'), home: tc('home'), away: tc('away') };
  const record = (items: ReturnType<typeof toFormItems>) => ({
    w: items.filter((i) => i.res === 'W').length, d: items.filter((i) => i.res === 'D').length, l: items.filter((i) => i.res === 'L').length,
  });

  const pickName = p.pick === '1' ? p.homeName : p.pick === '2' ? p.awayName : tc('draw');
  const isPast = p.settled || new Date(p.kickoff).getTime() < Date.now();

  // Model-vs-market edge in percentage points, per outcome.
  const edge = market ? { home: p.pHome - market.pHome, draw: p.pDraw - market.pDraw, away: p.pAway - market.pAway } : null;
  const outcomes = [
    { key: '1', label: p.homeName, short: tc('home'), p: p.pHome, m: market?.pHome, o: market?.homeOdds, e: edge?.home },
    { key: 'X', label: tc('draw'), short: tc('draw'), p: p.pDraw, m: market?.pDraw, o: market?.drawOdds, e: edge?.draw },
    { key: '2', label: p.awayName, short: tc('away'), p: p.pAway, m: market?.pAway, o: market?.awayOdds, e: edge?.away },
  ] as const;

  const rh = record(formH), ra = record(formA);

  // Extra markets vs the model (two-way markets, margin removed on the market side).
  const csMap = new Map((book?.correctScore || []).map((c) => [`${c.home}-${c.away}`, c.implied]));
  type MRow = { key: string; market: string; sel: string; model: number; mOdds: number; mProb: number };
  const mrows: MRow[] = [];
  if (book?.asian && sm) {
    const h = handicapAt(sm, book.asian.line);
    const modelHome = h.pHomeCover / (h.pHomeCover + h.pAwayCover);
    const fmt = (l: number) => (l > 0 ? `+${l}` : `${l}`);
    mrows.push({ key: 'ah-h', market: t('mkAsian'), sel: `${p.homeName} ${fmt(book.asian.line)}`, model: modelHome, mOdds: book.asian.home, mProb: book.asian.pHome });
    mrows.push({ key: 'ah-a', market: t('mkAsian'), sel: `${p.awayName} ${fmt(-book.asian.line)}`, model: 1 - modelHome, mOdds: book.asian.away, mProb: book.asian.pAway });
  }
  if (book?.drawNoBet) {
    const dh = p.pHome / (p.pHome + p.pAway);
    mrows.push({ key: 'dnb-h', market: t('mkDnb'), sel: p.homeName, model: dh, mOdds: book.drawNoBet.a, mProb: book.drawNoBet.pA });
    mrows.push({ key: 'dnb-a', market: t('mkDnb'), sel: p.awayName, model: 1 - dh, mOdds: book.drawNoBet.b, mProb: book.drawNoBet.pB });
  }
  if (book?.btts && sm) {
    const by = bttsProb(sm);
    mrows.push({ key: 'btts-y', market: tc('btts'), sel: tc('yes'), model: by, mOdds: book.btts.a, mProb: book.btts.pA });
    mrows.push({ key: 'btts-n', market: tc('btts'), sel: tc('no'), model: 1 - by, mOdds: book.btts.b, mProb: book.btts.pB });
  }

  return (
    <Page>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pt-6 text-sm text-s-muted">
        <Link href="/predictions" className="hover:underline underline-offset-4">{t('backToList')}</Link>
        {' · '}
        {p.league ? <Link href={`/leagues/${p.league.slug}`} className="hover:underline underline-offset-4">{p.leagueName}</Link> : p.leagueName}
        {' · '}
        <LocalTime iso={p.kickoff} format="kickoff" />
        {!p.covered && <span className="ml-2 rounded-[2px] border border-s-line px-1.5 py-0.5 text-xs">{t('outsideCoverage')}</span>}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-s-line pb-5">
        <Team name={p.homeName} crest={p.homeCrest} align="right" />
        <div className="text-center">
          {p.homeScore != null && p.awayScore != null ? (
            <div className="num font-head text-4xl font-semibold sm:text-5xl">{p.homeScore}–{p.awayScore}</div>
          ) : (
            <div className="font-head text-2xl text-s-muted">{t('vs')}</div>
          )}
          {(p.outcome !== 'pending' || isPast) && <div className="mt-1"><OutcomeBadge outcome={p.outcome} /></div>}
        </div>
        <Team name={p.awayName} crest={p.awayCrest} align="left" />
      </div>

      {/* ── Summary line (data-derived, per locale) ───────────────────── */}
      <p className="mt-5 max-w-3xl text-[15px]">
        {t('summary', {
          pick: pickName, p: Math.round((p.confidence ?? p.confidenceRaw ?? 0) * 100),
          lh: f.number(p.lambdaHome ?? 0, 'fixed2'), la: f.number(p.lambdaAway ?? 0, 'fixed2'),
          home: p.homeName, away: p.awayName,
          over: Math.round((p.overUnder?.pRaw ?? 0) * 100), btts: Math.round((p.btts?.pRaw ?? 0) * 100),
        })}
        {formH.length >= 3 && formA.length >= 3 && (
          <> {t('summaryForm', { home: p.homeName, hw: rh.w, hn: formH.length, away: p.awayName, aw: ra.w, an: formA.length })}</>
        )}
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          {/* ── 1X2 ───────────────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('sec1x2')} meta={market ? t('marketMeta', { phase: market.phase === 'closing' ? t('closing') : t('opening'), provider: market.provider ?? '' }) : t('noMarket')} />
            <div className="mt-4">
              <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} highlight={p.pick} labels={{ home: tc('home'), draw: tc('draw'), away: tc('away') }} />
            </div>
            <div className="tbl-scroll mt-3">
              <table className="text-sm">
                <thead className="text-xs uppercase tracking-wider text-s-muted">
                  <tr className="border-b border-s-line">
                    <th className="py-1.5 text-left font-medium">{t('outcome')}</th>
                    <th className="py-1.5 text-right font-medium">{t('modelProb')}</th>
                    <th className="py-1.5 text-right font-medium">{t('fairOdds')}</th>
                    <th className="py-1.5 text-right font-medium">{t('marketOdds')}</th>
                    <th className="py-1.5 text-right font-medium">{t('marketProb')}</th>
                    <th className="py-1.5 text-right font-medium">{t('edge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o.key} className={`border-b border-s-line ${p.pick === o.key ? 'bg-s-raised/60 font-medium' : ''}`}>
                      <td className="py-2 pr-3"><span className="mr-2 inline-block w-4 text-center text-s-muted">{o.key}</span>{o.label}</td>
                      <td className="num py-2 text-right">{pct(o.p)}</td>
                      <td className="num py-2 text-right text-s-muted">{odds(o.p)}</td>
                      <td className="num py-2 text-right">{o.o != null ? o.o.toFixed(2) : '–'}</td>
                      <td className="num py-2 text-right text-s-muted">{o.m != null ? pct(o.m) : '–'}</td>
                      <td className={`num py-2 text-right ${o.e == null ? 'text-s-muted' : o.e > 0.03 ? 'text-s-win' : o.e < -0.03 ? 'text-s-loss' : ''}`}>{o.e != null ? pp(o.e) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-s-muted">
              {t('pickNote', { pick: pickName, cal: pct(p.confidence), raw: pct(p.confidenceRaw) })}
              {' '}{t('edgeNote')}
              {p.doubleChance && <> {t('dcNote', { dc: p.doubleChance.pick, p: pct(p.doubleChance.p) })}</>}
            </p>
          </section>

          {/* ── Goals ─────────────────────────────────────────────────── */}
          {sm && (
            <section>
              <SectionTitle title={t('secGoals')} meta={t('lambdaMeta', { lh: f.number(sm.lambdaHome, 'fixed2'), la: f.number(sm.lambdaAway, 'fixed2') })} />
              <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-s-muted">
                    <tr className="border-b border-s-line">
                      <th className="py-1.5 text-left font-medium">{t('line')}</th>
                      <th className="py-1.5 text-right font-medium">{tc('over')}</th>
                      <th className="py-1.5 text-right font-medium">{tc('under')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.line} className="border-b border-s-line">
                        <td className="py-2">{l.line.toFixed(1)}</td>
                        <td className="num py-2 text-right"><Cell p={l.over} /></td>
                        <td className="num py-2 text-right"><Cell p={1 - l.over} /></td>
                      </tr>
                    ))}
                    <tr className="border-b border-s-line">
                      <td className="whitespace-nowrap py-2">{tc('btts')}</td>
                      <td className="num py-2 text-right"><Cell p={bttsProb(sm)} label={tc('yes')} /></td>
                      <td className="num py-2 text-right"><Cell p={1 - bttsProb(sm)} label={tc('no')} /></td>
                    </tr>
                  </tbody>
                </table>
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-body text-xs font-medium uppercase tracking-wider text-s-muted">{t('likelyScores')}</h3>
                    {csMap.size > 0 && <span className="text-xs text-s-muted">{t('modelVsBook')}</span>}
                  </div>
                  <ul className="mt-1.5 divide-y divide-s-line border-b border-s-line text-sm">
                    {scores.map((s) => (
                      <li key={`${s.home}-${s.away}`} className="flex items-center gap-3 py-1.5">
                        <span className="num w-10 font-head text-lg">{s.home}–{s.away}</span>
                        <span className="h-2 flex-1 bg-s-raised"><span className="block h-2 bg-s-brand" style={{ width: `${Math.min(100, s.p * 400)}%` }} /></span>
                        <span className="num w-12 text-right">{(s.p * 100).toFixed(1)}%</span>
                        {csMap.size > 0 && <span className="num w-12 text-right text-s-muted">{csMap.has(`${s.home}-${s.away}`) ? `${(csMap.get(`${s.home}-${s.away}`)! * 100).toFixed(1)}%` : '–'}</span>}
                      </li>
                    ))}
                  </ul>
                  {csMap.size > 0 && <p className="mt-1 text-xs text-s-muted">{t('csNote')}</p>}
                  <p className="mt-2 text-xs text-s-muted">
                    {t('calibratedGoals', { ou: p.overUnder ? `${p.overUnder.pick === 'over' ? tc('over') : tc('under')} 2.5 ${pct(p.overUnder.p)}` : '–', btts: p.btts ? `${p.btts.pick === 'yes' ? tc('yes') : tc('no')} ${pct(p.btts.p)}` : '–' })}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ── Asian handicap ────────────────────────────────────────── */}
          {sm && fair && (
            <section>
              <SectionTitle title={t('secHandicap')} meta={t('fairLine', { team: fair.line <= 0 ? p.homeName : p.awayName, line: Math.abs(fair.line) === 0 ? '0' : `−${Math.abs(fair.line)}` })} />
              <div className="tbl-scroll mt-3">
                <table className="text-sm">
                  <thead className="text-xs uppercase tracking-wider text-s-muted">
                    <tr className="border-b border-s-line">
                      <th className="py-1.5 text-left font-medium">{t('homeLine', { team: p.homeName })}</th>
                      <th className="py-1.5 text-right font-medium">{t('homeCovers')}</th>
                      <th className="py-1.5 text-right font-medium">{t('push')}</th>
                      <th className="py-1.5 text-right font-medium">{t('awayCovers')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ah.map((l) => (
                      <tr key={l.line} className={`border-b border-s-line ${l.line === fair.line ? 'bg-s-raised/60 font-medium' : ''}`}>
                        <td className="num py-2">{l.line > 0 ? `+${l.line}` : l.line}</td>
                        <td className="num py-2 text-right">{pct(l.pHomeCover)}</td>
                        <td className="num py-2 text-right text-s-muted">{l.pPush > 0.0005 ? pct(l.pPush) : '–'}</td>
                        <td className="num py-2 text-right">{pct(l.pAwayCover)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-s-muted">{t('handicapNote')}</p>
            </section>
          )}

          {/* ── Other markets vs bookmaker ────────────────────────────── */}
          {mrows.length > 0 && book && (
            <section>
              <SectionTitle title={t('secMarkets')} meta={t('marketMeta', { phase: book.phase === 'closing' ? t('closing') : t('opening'), provider: book.provider ?? '' })} />
              <div className="tbl-scroll mt-3">
                <table className="text-sm">
                  <thead className="text-xs uppercase tracking-wider text-s-muted">
                    <tr className="border-b border-s-line">
                      <th className="py-1.5 text-left font-medium">{t('market')}</th>
                      <th className="py-1.5 text-left font-medium">{t('selection')}</th>
                      <th className="py-1.5 text-right font-medium">{t('modelProb')}</th>
                      <th className="py-1.5 text-right font-medium">{t('fairOdds')}</th>
                      <th className="py-1.5 text-right font-medium">{t('marketOdds')}</th>
                      <th className="py-1.5 text-right font-medium">{t('marketProb')}</th>
                      <th className="py-1.5 text-right font-medium">{t('edge')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mrows.map((r) => { const e = r.model - r.mProb; return (
                      <tr key={r.key} className="border-b border-s-line">
                        <td className="py-2 pr-3 text-s-muted">{r.market}</td>
                        <td className="py-2 pr-3">{r.sel}</td>
                        <td className="num py-2 text-right">{pct(r.model)}</td>
                        <td className="num py-2 text-right text-s-muted">{odds(r.model)}</td>
                        <td className="num py-2 text-right">{r.mOdds.toFixed(2)}</td>
                        <td className="num py-2 text-right text-s-muted">{pct(r.mProb)}</td>
                        <td className={`num py-2 text-right ${e > 0.03 ? 'text-s-win' : e < -0.03 ? 'text-s-loss' : ''}`}>{pp(e)}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-s-muted">{t('marketsNote')}</p>
            </section>
          )}
        </div>

        <aside className="space-y-10">
          {/* ── Form ──────────────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('secForm')} meta={t('formMeta')} />
            <div className="mt-4 space-y-4 text-sm">
              {[{ name: p.homeName, items: formH, r: rh, st: stRow(p.homeId) }, { name: p.awayName, items: formA, r: ra, st: stRow(p.awayId) }].map((team) => (
                <div key={team.name}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{team.name}</span>
                    {team.items.length > 0 && <span className="num text-xs text-s-muted">{team.r.w}-{team.r.d}-{team.r.l}</span>}
                  </div>
                  {team.st && (
                    <p className="num mt-0.5 text-xs text-s-muted">
                      {ts('positionLine', { pos: team.st.pos, pts: team.st.pts, played: team.st.played, gd: `${team.st.gd > 0 ? '+' : ''}${team.st.gd}` })}
                    </p>
                  )}
                  <div className="mt-1.5">
                    {team.items.length ? <FormStrip items={team.items} labels={formLabels} /> : <span className="text-xs text-s-muted">{t('noForm')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Head to head ──────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('secH2h')} />
            {h2h.length ? (
              <ul className="mt-2 divide-y divide-s-line border-b border-s-line text-sm">
                {h2h.map((m) => (
                  <li key={m.fixtureId}>
                    <Link href={`/predictions/${m.fixtureId}`} className="flex items-center gap-3 py-2 hover:bg-s-raised/60">
                      <span className="w-16 shrink-0 text-xs text-s-muted"><LocalTime iso={m.kickoff} format="dayShort" /></span>
                      <span className="min-w-0 flex-1 truncate">{m.homeName} – {m.awayName}</span>
                      <span className="num font-semibold">{m.homeScore}–{m.awayScore}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-s-muted">{t('noH2h')}</p>
            )}
          </section>

          {/* ── Model facts ───────────────────────────────────────────── */}
          <section>
            <SectionTitle title={t('secModel')} />
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-s-muted">{t('modelVersion')}</dt><dd className="num">{p.modelVersion ?? '–'}</dd>
              <dt className="text-s-muted">{t('derived1x2')}</dt><dd className="num">{derived ? `${pct(derived.home)} / ${pct(derived.draw)} / ${pct(derived.away)}` : '–'}</dd>
              <dt className="text-s-muted">{t('published')}</dt><dd className="num">{p.updatedAt ? f.dateTime(new Date(p.updatedAt), 'kickoff') : '–'}</dd>
              <dt className="text-s-muted">{t('status')}</dt><dd>{isPast ? (p.settled ? t('settled') : t('awaitingResult')) : t('upcoming')}</dd>
            </dl>
            <p className="mt-3 text-xs text-s-muted">{t('modelNote')}</p>
          </section>
        </aside>
      </div>

      <p className="mt-12 border-t border-s-line pt-4 text-xs text-s-muted">{t('disclaimer')}</p>
    </Page>
  );
}

function Team({ name, crest, align }: { name: string; crest: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {crest ? <Image src={crest} alt="" width={44} height={44} className="h-9 w-9 object-contain sm:h-11 sm:w-11" unoptimized /> : <span className="h-9 w-9 rounded-sm bg-s-raised sm:h-11 sm:w-11" />}
      <h1 className="text-2xl leading-none sm:text-3xl">{name}</h1>
    </div>
  );
}

function Cell({ p, label }: { p: number; label?: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {label && <span className="text-xs text-s-muted">{label}</span>}
      <span className="inline-block h-1.5 w-12 bg-s-raised"><span className="block h-1.5 bg-s-brand" style={{ width: `${p * 100}%` }} /></span>
      <span className="w-10 text-right">{pct(p)}</span>
    </span>
  );
}
