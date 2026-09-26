import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { loadCoverage } from '@/lib/coverage/registry';
import { strongBoard } from '@/lib/site/strong-markets';
import { UserPlus, ListFilter, LineChart, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import type { SitePrediction } from '@/lib/site/predictions';
import { listResults } from '@/lib/site/results';
import { getPerformance } from '@/lib/site/performance';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { PLAN_PRICES, money } from '@/lib/site/plans';
import { launchOffer } from '@/lib/site/offer';
import { Page } from '@/components/site/ui';
import DemoAnalysis from '@/components/site/DemoAnalysis';
import MatchRow from '@/components/site/MatchRow';
import { listDay } from '@/lib/site/fixtures';
import { todayYmd } from '@/lib/site/time';
import { ArrowRight } from 'lucide-react';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { REGISTER_HREF, PRICING_HREF } from '@/components/site/Paywall';

// Members-only site (2026-09-08): reading the session makes this dynamic.
export const dynamic = 'force-dynamic';

// Ana sayfa v3 (2026-09-26): açık zemin, veri önce. Üyeye günün maçları hero'da;
// ziyaretçiye etiketli örnek analiz. Sonra şeffaf karne, kapsam, 3 adım, fiyat, SSS.
// Eski not (2026-09-19): Sıra: koyu ilk ekran (tek ana CTA + okunabilir,
// açıkça etiketli ÖRNEK analiz) → kapsam şeridi → ürün anlatımı → 3 adım → şeffaf performans
// → fiyat özeti → SSS → kompakt kapanış. Tüm sayılar canlı karneden; sabit pazarlama
// rakamı, sahte canlı rozeti, uydurma sosyal kanıt yok. Üyeye özel veri HTML'e basılmaz.

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { absolute: `${t('metaTitle', { count: SITE_LEAGUES.length })} · ${tm('siteName')}` },
    description: t('metaDescription', { count: SITE_LEAGUES.length }),
    alternates: alternatesFor(locale as Locale, ''),
  };
}

const pct = (x: number | null | undefined, d = 1) => (x == null ? '–' : `${(x * 100).toFixed(d)}%`);
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('v2.landing');
  const th = await getTranslations('v2.home');
  // Güçlü pazar sayısı (plan adım 3, 24 Eyl): vitrin filtresiyle, maç ayrıntısı yok (paywall korunur).
  const strongLeagues = new Set(strongBoard(await loadCoverage().catch(() => []), 99).flatMap((b) => b.rows.map((r) => r.leagueId))).size;
  const tc = await getTranslations('common');
  const tp = await getTranslations('v2.pricing');
  const f = await getFormatter();
  const access = await getSiteAccess();
  const unlocked = canSeeMatches(access);
  const authed = access.state !== 'anon';

  const [perf, latest, today] = await Promise.all([
    getPerformance(null),
    unlocked ? listResults({ league: null, from: null, to: null, page: 1, pageSize: 12 }) : Promise.resolve(null),
    unlocked ? listDay(todayYmd()).catch(() => null) : Promise.resolve(null),
  ]);
  // v3: members see the day's first modelled fixtures right in the hero.
  const todayRows = (today?.rows ?? []).filter((r) => r.covered && r.hasModel).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 5);
  const todayTotal = (today?.rows ?? []).filter((r) => r.covered && r.hasModel).length;
  // Seçmeden: en son sonuçlanan 5 tahmin (kazanan da kaybeden de). Yalnız erişimi olana.
  const recent = (latest?.rows ?? []).filter((r) => r.outcome === 'won' || r.outcome === 'lost').slice(0, 5);
  const pickName = (p: SitePrediction) => (p.pick === '1' ? th('pickWin', { team: p.homeName }) : p.pick === '2' ? th('pickWin', { team: p.awayName }) : th('pickDraw'));
  const day = (iso: string | null) => (iso ? f.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

  const primary = unlocked
    ? { href: '/predictions', label: t('ctaToday') }
    : authed ? { href: PRICING_HREF, label: tp('proCta') } : { href: REGISTER_HREF, label: t('ctaTry') };

  const steps = [
    { Icon: UserPlus, title: t('step1T'), text: t('step1') },
    { Icon: ListFilter, title: t('step2T'), text: t('step2') },
    { Icon: LineChart, title: t('step3T'), text: t('step3') },
  ];
  const faqs = (['1', '2', '3', '4', '5', '6'] as const).map((n) => ({ q: t(`q${n}`), a: t(`a${n}`) }));

  const t3 = await getTranslations('v3.home');
  const Icon = ArrowRight;

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="border-b border-s-line bg-s-surface">
        <Page className="grid items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-16">
          <div className="flex flex-col gap-5">
            <p className="kicker !text-s-accent-600">{t('eyebrow')}</p>
            <h1 className="max-w-[16ch] text-[36px] sm:text-[48px] lg:text-[54px]" style={{ textWrap: 'balance' } as React.CSSProperties}>{t('title')}</h1>
            <p className="max-w-[48ch] text-[17px] text-s-muted">{t('lead')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={primary.href} className="btn btn-primary btn-lg" data-cta="hero-primary">{primary.label} <Icon size={18} /></Link>
              <Link href="/performance" className="btn btn-secondary btn-lg" data-cta="hero-record">{t('perfLink').replace(' →', '')}</Link>
            </div>
            {!authed && <p className="text-[14px] text-s-muted">{t('noCard')}</p>}
            {/* Inline record — the brand promise is transparency, so it sits in the first screen. */}
            <dl className="mt-2 grid grid-cols-3 gap-4 border-t border-s-line pt-5">
              <div><dt className="text-[12px] text-s-muted">{t('perfHit')}</dt><dd className="num text-[22px] font-bold leading-none sm:text-[26px]">{perf.overall.n ? pct(perf.overall.acc) : '–'}</dd></div>
              <div><dt className="text-[12px] text-s-muted">{t('perfRoi')}</dt><dd className={`num text-[22px] font-bold leading-none sm:text-[26px] ${perf.roi && perf.roi.roi < 0 ? 'text-s-loss' : perf.roi ? 'text-s-win' : ''}`}>{perf.roi ? signed(perf.roi.roi) : '–'}</dd></div>
              <div><dt className="text-[12px] text-s-muted">{t('perfSettled')}</dt><dd className="num text-[22px] font-bold leading-none sm:text-[26px]">{perf.overall.n ? f.number(perf.overall.n) : '–'}</dd></div>
            </dl>
          </div>

          {unlocked && todayRows.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-s-line bg-s-bg shadow-[var(--s-shadow)]" aria-label={t3('todayTitle')}>
              <header className="flex items-center justify-between gap-3 border-b border-s-line px-4 py-3">
                <h2 className="text-[15px] font-bold">{t3('todayTitle')} <span className="num ml-1 font-semibold text-s-muted">{todayTotal}</span></h2>
                <Link href="/predictions" className="text-[13.5px] font-semibold text-s-accent-600 hover:underline">{t3('todayAll')} →</Link>
              </header>
              <div className="divide-rule">
                {todayRows.map((p) => <MatchRow key={p.fixtureId} p={p} />)}
              </div>
            </section>
          ) : (
            <DemoAnalysis id="demo" />
          )}
        </Page>
      </section>

      {/* ── Leagues ─────────────────────────────────────────────────── */}
      <section aria-labelledby="cov-title">
        <Page className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:gap-6">
          <h2 id="cov-title" className="kicker shrink-0">{t('leaguesTitle')}</h2>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
            {SITE_LEAGUES.map((l) => (
              <li key={l.slug} className="shrink-0">
                <Link href={`/leagues/${l.slug}`} className="chip chip-sm !font-medium">{l.name}</Link>
              </li>
            ))}
          </ul>
          {strongLeagues > 0 && (
            <Link href="/performance#strong" className="shrink-0 text-[13.5px] font-semibold text-s-accent-600 hover:underline lg:ml-auto" data-cta="strong-markets">{t('strongLine', { n: strongLeagues })} {t('strongCta')}</Link>
          )}
        </Page>
      </section>

      {/* ── What you see ────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-20 border-y border-s-line bg-s-surface">
        <Page className="py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="max-w-[18ch] text-[28px] sm:text-[36px]">{t('showTitle')}</h2>
              <p className="mt-3 max-w-[44ch] text-[16px] text-s-muted">{t('leaguesNote')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(['1', '2', '3'] as const).map((n) => (
                <article key={n} className="card card-flat !gap-2">
                  <span className="num grid h-8 w-8 place-items-center rounded-full bg-s-accent-100 text-[14px] font-bold text-s-accent-800" aria-hidden>{n}</span>
                  <h3 className="mt-1 text-[17px]">{t(`show${n}T`)}</h3>
                  <p className="text-[14px] text-s-muted">{t(`show${n}`)}</p>
                </article>
              ))}
            </div>
          </div>
          <ol className="mt-12 grid gap-6 border-t border-s-line pt-8 md:grid-cols-3">
            {steps.map(({ Icon: StepIcon, title, text }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-s-raised text-s-accent-600" aria-hidden><StepIcon size={18} /></span>
                <div>
                  <h3 className="text-[16px]"><span className="num text-s-muted">{i + 1}.</span> {title}</h3>
                  <p className="mt-1 text-[14px] text-s-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Page>
      </section>

      {/* ── Record ──────────────────────────────────────────────────── */}
      <Page className="py-14 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px] sm:text-[36px]">{t('perfTitle')}</h2>
            <p className="mt-2 max-w-[60ch] text-[16px] text-s-muted">{t('perfLead')}</p>
          </div>
          <Link href="/performance" className="btn btn-secondary btn-sm">{t('perfLink')}</Link>
        </div>

        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card card-flat !gap-1">
            <dt className="kicker">{t('perfHit')}</dt>
            <dd className="num text-[36px] font-bold leading-none">{perf.overall.n ? pct(perf.overall.acc) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{t('perfHitNote', { n: f.number(perf.overall.n), from: day(perf.from), to: day(perf.to) })}</dd>
          </div>
          <div className="card card-flat !gap-1">
            <dt className="kicker">{t('perfRoi')}</dt>
            <dd className={`num text-[36px] font-bold leading-none ${perf.roi && perf.roi.roi < 0 ? 'text-s-loss' : perf.roi ? 'text-s-win' : ''}`}>{perf.roi ? signed(perf.roi.roi) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{perf.roi ? t('perfRoiNote', { bets: f.number(perf.roi.bets) }) : t('perfRoiNone')}</dd>
          </div>
          <div className="card card-flat !gap-1">
            <dt className="kicker">{t('perfSettled')}</dt>
            <dd className="num text-[36px] font-bold leading-none">{perf.overall.n ? f.number(perf.overall.n) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{t('perfSettledNote')}</dd>
          </div>
        </dl>

        <div className="mt-8">
          {recent.length ? (
            <>
              <h3 className="text-[18px]">{t('perfRecent')}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{t('perfRecentSub')}</p>
              <ul className="mt-4 divide-y divide-s-line overflow-hidden rounded-2xl border border-s-line bg-s-surface">
                {recent.map((w) => (
                  <li key={w.fixtureId}>
                    <Link href={`/predictions/${w.fixtureId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-s-raised/60 sm:px-5">
                      <span className={`tag ${w.outcome === 'won' ? 'tag-win' : 'tag-loss'}`}>{w.outcome === 'won' ? tc('won') : tc('lost')}</span>
                      <span className="min-w-0 flex-1 text-[14.5px] font-semibold">{w.homeName} <span className="num">{w.homeScore}–{w.awayScore}</span> {w.awayName}</span>
                      <span className="text-[13px] text-s-muted">{pickName(w)} · <span className="num">{pct(w.confidence, 0)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-s-n400 px-5 py-4">
              <h3 className="text-[17px]">{t('perfSummary')}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{t('perfSummarySub')}</p>
            </div>
          )}
        </div>
      </Page>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section className="border-y border-s-line bg-s-surface">
        <Page className="py-14 lg:py-20">
          <h2 className="max-w-[20ch] text-[28px] sm:text-[36px]">{t('priceTitle')}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card card-flat !bg-s-bg">
              <h3 className="text-[18px]">{t('priceTrial')}</h3>
              <p className="num text-[34px] font-bold leading-none">{money(0)} <span className="text-[15px] font-medium text-s-muted">· {tp('freeFor')}</span></p>
              <p className="text-[15px]">{t('priceTrialSub')}</p>
              <p className="text-[14px] text-s-muted">{t('priceTrialAfter')}</p>
              {!authed && <Link href={REGISTER_HREF} className="btn btn-secondary mt-auto self-start" data-cta="home-price-trial">{t('ctaTry')}</Link>}
            </div>
            <div className="card card-accent">
              <h3 className="text-[18px]">{t('pricePro')}</h3>
              <p className="num text-[34px] font-bold leading-none">{money(PLAN_PRICES.monthly.amount)}<span className="text-[15px] font-medium text-s-muted">{t('perMonth')} · {t('priceWeekly', { price: money(PLAN_PRICES.weekly.amount) })}</span></p>
              {(() => { const o = launchOffer(); return o ? <p className="mt-1 inline-block rounded-md bg-s-win/10 px-2 py-1 text-[13px] font-semibold text-s-win">{o.until ? tp('offerUntil', { price: money(o.price), full: money(PLAN_PRICES.monthly.amount), until: o.until }) : tp('offer', { price: money(o.price), full: money(PLAN_PRICES.monthly.amount) })}</p> : null; })()}
              <p className="text-[15px]">{t('priceProSub')}</p>
              <p className="text-[14px] text-s-muted">{t('priceCancel')}</p>
              <Link href={PRICING_HREF} className="btn btn-primary mt-auto self-start" data-cta="home-price-compare">{t('priceLink')}</Link>
            </div>
          </div>
        </Page>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <Page className="py-14 lg:py-20">
        <h2 className="text-[28px] sm:text-[36px]">{t('faqTitle')}</h2>
        <div className="mt-6 max-w-[820px] divide-y divide-s-line border-y border-s-line">
          {faqs.map((x) => (
            <details key={x.q} className="faq group">
              <summary className="flex min-h-[56px] items-center justify-between gap-4 py-3 text-[16.5px] font-semibold">
                {x.q}
                <Plus size={18} className="faq-plus shrink-0 text-s-muted" aria-hidden />
              </summary>
              <p className="pb-5 pr-8 text-[15px] text-s-muted">{x.a}</p>
            </details>
          ))}
        </div>
      </Page>

      {/* ── Close ───────────────────────────────────────────────────── */}
      <section className="band-dark pitch-bg">
        <Page className="flex flex-col items-start gap-5 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[26px] sm:text-[32px]">{t('closeTitle')}</h2>
            {!authed && <p className="mt-2 text-[15px] text-s-muted">{t('closeNote')}</p>}
          </div>
          <Link href={primary.href} className="btn btn-primary btn-lg shrink-0" data-cta="home-close">{primary.label}</Link>
        </Page>
      </section>
    </>
  );
}
