import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { nextDayWithPredictions } from '@/lib/site/predictions';
import { listDay } from '@/lib/site/fixtures';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { applyFilters, parseFilters, marketProb, MIN_P_STEPS } from '@/lib/site/filters';
import { todayYmd, addDays, YMD_RE, zonedStartOfDay } from '@/lib/site/time';
import { Page, EmptyState } from '@/components/site/ui';
import { type OutsideRisk } from '@/components/site/PredictionCard';
import MatchRow from '@/components/site/MatchRow';
import PredictionsToolbar from '@/components/site/PredictionsToolbar';
import LeagueGroup from '@/components/site/LeagueGroup';
import { coverageById } from '@/lib/coverage/registry';
import { countryName } from '@/lib/site/countries';
import { sectionId } from '@/lib/site/back-link';
import { sumBuckets, coverageStanding, coverageRisk, leagueSummary, strongPickFor, strongRisk } from '@/lib/site/coverage-risk';
import { RiskNote } from '@/components/site/Risk';
import { requireSiteAccess } from '@/lib/site/access';
import { Paywall, TrialNotice } from '@/components/site/Paywall';

// Members-only (2026-09-08): session read → dynamic; shared data stays cached in the lib layer.
export const dynamic = 'force-dynamic';

// Predictions v3 (2026-09-26). One toolbar (day · leagues · filters) drives the
// URL; below it the day's fixtures grouped by league as compact rows. Leagues
// outside model coverage follow in their own groups when the "other leagues"
// chip is on. All query keys are unchanged from v2.

type Search = { date?: string; league?: string; country?: string; scope?: string; note?: string; q?: string; status?: string; ready?: string; sort?: string; market?: string; minp?: string };

// Kapsam dışı lig filtresi (2026-09-26): `league=u<leagueId>` tek lig, `country=<ccode>` ülkenin
// tüm kapsam dışı ligleri. Beyaz liste çipleri değişmez; seçim ülke/lig <select> ile yapılır.
const U_LEAGUE_RE = /^u(\d{1,9})$/;
const CCODE_RE = /^[A-Z]{2,3}$/;

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
  const uLeagueId = searchParams.league && U_LEAGUE_RE.test(searchParams.league) ? Number(searchParams.league.slice(1)) : null;
  const country = searchParams.country && CCODE_RE.test(searchParams.country) ? searchParams.country : null;
  const outsideMode = uLeagueId != null || country != null;
  const flt = parseFilters(searchParams);
  // Pazar eşiği açıkken kapsam dışı blok da açık gelir: kullanıcı günün tamamını tarıyor.
  const scope = searchParams.scope === 'all' || outsideMode || flt.market ? 'all' : 'covered';
  const showNote = searchParams.note !== '0';

  const day = await listDay(date);
  const all = day.rows;
  // Kapsam dışı maçlar artık ana ızgaraya karışmaz; aşağıda lig lig gruplanır (2026-09-23).
  const scoped = all.filter((r) => r.covered);
  // v3: ülke seçimi kapsamdaki ligleri de daraltır (ör. "İngiltere" → Premier League + Championship + kapsam dışı alt ligler).
  const inLeague = league ? scoped.filter((r) => r.league?.slug === league.slug) : country && uLeagueId == null ? scoped.filter((r) => r.league?.ccode === country) : scoped;
  // Denetim B10: filters.ts (arama/durum/hazır/sıralama) kart tasarımına geçişte sayfadan düşmüştü.
  const rows = applyFilters(inLeague, flt);
  const filtersOn = !!flt.q || flt.status !== 'all' || flt.ready || flt.sort !== 'time' || !!flt.market;
  const uncoveredCount = all.filter((r) => !r.covered).length;
  // Kapsam dışı: lig lig grupla, risk notunu lig dilim karnesinden ver (lib/site/coverage-risk).
  const uncoveredAll = league ? [] : all.filter((r) => !r.covered && r.hasModel);
  const cov = uncoveredAll.length ? await coverageById() : new Map<number, Awaited<ReturnType<typeof coverageById>> extends Map<number, infer R> ? R : never>();
  // Seçici için günün kapsam dışı ligleri (ülke kodu sicilden; sicilde yoksa "diğer").
  const ccodeOf = (p: (typeof uncoveredAll)[number]) => (p.leagueId != null ? cov.get(p.leagueId)?.ccode : null) ?? null;
  const uLeagues = new Map<number, { id: number; name: string; ccode: string | null; country: string | null; n: number }>();
  for (const p of uncoveredAll) {
    if (p.leagueId == null) continue;
    const c = cov.get(p.leagueId);
    const u = uLeagues.get(p.leagueId) ?? { id: p.leagueId, name: c?.name || p.leagueName, ccode: c?.ccode ?? null, country: countryName(c?.ccode, locale), n: 0 };
    u.n++; uLeagues.set(p.leagueId, u);
  }
  const uLeagueList = [...uLeagues.values()].sort((a, b) => (a.country ?? a.ccode ?? '~').localeCompare(b.country ?? b.ccode ?? '~') || a.name.localeCompare(b.name));
  const uCountries = new Map<string, { ccode: string; country: string; n: number }>();
  for (const u of uLeagueList) {
    const k = u.ccode ?? '';
    const c = uCountries.get(k) ?? { ccode: k, country: u.country ?? u.ccode ?? t('countryOther'), n: 0 };
    c.n += u.n; uCountries.set(k, c);
  }
  const uCountryList = [...uCountries.values()].sort((a, b) => a.country.localeCompare(b.country));
  const uncoveredRows = applyFilters(uncoveredAll.filter((p) => uLeagueId != null ? p.leagueId === uLeagueId : country ? (ccodeOf(p) ?? '') === country : true), flt);
  const outsideAll = sumBuckets([...cov.values()].filter((c) => c.status !== 'whitelist').map((c) => c.stats));
  const mktName: Record<string, string> = { x12: t('mkt1x2'), ou25: t('mktOver'), under25: t('mktUnder'), btts: t('mktBtts') };
  const groups = new Map<string, { id: string | undefined; name: string; ccode: string | null; n: number; strong: number; meta: string; strongMeta: string[]; rows: Array<{ p: (typeof uncoveredRows)[number]; outside: OutsideRisk }> }>();
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
      groups.set(key, { id: sectionId(p.leagueId) ?? undefined, name: c?.name || p.leagueName, ccode: c?.ccode ?? null, n: sm.n, strong: strongMeta.length, meta, strongMeta, rows: [] });
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
    const m = { date, league: league?.slug ?? (uLeagueId != null ? `u${uLeagueId}` : undefined), country: country ?? undefined, scope: outsideMode || flt.market ? 'covered' : scope, note: showNote ? undefined : '0', q: flt.q || undefined, status: flt.status === 'all' ? undefined : flt.status, ready: flt.ready ? '1' : undefined, sort: flt.sort === 'time' ? undefined : flt.sort, market: flt.market ?? undefined, minp: flt.market && flt.minP ? String(flt.minP) : undefined, ...over };
    if (m.date && m.date !== today) qs.set('date', m.date);
    if (m.league) qs.set('league', m.league);
    if (m.country) qs.set('country', m.country);
    if (m.scope === 'all') qs.set('scope', 'all');
    if (m.note === '0') qs.set('note', '0');
    if (m.q) qs.set('q', m.q);
    if (m.status) qs.set('status', m.status);
    if (m.ready) qs.set('ready', '1');
    if (m.sort) qs.set('sort', m.sort);
    if (m.market) qs.set('market', m.market);
    if (m.market && m.minp) qs.set('minp', m.minp);
    const s = qs.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };

  const nextDay = scoped.length === 0 && !outsideMode ? await nextDayWithPredictions(date, 1) : null;
  // Maç sayfasındaki "geri" bağlantısı bu sorguyu korur (gün, kapsam, ülke/lig, filtreler).
  const listQs = href({}).split('?')[1] ?? '';
  const spotOf = (p: (typeof all)[number]) => { const v = flt.market ? marketProb(p, flt.market) : null; return flt.market && v != null ? { label: mktName[flt.market], p: v } : null; };
  const uSelected = uLeagueId != null ? uLeagues.get(uLeagueId) ?? null : null;
  const outsideTitle = uSelected ? uSelected.name : country ? (uCountries.get(country)?.country ?? country) : null;
  const leaguesToday = SITE_LEAGUES.filter((l) => scoped.some((r) => r.league?.slug === l.slug));
  const updated = day.feed === 'ok' ? f.dateTime(new Date(day.fetchedAt), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
  // Denetim B11: day.fetchedAt akışın okunma anıdır; tahminin yayın zamanı satırların updated_at'idir.
  const lastPublished = rows.reduce<string | null>((m, r) => (r.hasModel && r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
  const published = lastPublished ? f.dateTime(new Date(lastPublished), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
  const fullDay = f.dateTime(zonedStartOfDay(date), { weekday: 'short', day: 'numeric', month: 'short' });

  // v3: covered rows grouped by league, kickoff order preserved.
  const covGroups = new Map<string, { slug: string | null; name: string; country: string | null; rows: typeof rows }>();
  for (const r of rows) {
    const k = r.league?.slug ?? r.leagueName;
    if (!covGroups.has(k)) covGroups.set(k, { slug: r.league?.slug ?? null, name: r.league?.name ?? r.leagueName, country: r.league?.country ?? null, rows: [] });
    covGroups.get(k)!.rows.push(r);
  }
  const shownCount = outsideMode || (flt.market && inLeague.length === 0) ? uncoveredRows.length : rows.length + (scope === 'all' ? uncoveredRows.length : 0);
  const t3 = await getTranslations('v3.predictions');

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5 pt-7">
        <div>
          <h1 className="text-[28px] sm:text-[36px]">{date === today ? t('title') : t('titleDay', { day: dayLabel(date) })}</h1>
          <p className="mt-1.5 text-[14px] text-s-muted">
            {updated ? t('meta', { day: fullDay, matches: shownCount, time: updated }) : t('metaNoFeed', { day: fullDay, matches: shownCount })}
            {published && <> · {t('published', { time: published })}</>}
          </p>
        </div>
        <Link href={href({ note: showNote ? '0' : undefined })} className="text-[13px] font-semibold text-s-muted hover:text-s-ink">{showNote ? t('hide') : t('show')}</Link>
      </div>

      <PredictionsToolbar
        state={{ date, today, league: league?.slug ?? null, country, uLeagueId, scope, q: flt.q, status: flt.status, sort: flt.sort, ready: flt.ready, market: flt.market, minP: flt.minP, note: showNote }}
        leagues={leaguesToday.map((l) => ({ slug: l.slug, name: l.name, country: l.country, n: scoped.filter((r) => r.league?.slug === l.slug).length }))}
        uncoveredCount={uncoveredCount}
        countries={uCountryList}
        uLeagues={uLeagueList.map((u) => ({ id: u.id, name: u.name, ccode: u.ccode, n: u.n }))}
        minPSteps={MIN_P_STEPS}
        dayLabel={{ prev: dayLabel(addDays(date, -1)), cur: dayLabel(date), next: dayLabel(addDays(date, 1)) }}
        labels={{
          yesterday: tc('yesterday'), today: tc('today'), tomorrow: tc('tomorrow'), prevDay: t('dayPrev'), nextDay: t('dayNext'), pickDate: tc('date'),
          all: t('all'), otherLeagues: t3('otherLeagues'), filters: tc('filters'), clear: tc('clear'), search: tc('search'), searchPh: t('searchPh'),
          status: tc('status'), statusAll: t('statusAll'), statusUpcoming: t('statusUpcoming'), statusLive: t('statusLive'), statusFinished: t('statusFinished'),
          sort: tc('sort'), sortTime: t('sortTime'), sortConfidence: t('sortConfidence'), ready: t('ready'),
          market: tc('market'), marketAll: t('marketAll'), markets: { x12: t('mkt1x2'), ou25: t('mktOver'), btts: t('mktBtts') }, minP: Object.fromEntries(MIN_P_STEPS.map((p) => [String(p), t('minP', { p })])),
          country: t('country'), countryAll: t('countryAll', { count: uCountryList.length }), league: tc('league'), leagueAll: t('leagueAll'), matches: tc('matches', { count: shownCount }),
          picker: { placeholder: t3('pickerPh'), modelLeagues: t3('pickerModel'), countries: t3('pickerCountries'), otherLeagues: t3('otherLeagues'), noResults: t3('pickerEmpty') },
        }}
      />

      {filtersOn && (
        <p role="status" className="mt-3 text-[13px] text-s-muted">
          {flt.market && t('marketFiltered', { market: mktName[flt.market], p: flt.minP ?? 60, shown: rows.length + uncoveredRows.length })}
          {flt.market && inLeague.length > 0 && ' · '}
          {(!flt.market || inLeague.length > 0) && t('filtered', { shown: rows.length, total: inLeague.length })}
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

      {/* ── Covered leagues ─────────────────────────────────────────── */}
      {uLeagueId != null || ((outsideMode || !!flt.market) && inLeague.length === 0) ? (
        uncoveredRows.length === 0 && (
          <div className="mt-6"><EmptyState title={t('outsideEmpty', { name: outsideTitle ?? '' })} lead={t('outsideEmptyLead')} action={<Link href={href({ league: undefined, country: undefined })} className="btn btn-secondary">{t('all')}</Link>} /></div>
        )
      ) : rows.length === 0 && filtersOn && inLeague.length > 0 ? (
        <div className="mt-6"><EmptyState title={t('emptyFiltered')} lead={t('emptyFilteredLead')} action={<Link href={href({ q: undefined, status: undefined, ready: undefined, sort: undefined })} className="btn btn-secondary">{tc('clear')}</Link>} /></div>
      ) : rows.length === 0 && scope === 'all' && uncoveredGroups.length > 0 ? (
        <p className="mt-5 text-[14px] text-s-muted">{t('emptyTitle')} {nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : tp('emptyLead')}</p>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t('emptyTitle')}
            lead={nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : tp('emptyLead')}
            action={nextDay ? <Link href={href({ date: nextDay })} className="btn btn-primary">{t('goToNext', { date: dayLabel(nextDay) })}</Link> : (league ? <Link href={href({ league: undefined })} className="btn btn-secondary">{t('all')}</Link> : uncoveredCount > 0 && scope !== 'all' ? <Link href={href({ scope: 'all' })} className="btn btn-secondary">{t('showUncovered', { count: uncoveredCount })}</Link> : undefined)}
          />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {[...covGroups.values()].map((g) => (
            <LeagueGroup key={g.slug ?? g.name} name={g.name} meta={g.country ?? undefined} href={g.slug ? `/leagues/${g.slug}` : undefined} count={g.rows.length}>
              {g.rows.map((p) => <MatchRow key={p.fixtureId} p={p} back={listQs} spot={spotOf(p)} />)}
            </LeagueGroup>
          ))}
          <p className="text-[12px] text-s-muted">{t('footnote')}</p>
        </div>
      )}

      {/* ── Outside model coverage ──────────────────────────────────── */}
      {uncoveredGroups.length > 0 && (scope === 'all' || outsideMode) && (
        <section className={outsideMode ? 'mt-5' : 'mt-10'}>
          <div className="flex flex-wrap items-end justify-between gap-2 pb-3">
            <div>
              <h2 className="text-[20px]">{outsideMode ? t('outsideTitle', { name: outsideTitle ?? '', count: uncoveredRows.length, leagues: uncoveredGroups.length }) : t('uncoveredTitle', { count: uncoveredRows.length, leagues: uncoveredGroups.length })}</h2>
              <p className="mt-1 max-w-[72ch] text-[13px] text-s-muted">{t('uncoveredLead')}</p>
            </div>
            {!outsideMode && <Link href={href({ scope: 'covered' })} className="text-[13px] font-semibold text-s-muted hover:text-s-ink">{t('hideUncovered')}</Link>}
          </div>
          <div className="flex flex-col gap-4">
            {uncoveredGroups.map((g) => (
              <LeagueGroup key={g.name + (g.ccode ?? '')} id={g.id} name={g.name} meta={[g.ccode, g.meta].filter(Boolean).join(' · ')} count={g.rows.length} tags={g.strongMeta} muted>
                {g.rows.map(({ p, outside }) => <MatchRow key={p.fixtureId} p={p} outside={outside} back={listQs} spot={spotOf(p)} />)}
              </LeagueGroup>
            ))}
          </div>
        </section>
      )}
      {uncoveredGroups.length > 0 && scope !== 'all' && !outsideMode && rows.length > 0 && (
        <p className="mt-8 text-[13.5px] text-s-muted">
          <Link href={href({ scope: 'all' })} className="font-semibold text-s-ink underline decoration-s-n400 underline-offset-4 hover:decoration-s-accent">{t('showUncovered', { count: uncoveredCount })}</Link>
        </p>
      )}
    </Page>
  );
}
