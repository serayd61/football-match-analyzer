import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listDay } from '@/lib/site/fixtures';
import { getMarketSnapshots } from '@/lib/site/dashboard';
import { getPerformance } from '@/lib/site/performance';
import { dailyStandingBoard, type StandingPick } from '@/lib/site/daily-standing';
import { todayYmd, addDays, YMD_RE } from '@/lib/site/time';
import { requireSiteAccess } from '@/lib/site/access';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { Paywall, TrialNotice } from '@/components/site/Paywall';
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
  const date = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : today;
  const access = await requireSiteAccess(locale, `/picks${date !== today ? `?date=${date}` : ''}`);
  const [t, tc, tm, tv, f] = await Promise.all([
    getTranslations('picks'), getTranslations('common'), getTranslations('match'), getTranslations('v2.predictions'), getFormatter(),
  ]);

  if (access.state === 'expired') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <Paywall />
      </Page>
    );
  }

  const [day, perf] = await Promise.all([listDay(date), getPerformance(null).catch(() => null)]);
  const rows = day.rows.filter((r) => r.covered && r.hasModel);
  const snaps = await getMarketSnapshots(rows.map((r) => r.fixtureId));
  const board = perf ? dailyStandingBoard(rows, snaps, perf.signals) : { markets: [], scanned: rows.length, matches: 0 };
  const marketName = { '1x2': tv('mkt1x2'), ou25: tc('ou25'), btts: tc('btts') } as const;
  const verdictLabel = { strong: tm('verdictStrong'), mid: tm('verdictMid'), weak: tm('verdictWeak'), thin: tm('verdictThin') } as const;
  const selection = (p: StandingPick) =>
    p.market === '1x2' ? (p.selection === '1' ? p.row.homeName : p.selection === '2' ? p.row.awayName : tc('draw'))
      : p.market === 'ou25' ? (p.selection === 'over' ? tm('standingOver') : tm('standingUnder'))
        : (p.selection === 'yes' ? tm('standingYes') : tm('standingNo'));
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

      <p className="num -mt-2 pb-4 text-[13px] font-semibold text-s-muted">{t('meta', { scanned: board.scanned, matches: board.matches })}</p>

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
                    </tr>
                  </thead>
                  <tbody>
                    {picks.map((p) => {
                      const s = p.standing;
                      return (
                        <tr key={`${market}-${p.fixtureId}`} className="border-b border-s-line">
                          <td className="py-2.5 pr-3">
                            <Link href={`/predictions/${p.fixtureId}?back=${encodeURIComponent(back)}`} className="group flex items-center gap-2 hover:underline">
                              <span className="flex shrink-0 -space-x-1"><Crest src={p.row.homeCrest} alt="" /><Crest src={p.row.awayCrest} alt="" /></span>
                              <span className="min-w-0"><span className={p.selection === '1' ? 'font-bold' : ''}>{p.row.homeName}</span> – <span className={p.selection === '2' ? 'font-bold' : ''}>{p.row.awayName}</span></span>
                            </Link>
                            <span className="mt-0.5 block text-xs text-s-muted">{p.row.leagueName} · <LocalTime iso={p.row.kickoff} format="time" /></span>
                          </td>
                          <td className="py-2.5 pr-3 font-semibold">{selection(p)}</td>
                          <td className="num py-2.5 text-right">{pct(p.modelP)}</td>
                          <td className="num py-2.5 text-right text-s-muted">{p.marketP == null ? <span className="text-xs">{t('noMarket')}</span> : pct(p.marketP)}</td>
                          <td className={`num py-2.5 text-right font-semibold ${p.edge == null ? 'text-s-muted' : p.edge > 0.03 ? 'text-s-win' : p.edge < -0.03 ? 'text-s-loss' : ''}`}>{p.edge == null ? '–' : pp(p.edge)}</td>
                          <td className="py-2.5 text-right">
                            <span className="inline-flex items-center justify-end gap-2">
                              <span className="num"><span className="font-bold text-s-win">{pct(s.acc)}</span> <span className="text-xs text-s-muted">{s.won}/{s.n} · {s.scope === 'league' ? t('scopeLeague') : t('scopeAll')}</span></span>
                              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${verdictTone[s.verdict]}`}>{verdictLabel[s.verdict]}</span>
                            </span>
                          </td>
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

      <section className="card mt-10 !gap-2 text-[13.5px] text-s-muted">
        <h2 className="text-[15px] font-bold text-s-ink">{t('howTitle')}</h2>
        <p>{t('howLevel')}</p>
        <p>{t('howEdge')}</p>
        <p>{t('howStrong')} <Link href="/performance" className="font-semibold text-s-ink hover:underline">{tm('standingLink')}</Link></p>
      </section>
    </Page>
  );
}
