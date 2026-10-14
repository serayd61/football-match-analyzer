import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listScoreDay, scoreHistory, type ScoreRow } from '@/lib/site/exact-scores';
import { EXACT_SCORE_MIN, SCORE_BUCKETS, hitRate, claimedRate, scoreLabel, type Tally } from '@/lib/site/exact-score';
import { todayYmd, addDays, YMD_RE } from '@/lib/site/time';
import { requireSiteAccess } from '@/lib/site/access';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { StatRow, StatCell } from '@/components/site/StatCell';
import { Paywall, TrialNotice } from '@/components/site/Paywall';
import { Crest } from '@/components/site/PredictionTable';
import LocalTime from '@/components/site/LocalTime';

// Skor tahminleri (2026-10-14): modelin λ'larından türeyen en olası skor, olasılığı
// ≥%15 olan maçlar (kapsanan + kapsam dışı). Her satırın yanında o dilimin ve o
// skorun son 30 günlük gerçek isabeti; altta gün gün geçmiş. Üyelere özel.
export const dynamic = 'force-dynamic';

type Search = { date?: string };
const HISTORY_DAYS = 30;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'scores' });
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: alternatesFor(locale as Locale, '/scores'), robots: { index: false, follow: false } };
}

const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const pct1 = (x: number | null | undefined) => (x == null ? '–' : `${(x * 100).toFixed(1)}%`);

export default async function ScoresPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const today = todayYmd();
  const tomorrow = addDays(today, 1);
  const requested = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : null;
  let date = requested ?? today;
  const access = await requireSiteAccess(locale, `/scores${requested ? `?date=${requested}` : ''}`);
  const [t, tc, f] = await Promise.all([getTranslations('scores'), getTranslations('common'), getFormatter()]);

  if (access.state === 'expired') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <Paywall />
      </Page>
    );
  }

  let [day, history] = await Promise.all([listScoreDay(date), scoreHistory(HISTORY_DAYS, today)]);
  const upcoming = (rows: ScoreRow[]) => rows.some((r) => r.won == null && r.status !== 'finished' && r.status !== 'cancelled' && r.status !== 'postponed');
  let rolled = false;
  if (!requested && day.rows.length > 0 && !upcoming(day.rows)) {
    const next = await listScoreDay(tomorrow);
    if (upcoming(next.rows)) { day = next; date = tomorrow; rolled = true; }
  }

  const bucketName: Record<string, string> = { '15-18': t('bucket1518'), '18-20': t('bucket1820'), '20+': t('bucket20') };
  const resultTone = (won: boolean | null) => (won == null ? 'border border-s-line text-s-muted' : won ? 'bg-s-win text-white' : 'bg-s-loss text-white');
  const resultLabel = (won: boolean | null) => (won == null ? t('resultPending') : won ? t('resultWon') : t('resultLost'));
  const record = (tl: Tally | undefined) => (!tl || tl.n === 0 ? <span className="text-xs text-s-muted">{t('noRecord')}</span> : <><span className={`font-bold ${(hitRate(tl) ?? 0) >= (claimedRate(tl) ?? 0) ? 'text-s-win' : 'text-s-ink'}`}>{pct(hitRate(tl))}</span> <span className="text-xs text-s-muted">{tl.won}/{tl.n}</span></>);
  const byScore = new Map(history.byScore.map((s) => [s.score, s.tally]));
  const back = `from=scores${date !== today ? `&date=${date}` : ''}`;
  const dateLabel = f.dateTime(new Date(`${date}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' });
  const dayWon = day.rows.filter((r) => r.won === true).length, daySettled = day.rows.filter((r) => r.won != null).length;

  const MatchCell = ({ r, from }: { r: ScoreRow; from: string }) => (
    <td className="py-2.5 pr-3">
      <Link href={`/predictions/${r.fixtureId}?back=${encodeURIComponent(from)}`} className="group flex items-center gap-2 hover:underline">
        <span className="flex shrink-0 -space-x-1"><Crest src={r.homeCrest} alt="" /><Crest src={r.awayCrest} alt="" /></span>
        <span className="min-w-0">{r.homeName} – {r.awayName}</span>
      </Link>
      <span className="mt-0.5 block text-xs text-s-muted">{r.leagueLabel} · <LocalTime iso={r.kickoff} format="time" /></span>
    </td>
  );

  return (
    <Page>
      <div className="pt-5"><TrialNotice access={access} /></div>
      <PageTitle
        eyebrow={`${t('eyebrow')} · ${dateLabel}`}
        title={t('title')}
        lead={t('lead', { min: Math.round(EXACT_SCORE_MIN * 100) })}
        aside={(
          <nav className="seg" aria-label={t('eyebrow')}>
            <Link href="/scores" aria-current={date === today ? 'true' : undefined}>{tc('today')}</Link>
            <Link href={`/scores?date=${tomorrow}`} aria-current={date === tomorrow ? 'true' : undefined}>{tc('tomorrow')}</Link>
          </nav>
        )}
      />

      <StatRow cols={4} className="mb-8">
        <StatCell first label={t('statWindow', { days: HISTORY_DAYS })} value={history.all.n} note={t('statWindowNote', { min: Math.round(EXACT_SCORE_MIN * 100) })} />
        <StatCell label={t('statHit')} value={pct1(hitRate(history.all))} note={t('statHitNote', { won: history.all.won, n: history.all.n })} tone={history.all.n ? 'accent' : 'muted'} />
        <StatCell label={t('statClaimed')} value={pct1(claimedRate(history.all))} note={t('statClaimedNote')} tone="muted" />
        <StatCell label={t('statToday')} value={day.rows.length} note={daySettled ? t('statTodaySettled', { won: dayWon, n: daySettled }) : t('statTodayNote', { scanned: day.scanned })} />
      </StatRow>

      <p className="num -mt-2 pb-4 text-[13px] font-semibold text-s-muted">
        {t('meta', { scanned: day.scanned, matches: day.rows.length })}
        {rolled && <span className="ml-2 font-normal">· {t('rolledOver')}</span>}
      </p>

      {day.rows.length === 0 ? (
        <EmptyState
          title={day.scanned === 0 ? t('emptyNoMatches') : t('emptyTitle')}
          lead={day.scanned === 0 ? undefined : t('emptyLead', { scanned: day.scanned, min: Math.round(EXACT_SCORE_MIN * 100) })}
          action={<Link href={`/predictions${date !== today ? `?date=${date}` : ''}`} className="btn btn-secondary btn-sm">{t('allPredictions')}</Link>}
        />
      ) : (
        <div className="tbl-scroll">
          <table className="text-sm">
            <thead className="text-xs uppercase tracking-wider text-s-muted">
              <tr className="border-b border-s-line">
                <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
                <th className="py-1.5 text-right font-medium">{t('colScore')}</th>
                <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
                <th className="py-1.5 text-right font-medium">{t('colBucketRecord')}</th>
                <th className="py-1.5 text-right font-medium">{t('colScoreRecord')}</th>
                <th className="py-1.5 text-right font-medium">{t('colResult')}</th>
              </tr>
            </thead>
            <tbody>
              {day.rows.map((r) => (
                <tr key={r.fixtureId} className="border-b border-s-line">
                  <MatchCell r={r} from={back} />
                  <td className="num py-2.5 pr-3 text-right text-[17px] font-extrabold">{scoreLabel(r.score)}</td>
                  <td className="num py-2.5 pr-3 text-right">{pct(r.score.p)} <span className="block text-xs text-s-muted">{bucketName[r.bucket]}</span></td>
                  <td className="num py-2.5 pr-3 text-right">{record(history.byBucket[r.bucket])}</td>
                  <td className="num py-2.5 pr-3 text-right">{record(byScore.get(scoreLabel(r.score)))}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {r.homeScore != null && r.awayScore != null && <span className="num text-xs text-s-muted">{r.homeScore}–{r.awayScore}</span>}
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${resultTone(r.won)}`}>{resultLabel(r.won)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-14" aria-labelledby="scores-record">
        <SectionTitle id="scores-record" title={t('recordTitle', { days: HISTORY_DAYS })} sub={t('recordLead')} />
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-[15px] font-bold text-s-ink">{t('byBucketTitle')}</h3>
            <table className="mt-2 w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-s-muted"><tr className="border-b border-s-line"><th className="py-1.5 text-left font-medium">{t('colBucket')}</th><th className="py-1.5 text-right font-medium">{t('colClaimed')}</th><th className="py-1.5 text-right font-medium">{t('colHit')}</th></tr></thead>
              <tbody>
                {SCORE_BUCKETS.map((b) => { const tl = history.byBucket[b]; return (
                  <tr key={b} className="border-b border-s-line"><td className="py-2 pr-3 font-semibold">{bucketName[b]}</td><td className="num py-2 pr-3 text-right text-s-muted">{pct(claimedRate(tl))}</td><td className="num py-2 text-right">{record(tl)}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-s-ink">{t('byScoreTitle')}</h3>
            <table className="mt-2 w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-s-muted"><tr className="border-b border-s-line"><th className="py-1.5 text-left font-medium">{t('colScore')}</th><th className="py-1.5 text-right font-medium">{t('colClaimed')}</th><th className="py-1.5 text-right font-medium">{t('colHit')}</th></tr></thead>
              <tbody>
                {history.byScore.map(({ score, tally }) => (
                  <tr key={score} className="border-b border-s-line"><td className="num py-2 pr-3 font-semibold">{score}</td><td className="num py-2 pr-3 text-right text-s-muted">{pct(claimedRate(tally))}</td><td className="num py-2 text-right">{record(tally)}</td></tr>
                ))}
                {history.byScore.length === 0 && <tr><td colSpan={3} className="py-2 text-s-muted">{t('historyEmpty')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="scores-history">
        <SectionTitle id="scores-history" title={t('historyTitle')} sub={t('historyLead')} meta={history.pending > 0 ? t('historyPending', { n: history.pending }) : undefined} />
        {history.recent.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-s-muted">{t('historyEmpty')}</p>
        ) : (
          <div className="tbl-scroll mt-3">
            <table className="text-sm">
              <thead className="text-xs uppercase tracking-wider text-s-muted">
                <tr className="border-b border-s-line">
                  <th className="py-1.5 text-left font-medium">{t('colMatch')}</th>
                  <th className="py-1.5 text-right font-medium">{t('colScore')}</th>
                  <th className="py-1.5 text-right font-medium">{t('colModel')}</th>
                  <th className="py-1.5 text-right font-medium">{t('colActual')}</th>
                  <th className="py-1.5 text-right font-medium">{t('colResult')}</th>
                </tr>
              </thead>
              <tbody>
                {history.recent.map((r) => (
                  <tr key={r.fixtureId} className="border-b border-s-line">
                    <MatchCell r={r} from="from=scores" />
                    <td className="num py-2.5 pr-3 text-right font-extrabold">{scoreLabel(r.score)}</td>
                    <td className="num py-2.5 pr-3 text-right">{pct(r.score.p)}</td>
                    <td className="num py-2.5 pr-3 text-right">{r.homeScore}–{r.awayScore}</td>
                    <td className="py-2.5 text-right"><span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${resultTone(r.won)}`}>{resultLabel(r.won)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-10 !gap-2 text-[13.5px] text-s-muted">
        <h2 className="text-[15px] font-bold text-s-ink">{t('howTitle')}</h2>
        <p>{t('howModel')}</p>
        <p>{t('howRecord')}</p>
        <p>{t('howHonest')}</p>
      </section>
    </Page>
  );
}
