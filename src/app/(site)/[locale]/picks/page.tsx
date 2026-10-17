import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listDay } from '@/lib/site/fixtures';
import { getMarketSnapshots } from '@/lib/site/dashboard';
import { assessRows } from '@/lib/site/assess';
import { marketOf } from '@/lib/site/assessment';
import { AssessmentChip } from '@/components/site/Assessment';
import { getPerformance } from '@/lib/site/performance';
import { dailyStandingBoard, type StandingPick } from '@/lib/site/daily-standing';
import { outsideStandingFor } from '@/lib/site/outside-standing';
import { standingHistory } from '@/lib/site/standing-picks';
import { focusBoard, focusRecord, FOCUS_MARKETS, type FocusCell } from '@/lib/site/focus-board';
import { strongBoard } from '@/lib/site/strong-markets';
import { loadCoverage } from '@/lib/coverage/registry';
import type { SettledStandingPick } from '@/lib/site/standing-picks-rule';
import { todayYmd, addDays, YMD_RE } from '@/lib/site/time';
import { requireSiteAccess } from '@/lib/site/access';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { Paywall, AnonWall, TrialNotice } from '@/components/site/Paywall';
import { Crest } from '@/components/site/PredictionTable';
import LocalTime from '@/components/site/LocalTime';

// Karneye uyan maçlar (2026-10-08): günün kapsanan maçlarını maç sayfasındaki
// "Bu maç karnemizde nerede" ölçeğinden toplu geçirir; pazar pazar yalnız
// "güçlü" hükmü alan seçimler, model–piyasa farkı yanında. Müşteri ne maç ne
// fark aramak zorunda kalmaz. Üyelere özel: oturum okunur → force-dynamic.
export const dynamic = 'force-dynamic';

type Search = { date?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'picks' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: alternatesFor(locale as Locale, '/picks'),
    robots: { index: false, follow: false },
  };
}

const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
/** İşaretli yüzde puan: +4 / −3 (Unicode eksi), 0 → "0". */
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`; };

const verdictTone = { strong: 'bg-s-win text-white', mid: 'bg-s-raised text-s-ink', weak: 'bg-s-loss text-white', thin: 'border border-s-line text-s-muted' } as const;

export default async function PicksPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const today = todayYmd();
  const tomorrow = addDays(today, 1);
  const requested = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : null;
  let date = requested ?? today;
  const backPath = `/picks${requested ? `?date=${requested}` : ''}`;
  const access = await requireSiteAccess(locale, backPath);
  const [t, tc, tm, tv, ta, f] = await Promise.all([
    getTranslations('picks'), getTranslations('common'), getTranslations('match'), getTranslations('v2.predictions'), getTranslations('assessment'), getFormatter(),
  ]);

  if (access.state === 'anon') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <AnonWall locale={locale} path={backPath} title={t('title')} />
      </Page>
    );
  }
  if (access.state === 'expired') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <Paywall />
      </Page>
    );
  }

  // Geçmiş günler (10 Eki): dondurulmuş seçimler, skorla sonuçlanmış; kazanan–kaybeden birlikte (standing-picks.ts).
  let [day, perf, outside, history, coverage] = await Promise.all([listDay(date), getPerformance(null).catch(() => null), outsideStandingFor(), standingHistory(90).catch(() => []), loadCoverage().catch(() => [])]);
  // Kapsanan ligler + gözlem ligleri (9 Eki): gözlemdekiler lig dilim + fark karnesiyle hükme girer.
  const dayRows = (d: typeof day) => d.rows.filter((r) => r.hasModel && (r.covered || outside.eligible(r)));
  const upcoming = (d: typeof day) => dayRows(d).some((r) => !r.settled && r.status !== 'finished' && r.status !== 'cancelled' && r.status !== 'postponed');
  // Tarih verilmediyse ve günün (Zürih) maçları bittiyse yarına geç (10 Eki: İstanbul'da
  // 00:40'ta "Bugün" hâlâ bitmiş 9 Ekim'i gösteriyordu → boş sayfa).
  let rolled = false;
  if (!requested && !upcoming(day)) {
    const next = await listDay(tomorrow);
    if (upcoming(next)) { day = next; date = tomorrow; rolled = true; }
  }
  const rows = dayRows(day);
  const snaps = await getMarketSnapshots(rows.map((r) => r.fixtureId));
  const board = perf ? dailyStandingBoard(rows, snaps, perf.signals, undefined, outside.standing) : { markets: [], scanned: rows.length, matches: 0 };
  // Ortak değerlendirme (assess-1.0, 2026-10-16): liste üyeliği ve sıralama değişmez ('strong' hükmü, standing-1.0);
  // her satır maç sayfasıyla aynı kanıt durumunu taşır.
  const assessed = await assessRows(rows, { snapshots: snaps }).catch(() => new Map());
  const statusOf = (fixtureId: number, market: StandingPick['market']) => marketOf(assessed.get(fixtureId)?.assessment, market);
  const marketName = { '1x2': tv('mkt1x2'), ou25: tc('ou25'), btts: tc('btts') } as const;
  const verdictLabel = { strong: tm('verdictStrong'), mid: tm('verdictMid'), weak: tm('verdictWeak'), thin: tm('verdictThin') } as const;
  const selectionName = (market: StandingPick['market'], sel: string, homeName: string, awayName: string) =>
    market === '1x2' ? (sel === '1' ? homeName : sel === '2' ? awayName : tc('draw'))
      : market === 'ou25' ? (sel === 'over' ? tm('standingOver') : tm('standingUnder'))
        : (sel === 'yes' ? tm('standingYes') : tm('standingNo'));
  const selection = (p: StandingPick) => selectionName(p.market, p.selection, p.row.homeName, p.row.awayName);
  const resultTone = (won: boolean | null) => (won == null ? 'border border-s-line text-s-muted' : won ? 'bg-s-win text-white' : 'bg-s-loss text-white');
  const resultLabel = (won: boolean | null) => (won == null ? t('resultPending') : won ? t('resultWon') : t('resultLost'));
  const historyDays = history.filter((d) => d.n > 0 || d.pending > 0).slice(0, 7);
  // Odak tablosu (13 Eki): lig × pazar güçlü aralıklar (perf.signals) + dondurulmuş seçimlerin 90 günlük kaydı;
  // gözlem ligleri için sicilin güçlü pazarları (strongBoard, /performance ile aynı).
  const focus = perf ? focusBoard(perf.signals, focusRecord(history)) : null;
  const observeStrong = strongBoard(coverage.filter((c) => c.status === 'observe'), 4).flatMap((b) => b.rows).sort((a, b) => b.acc - a.acc || b.n - a.n).slice(0, 8);
  const strongMarketName: Record<string, string> = { x12: tv('mkt1x2'), ou25: tv('mktOver'), under25: tv('mktUnder'), btts: tv('mktBtts') };
  const FocusTd = ({ c }: { c: FocusCell | null }) => {
    if (!c) return <td className="py-2.5 pr-3 text-right text-s-muted">–</td>;
    const strong = c.verdict === 'strong';
    const kind = c.kind === 'edge' ? t('focusKindEdge') : t('focusKindLevel');
    return (
      <td className="py-2.5 pr-3 text-right align-top">
        {strong ? (
          <>
            <span className="num font-bold text-s-win">{pct(c.acc)}</span> <span className="num text-xs text-s-muted">{c.won}/{c.n}</span>
            <span className="mt-0.5 block text-xs text-s-ink">{c.zones.map((z) => z.bucket).join(' · ')} <span className="text-s-muted">· {kind}</span></span>
          </>
        ) : c.best ? (
          <>
            <span className="text-xs text-s-muted">{t('focusNoZone')}</span>
            <span className="num mt-0.5 block text-xs text-s-muted">{t('focusBest')}: {c.best.bucket} {pct(c.best.acc)} ({c.best.won}/{c.best.n})</span>
          </>
        ) : <span className="text-xs text-s-muted">{t('focusNoZone')}</span>}
        {c.record && <span className="num mt-0.5 block text-xs text-s-muted">{t('focusRecord', { won: c.record.won, n: c.record.n })}</span>}
      </td>
    );
  };
  // Maç sayfasındaki "geri" bağlantısı buraya dönsün (back-link.ts `from=picks`).
  const back = `from=picks${date !== today ? `&date=${date}` : ''}`;
  const dateLabel = f.dateTime(new Date(`${date}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' });
  const nonEmpty = board.markets.filter((m) => m.picks.length > 0);

  return (
    <Page>
      <div className="pt-5"><TrialNotice access={access} /></div>
      <PageTitle
        eyebrow={`${t('eyebrow')} · ${dateLabel}`}
        title={t('title')}
        lead={t('lead')}
        aside={(
          <nav className="seg" aria-label={t('eyebrow')}>
            <Link href="/picks" aria-current={date === today ? 'true' : undefined}>{tc('today')}</Link>
            <Link href={`/picks?date=${tomorrow}`} aria-current={date === tomorrow ? 'true' : undefined}>{tc('tomorrow')}</Link>
          </nav>
        )}
      />

      <p className="num -mt-2 pb-4 text-[13px] font-semibold text-s-muted">
        {t('meta', { scanned: board.scanned, matches: board.matches })}
        {rolled && <span className="ml-2 font-normal">· {t('rolledOver')}</span>}
      </p>

      {nonEmpty.length === 0 ? (
        <EmptyState
          title={board.scanned === 0 ? t('emptyNoMatches') : t('emptyTitle')}
          lead={board.scanned === 0 ? undefined : t('emptyLead', { scanned: board.scanned })}
          action={<Link href={`/predictions${date !== today ? `?date=${date}` : ''}`} className="btn btn-secondary btn-sm">{t('allPredictions')}</Link>}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {nonEmpty.map(({ market, picks }) => (
            <section key={market}>
              <SectionTitle title={marketName[market]} meta={t('marketMeta', { n: picks.length })} />
              <div className="tbl-scroll mt-3">
                <table className="text-sm">
                  <thead className="text-xs uppercase tracking-wider text-s-muted">
                    <tr className="border-b border-s-line">
                      <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
                      <th className="py-1.5 text-left font-medium">{t('colSelection')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colMarket')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colEdge')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colHit')}</th>
                      <th className="py-1.5 text-right font-medium">{ta('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picks.map((p) => {
                      const s = p.standing;
                      const a = statusOf(p.fixtureId, p.market);
                      return (
                        <tr key={`${market}-${p.fixtureId}`} className="border-b border-s-line">
                          <td className="py-2.5 pr-3">
                            <Link href={`/predictions/${p.fixtureId}?back=${encodeURIComponent(back)}`} className="group flex items-center gap-2 hover:underline">
                              <span className="flex shrink-0 -space-x-1"><Crest src={p.row.homeCrest} alt="" /><Crest src={p.row.awayCrest} alt="" /></span>
                              <span className="min-w-0"><span className={p.selection === '1' ? 'font-bold' : ''}>{p.row.homeName}</span> – <span className={p.selection === '2' ? 'font-bold' : ''}>{p.row.awayName}</span></span>
                            </Link>
                            <span className="mt-0.5 block text-xs text-s-muted">{outside.label(p.row)} · <LocalTime iso={p.row.kickoff} format="time" /></span>
                          </td>
                          <td className="py-2.5 pr-3 font-semibold">{selection(p)}</td>
                          <td className="num py-2.5 text-right">{pct(p.modelP)}</td>
                          <td className="num py-2.5 text-right text-s-muted">{p.marketP == null ? <span className="text-xs">{t('noMarket')}</span> : pct(p.marketP)}</td>
                          <td className={`num py-2.5 text-right font-semibold ${p.edge == null ? 'text-s-muted' : p.edge >= 0.05 ? 'text-s-loss' : ''}`}>{p.edge == null ? '–' : pp(p.edge)}</td>
                          <td className="py-2.5 text-right">
                            <span className="inline-flex items-center justify-end gap-2">
                              <span className="num"><span className="font-bold text-s-win">{pct(s.acc)}</span> <span className="text-xs text-s-muted">{s.won}/{s.n} · {s.scope === 'league' ? t('scopeLeague') : t('scopeAll')}</span></span>
                              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${verdictTone[s.verdict]}`}>{verdictLabel[s.verdict]}</span>
                            </span>
                          </td>
                          <td className="py-2.5 text-right">{a ? <AssessmentChip status={a.status} label={ta(`statusShort.${a.status}`)} /> : <span className="text-s-muted">–</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {focus && (focus.leagues.length > 0 || focus.all.strong > 0) && (
        <section className="mt-14" aria-labelledby="picks-focus">
          <SectionTitle id="picks-focus" title={t('focusTitle')} sub={t('focusLead')} />
          <div className="tbl-scroll mt-4">
            <table className="text-sm">
              <thead className="text-xs uppercase tracking-wider text-s-muted">
                <tr className="border-b border-s-line">
                  <th className="py-1.5 text-left font-medium">{t('focusColLeague')}</th>
                  {FOCUS_MARKETS.map((m) => <th key={m} className="py-1.5 pr-3 text-right font-medium">{marketName[m]}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-s-line font-semibold">
                  <td className="py-2.5 pr-3">{t('focusAll')}</td>
                  {FOCUS_MARKETS.map((m) => <FocusTd key={m} c={focus.all.cells[m]} />)}
                </tr>
                {focus.leagues.map((r) => (
                  <tr key={r.league!.slug} className="border-b border-s-line">
                    <td className="py-2.5 pr-3 align-top">
                      <Link href={`/leagues/${r.league!.slug}`} className="font-semibold hover:underline">{r.league!.name}</Link>
                      <span className="num mt-0.5 block text-xs text-s-muted">{r.strong}/3</span>
                    </td>
                    {FOCUS_MARKETS.map((m) => <FocusTd key={m} c={r.cells[m]} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {observeStrong.length > 0 && (
            <div className="mt-8">
              <h3 className="text-[15px] font-bold text-s-ink">{t('focusObserveTitle')}</h3>
              <p className="mt-1 max-w-3xl text-[13.5px] text-s-muted">{t('focusObserveLead')}</p>
              <div className="tbl-scroll mt-3">
                <table className="text-sm">
                  <thead className="text-xs uppercase tracking-wider text-s-muted">
                    <tr className="border-b border-s-line">
                      <th className="py-1.5 text-left font-medium">{t('focusColLeague')}</th>
                      <th className="py-1.5 text-left font-medium">{t('colMarketName')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
                      <th className="py-1.5 text-right font-medium">{t('colHit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observeStrong.map((r) => (
                      <tr key={`${r.leagueId}-${r.market}`} className="border-b border-s-line">
                        <td className="py-2 pr-3">{r.ccode ? `${r.ccode} · ${r.name}` : r.name}</td>
                        <td className="py-2 pr-3 font-semibold">{strongMarketName[r.market]}</td>
                        <td className="num py-2 text-right text-s-muted">{t('focusObserveFrom', { p: pct(r.from) })}</td>
                        <td className="num py-2 text-right"><span className="font-bold text-s-win">{pct(r.acc)}</span> <span className="text-xs text-s-muted">{r.won}/{r.n}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="mt-3 max-w-3xl text-xs text-s-muted">{t('focusNote')}</p>
        </section>
      )}

      <section className="mt-14" aria-labelledby="picks-history">
        <SectionTitle id="picks-history" title={t('historyTitle')} sub={t('historyLead')} />
        {historyDays.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-s-muted">{t('historyEmpty')}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-8">
            {historyDays.map((d) => {
              const dayLabel = f.dateTime(new Date(`${d.day}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' });
              const marketsMeta = (['1x2', 'ou25', 'btts'] as const).filter((m) => d.byMarket[m].n > 0).map((m) => `${marketName[m]} ${d.byMarket[m].won}/${d.byMarket[m].n}`).join(' · ');
              return (
                <section key={d.day}>
                  <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-s-line pb-2 text-[15px] font-bold text-s-ink">
                    <span>{dayLabel}</span>
                    <span className="num text-[13px] font-semibold text-s-muted">
                      {t('historyDayMeta', { won: d.won, n: d.n })}
                      {marketsMeta && <span className="font-normal"> · {marketsMeta}</span>}
                      {d.pending > 0 && <span className="font-normal"> · {t('historyPending', { n: d.pending })}</span>}
                    </span>
                  </h3>
                  <div className="tbl-scroll">
                    <table className="text-sm">
                      <thead className="text-xs uppercase tracking-wider text-s-muted">
                        <tr className="border-b border-s-line">
                          <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
                          <th className="py-1.5 text-left font-medium">{t('colMarketName')}</th>
                          <th className="py-1.5 text-left font-medium">{t('colSelection')}</th>
                          <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
                          <th className="py-1.5 text-right font-medium">{t('colEdge')}</th>
                          <th className="py-1.5 text-right font-medium">{t('colScore')}</th>
                          <th className="py-1.5 text-right font-medium">{t('colHit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.picks.map((p: SettledStandingPick) => (
                          <tr key={`${p.fixtureId}-${p.market}`} className="border-b border-s-line">
                            <td className="py-2.5 pr-3">
                              <Link href={`/predictions/${p.fixtureId}?back=${encodeURIComponent('from=picks')}`} className="group flex items-center gap-2 hover:underline">
                                <span className="flex shrink-0 -space-x-1"><Crest src={p.homeCrest} alt="" /><Crest src={p.awayCrest} alt="" /></span>
                                <span className="min-w-0"><span className={p.market === '1x2' && p.selection === '1' ? 'font-bold' : ''}>{p.homeName}</span> – <span className={p.market === '1x2' && p.selection === '2' ? 'font-bold' : ''}>{p.awayName}</span></span>
                              </Link>
                              <span className="mt-0.5 block text-xs text-s-muted">{p.leagueLabel} · <LocalTime iso={p.kickoff} format="time" /></span>
                            </td>
                            <td className="py-2.5 pr-3 text-s-muted">{marketName[p.market]}</td>
                            <td className="py-2.5 pr-3 font-semibold">{selectionName(p.market, p.selection, p.homeName, p.awayName)}</td>
                            <td className="num py-2.5 text-right">{pct(p.modelP)}</td>
                            <td className={`num py-2.5 text-right font-semibold ${p.edge == null ? 'text-s-muted' : p.edge >= 0.05 ? 'text-s-loss' : ''}`}>{p.edge == null ? '–' : pp(p.edge)}</td>
                            <td className="num py-2.5 text-right">{p.homeScore == null || p.awayScore == null ? '–' : `${p.homeScore}–${p.awayScore}`}</td>
                            <td className="py-2.5 text-right">
                              <span className="inline-flex items-center justify-end gap-2">
                                <span className="num text-xs text-s-muted">{pct(p.acc)} · {p.evidenceWon}/{p.evidenceN}</span>
                                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${resultTone(p.won)}`}>{resultLabel(p.won)}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section className="card mt-10 !gap-2 text-[13.5px] text-s-muted">
        <h2 className="text-[15px] font-bold text-s-ink">{t('howTitle')}</h2>
        <p>{t('howLevel')}</p>
        <p>{t('howEdge')}</p>
        <p>{t('howStrong')} <Link href="/performance" className="font-semibold text-s-ink hover:underline">{tm('standingLink')}</Link></p>
      </section>
    </Page>
  );
}
