import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { nextDayWithPredictions } from '@/lib/site/predictions';
import { listDay } from '@/lib/site/fixtures';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { applyFilters, parseFilters } from '@/lib/site/filters';
import { todayYmd, addDays, YMD_RE, zonedStartOfDay } from '@/lib/site/time';
import { Page, EmptyState } from '@/components/site/ui';
import PredictionCard, { type OutsideRisk } from '@/components/site/PredictionCard';
import { coverageById } from '@/lib/coverage/registry';
import { sumBuckets, coverageStanding, coverageRisk, leagueSummary, strongPickFor, strongRisk } from '@/lib/site/coverage-risk';
import { RiskNote } from '@/components/site/Risk';
import { requireSiteAccess } from '@/lib/site/access';
import { Paywall, TrialNotice } from '@/components/site/Paywall';

// Members-only (2026-09-08): session read → dynamic; shared data stays cached in the lib layer.
export const dynamic = 'force-dynamic';

// Predictions (Modernist redesign 2026-09-11). Header row with the day and
// the model's update time, league filter buttons (state in the URL), a
// toggleable "How to read confidence" note, then a 3-column grid of cards.
// The date strip and the covered/all switch survive as small links.

type Search = { date?: string; league?: string; scope?: string; note?: string; q?: string; status?: string; ready?: string; sort?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'predictions' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/predictions') };
}

export default async function PredictionsPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  // Giriş dönüşünde filtreler korunur: callbackUrl tam sorguyu taşır.
  const backQs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === 'string')).toString();
  const access = await requireSiteAccess(locale, `/predictions${backQs ? `?${backQs}` : ''}`);
  const t = await getTranslations('v2.predictions');
  const tp = await getTranslations('predictions');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  if (access.state === 'expired') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <Paywall />
      </Page>
    );
  }

  const today = todayYmd();
  const date = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : today;
  const league = searchParams.league ? leagueBySlug(searchParams.league) : null;
  const scope = searchParams.scope === 'all' ? 'all' : 'covered';
  const showNote = searchParams.note !== '0';

  const day = await listDay(date);
  const all = day.rows;
  // Kapsam dışı maçlar artık ana ızgaraya karışmaz; aşağıda lig lig gruplanır (2026-09-23).
  const scoped = all.filter((r) => r.covered);
  const inLeague = league ? scoped.filter((r) => r.league?.slug === league.slug) : scoped;
  // Denetim B10: filters.ts (arama/durum/hazır/sıralama) kart tasarımına geçişte sayfadan düşmüştü.
  const flt = parseFilters(searchParams);
  const rows = applyFilters(inLeague, flt);
  const filtersOn = !!flt.q || flt.status !== 'all' || flt.ready || flt.sort !== 'time';
  const uncoveredCount = all.filter((r) => !r.covered).length;
  // Kapsam dışı: lig lig grupla, risk notunu lig dilim karnesinden ver (lib/site/coverage-risk).
  const uncoveredRows = league ? [] : applyFilters(all.filter((r) => !r.covered && r.hasModel), flt);
  const cov = uncoveredRows.length ? await coverageById() : new Map<number, Awaited<ReturnType<typeof coverageById>> extends Map<number, infer R> ? R : never>();
  const outsideAll = sumBuckets([...cov.values()].filter((c) => c.status !== 'whitelist').map((c) => c.stats));
  const mktName: Record<string, string> = { x12: t('mkt1x2'), ou25: t('mktOver'), under25: t('mktUnder'), btts: t('mktBtts') };
  const groups = new Map<string, { name: string; ccode: string | null; n: number; strong: number; meta: string; strongMeta: string[]; rows: Array<{ p: (typeof uncoveredRows)[number]; outside: OutsideRisk }> }>();
  for (const p of uncoveredRows) {
    const c = p.leagueId != null ? cov.get(p.leagueId) : undefined;
    const input = {
      pick: p.pick, pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway,
      over: p.overUnder ? { pick: p.overUnder.pick, pRaw: p.overUnder.pRaw } : null,
      btts: p.btts ? { pick: p.btts.pick, pRaw: p.btts.pRaw } : null,
    };
    const standing = coverageStanding(input, c?.stats?.buckets ?? null, outsideAll);
    // Güçlü pazar (≥15 maç, ≥%70): seçim o bölgeye düşüyorsa risk ve not oradan (24 Eyl).
    const sp = strongPickFor(input, c?.stats?.strong);
    const x = standing.find((r) => r.market === '1x2');
    const note = sp ? t('strongPick', { market: mktName[sp.market], p: Math.round(sp.p * 100), won: sp.sm.won, n: sp.sm.n, acc: Math.round((sp.sm.won / sp.sm.n) * 100) })
      : !x || x.acc == null ? t('outsideThin')
      : t(x.scope === 'league' ? 'outsideEvidence' : 'outsideEvidenceAll', { bucket: x.primary.bucket, won: x.won, n: x.n, acc: Math.round(x.acc * 100) });
    const key = String(p.leagueId ?? p.leagueName);
    if (!groups.has(key)) {
      const sm = leagueSummary(c?.stats);
      const meta = sm.x12 != null ? t('leagueMeta', { n: sm.n, x12: sm.x12, ou: sm.ou ?? '–', btts: sm.btts ?? '–' }) : t('leagueMetaThin', { n: sm.n });
      const strongMeta = (c?.stats?.strong ?? []).map((m) => t('strongLeague', { market: mktName[m.market], from: Math.round(m.from * 100), won: m.won, n: m.n, acc: Math.round((m.won / m.n) * 100) }));
      groups.set(key, { name: c?.name || p.leagueName, ccode: c?.ccode ?? null, n: sm.n, strong: strongMeta.length, meta, strongMeta, rows: [] });
    }
    groups.get(key)!.rows.push({ p, outside: { risk: sp ? strongRisk(sp) : coverageRisk(standing), note } });
  }
  // Güçlü pazarı olan ligler önce, sonra karne büyüklüğü.
  const uncoveredGroups = [...groups.values()].sort((a, b) => b.strong - a.strong || b.n - a.n || a.name.localeCompare(b.name));

  const dayLabel = (ymd: string) =>
    ymd === today ? tc('today') : ymd === addDays(today, 1) ? tc('tomorrow') : ymd === addDays(today, -1) ? tc('yesterday')
    : f.dateTime(zonedStartOfDay(ymd), { weekday: 'short', day: 'numeric', month: 'short' });

  const href = (over: Partial<Search>) => {
    const qs = new URLSearchParams();
    const m = { date, league: league?.slug, scope, note: showNote ? undefined : '0', q: flt.q || undefined, status: flt.status === 'all' ? undefined : flt.status, ready: flt.ready ? '1' : undefined, sort: flt.sort === 'time' ? undefined : flt.sort, ...over };
    if (m.date && m.date !== today) qs.set('date', m.date);
    if (m.league) qs.set('league', m.league);
    if (m.scope === 'all') qs.set('scope', 'all');
    if (m.note === '0') qs.set('note', '0');
    if (m.q) qs.set('q', m.q);
    if (m.status) qs.set('status', m.status);
    if (m.ready) qs.set('ready', '1');
    if (m.sort) qs.set('sort', m.sort);
    const s = qs.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };

  const nextDay = scoped.length === 0 ? await nextDayWithPredictions(date, 1) : null;
  const leaguesToday = SITE_LEAGUES.filter((l) => scoped.some((r) => r.league?.slug === l.slug));
  const updated = day.feed === 'ok' ? f.dateTime(new Date(day.fetchedAt), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
  // Denetim B11: day.fetchedAt akışın okunma anıdır; tahminin yayın zamanı satırların updated_at'idir.
  const lastPublished = rows.reduce<string | null>((m, r) => (r.hasModel && r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
  const published = lastPublished ? f.dateTime(new Date(lastPublished), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
  const fullDay = f.dateTime(zonedStartOfDay(date), { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Page>
      {/* Header row */}
      <div className="rule-b flex flex-wrap items-end justify-between gap-4 pb-4 pt-8">
        <div>
          <h1 className="text-[32px] sm:text-[40px]">{date === today ? t('title') : t('titleDay', { day: dayLabel(date) })}</h1>
          <p className="mt-2 text-[14px] text-s-muted">
            {updated ? t('meta', { day: fullDay, matches: rows.length, time: updated }) : t('metaNoFeed', { day: fullDay, matches: rows.length })}
            {published && <> · {t('published', { time: published })}</>}
          </p>
        </div>
        <nav aria-label={tc('league')} className="flex flex-wrap gap-1">
          <Link href={href({ league: undefined })} className={`btn btn-sm ${!league ? 'btn-primary' : 'btn-secondary'}`} aria-current={!league ? 'true' : undefined}>{t('all')}</Link>
          {(leaguesToday.length ? leaguesToday : SITE_LEAGUES).map((l) => (
            <Link key={l.slug} href={href({ league: l.slug })} className={`btn btn-sm ${league?.slug === l.slug ? 'btn-primary' : 'btn-secondary'}`} aria-current={league?.slug === l.slug ? 'true' : undefined}>{l.name}</Link>
          ))}
        </nav>
      </div>

      {/* Day strip + scope */}
      <div className="rule-b-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-[13px]">
        <span className="flex gap-4">
          <Link href={href({ date: addDays(date, -1) })} className="font-semibold hover:text-s-accent-600">{t('dayPrev')}</Link>
          <Link href={href({ date: addDays(date, 1) })} className="font-semibold hover:text-s-accent-600">{t('dayNext')}</Link>
        </span>
        <span className="flex gap-4 text-s-muted">
          {uncoveredCount > 0 && (
            <Link href={href({ scope: scope === 'all' ? 'covered' : 'all' })} className="hover:text-s-ink">
              {scope === 'all' ? t('hideUncovered') : t('showUncovered', { count: uncoveredCount })}
            </Link>
          )}
          <Link href={href({ note: showNote ? '0' : undefined })} className="hover:text-s-ink">{showNote ? t('hide') : t('show')}</Link>
        </span>
      </div>

      {/* Filtreler: JS'siz GET formu — durum URL'de, geri/ileri ve paylaşım kendiliğinden çalışır */}
      <form method="get" action="" role="search" className="rule-b-1 flex flex-wrap items-center gap-2 py-3 text-[13px]">
        {date !== today && <input type="hidden" name="date" value={date} />}
        {league && <input type="hidden" name="league" value={league.slug} />}
        {scope === 'all' && <input type="hidden" name="scope" value="all" />}
        {!showNote && <input type="hidden" name="note" value="0" />}
        <label className="sr-only" htmlFor="flt-q">{tc('search')}</label>
        <input id="flt-q" name="q" type="search" defaultValue={flt.q} placeholder={t('searchPh')} maxLength={60} className="input h-9 w-full min-w-0 sm:w-56" />
        <label className="sr-only" htmlFor="flt-status">{tc('status')}</label>
        <select id="flt-status" name="status" defaultValue={flt.status} className="input h-9">
          <option value="all">{t('statusAll')}</option>
          <option value="upcoming">{t('statusUpcoming')}</option>
          <option value="live">{t('statusLive')}</option>
          <option value="finished">{t('statusFinished')}</option>
        </select>
        <label className="sr-only" htmlFor="flt-sort">{tc('sort')}</label>
        <select id="flt-sort" name="sort" defaultValue={flt.sort} className="input h-9">
          <option value="time">{t('sortTime')}</option>
          <option value="confidence">{t('sortConfidence')}</option>
        </select>
        <label className="flex min-h-[36px] items-center gap-2"><input type="checkbox" name="ready" value="1" defaultChecked={flt.ready} /> {t('ready')}</label>
        <button type="submit" className="btn btn-sm btn-primary">{t('apply')}</button>
        {filtersOn && <Link href={href({ q: undefined, status: undefined, ready: undefined, sort: undefined })} className="btn btn-sm btn-secondary">{tc('clear')}</Link>}
      </form>
      {filtersOn && (
        <p role="status" className="py-2 text-[13px] text-s-muted">
          {t('filtered', { shown: rows.length, total: inLeague.length })}
          {flt.sort === 'confidence' && <> · {t('sortNote')}</>}
        </p>
      )}

      {showNote && (
        <RiskNote className="mt-4 max-w-[760px]">
          <strong>{t('howTitle')}</strong> {t('howText')}
        </RiskNote>
      )}

      <div className="mt-4"><TrialNotice access={access} /></div>

      {day.feed === 'error' && (
        <p role="status" className="risk-note mb-3">{tp('feedError')}</p>
      )}

      {rows.length === 0 && filtersOn && inLeague.length > 0 ? (
        <EmptyState title={t('emptyFiltered')} lead={t('emptyFilteredLead')} action={<Link href={href({ q: undefined, status: undefined, ready: undefined, sort: undefined })} className="btn btn-secondary">{tc('clear')}</Link>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          lead={nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : tp('emptyLead')}
          action={nextDay ? <Link href={href({ date: nextDay })} className="btn btn-primary">{t('goToNext', { date: dayLabel(nextDay) })}</Link> : (league ? <Link href={href({ league: undefined })} className="btn btn-secondary">{t('all')}</Link> : undefined)}
        />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => <PredictionCard key={p.fixtureId} p={p} />)}
          </div>
          <p className="mt-6 text-[12px] text-s-muted">{t('footnote')}</p>
        </>
      )}

      {/* ── Kapsam dışı ligler: lig lig, risk notu dilim karnesinden ─────── */}
      {uncoveredGroups.length > 0 && (
        <details open={scope === 'all'} className="rule-t mt-8 pt-6">
          <summary className="cursor-pointer text-[18px] font-semibold">{t('uncoveredTitle', { count: uncoveredRows.length, leagues: uncoveredGroups.length })}</summary>
          <p className="mt-2 max-w-[68ch] text-[13px] text-s-muted">{t('uncoveredLead')}</p>
          {uncoveredGroups.map((g) => (
            <section key={g.name + (g.ccode ?? '')} className="mt-6">
              <div className="rule-b-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
                <h2 className="text-[18px]">{g.name}{g.ccode && <span className="ml-2 text-[13px] font-normal text-s-muted">{g.ccode}</span>}</h2>
                <span className="num text-[12px] text-s-muted">{g.meta}</span>
              </div>
              {g.strongMeta.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-2">
                  {g.strongMeta.map((m) => <span key={m} className="tag tag-accent num">{m}</span>)}
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.rows.map(({ p, outside }) => <PredictionCard key={p.fixtureId} p={p} outside={outside} />)}
              </div>
            </section>
          ))}
        </details>
      )}
    </Page>
  );
}
