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
import { Page } from '@/components/site/ui';
import DemoAnalysis from '@/components/site/DemoAnalysis';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { REGISTER_HREF, PRICING_HREF } from '@/components/site/Paywall';

// Members-only site (2026-09-08): reading the session makes this dynamic.
export const dynamic = 'force-dynamic';

// Ana sayfa (görsel yenileme 2026-09-19). Sıra: koyu ilk ekran (tek ana CTA + okunabilir,
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

  const [perf, latest] = await Promise.all([
    getPerformance(null),
    unlocked ? listResults({ league: null, from: null, to: null, page: 1, pageSize: 12 }) : Promise.resolve(null),
  ]);
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

  return (
    <>
      {/* ── B. İlk ekran: koyu bant ─────────────────────────────────── */}
      <section className="band-dark pitch-bg">
        <Page className="grid items-center gap-10 py-14 lg:grid-cols-[0.82fr_1fr] lg:gap-14 lg:py-20">
          <div className="flex flex-col gap-6">
            <p className="kicker !text-s-accent-700">{t('eyebrow')}</p>
            <h1 className="max-w-[14ch] text-[38px] leading-[1.06] sm:text-[52px] lg:text-[60px]" style={{ textWrap: 'balance' } as React.CSSProperties}>{t('title')}</h1>
            <p className="max-w-[46ch] text-[17px] text-s-muted sm:text-[18px]">{t('lead')}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href={primary.href} className="btn btn-primary btn-lg" data-cta="hero-primary">{primary.label}</Link>
              <a href="#demo" className="text-[15px] font-semibold underline decoration-s-n400 underline-offset-4 hover:decoration-s-accent" data-cta="hero-demo">{t('ctaDemo')}</a>
            </div>
            {!authed && <p className="text-[14px] text-s-muted">{t('noCard')}</p>}
          </div>
          <DemoAnalysis id="demo" />
        </Page>
      </section>

      {/* ── C. Kapsam şeridi ────────────────────────────────────────── */}
      <section className="border-b border-s-line bg-s-surface" aria-labelledby="cov-title">
        <Page className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:gap-6">
          <h2 id="cov-title" className="kicker shrink-0 !font-semibold">{t('leaguesTitle')}</h2>
          <ul className="tbl-scroll -mx-5 flex gap-2 px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            {SITE_LEAGUES.map((l) => (
              <li key={l.slug} className="shrink-0">
                <Link href={`/leagues/${l.slug}`} className="inline-flex h-9 items-center rounded-full border border-s-line px-3.5 text-[14px] font-medium hover:border-s-n400">{l.name}</Link>
              </li>
            ))}
          </ul>
        </Page>
        {strongLeagues > 0 && (
          <Page className="!pt-0 pb-4">
            <p className="text-[14px] text-s-muted">
              {t('strongLine', { n: strongLeagues })}{' '}
              <Link href="/performance#strong" className="font-semibold text-s-ink underline decoration-s-n400 underline-offset-4 hover:decoration-s-accent" data-cta="strong-markets">{t('strongCta')}</Link>
            </p>
          </Page>
        )}
      </section>

      {/* ── D. Ürünü gösteren bölüm ─────────────────────────────────── */}
      <Page className="py-14 lg:py-24">
        <h2 className="max-w-[22ch] text-[30px] sm:text-[38px]">{t('showTitle')}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(['1', '2', '3'] as const).map((n) => (
            <article key={n} className="card card-flat">
              <span className="num grid h-8 w-8 place-items-center rounded-full bg-s-accent-100 text-[14px] font-bold text-s-accent-800" aria-hidden>{n}</span>
              <h3 className="text-[20px]">{t(`show${n}T`)}</h3>
              <p className="text-[15px] text-s-muted">{t(`show${n}`)}</p>
            </article>
          ))}
        </div>
      </Page>

      {/* ── E. Üç adım ──────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-20 border-y border-s-line bg-s-surface">
        <Page className="py-14 lg:py-20">
          <h2 className="text-[30px] sm:text-[38px]">{t('stepsTitle')}</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map(({ Icon, title, text }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-s-line bg-s-bg text-s-accent-700" aria-hidden><Icon size={20} /></span>
                <div>
                  <h3 className="text-[18px]"><span className="num text-s-muted">{i + 1}.</span> {title}</h3>
                  <p className="mt-1 text-[15px] text-s-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Page>
      </section>

      {/* ── F. Şeffaf performans ────────────────────────────────────── */}
      <Page className="py-14 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] sm:text-[38px]">{t('perfTitle')}</h2>
            <p className="mt-2 max-w-[60ch] text-[16px] text-s-muted">{t('perfLead')}</p>
          </div>
          <Link href="/performance" className="text-[15px] font-semibold text-s-accent-700 hover:underline">{t('perfLink')}</Link>
        </div>

        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card card-flat">
            <dt className="kicker">{t('perfHit')}</dt>
            <dd className="num text-[40px] font-extrabold leading-none">{perf.overall.n ? pct(perf.overall.acc) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{t('perfHitNote', { n: f.number(perf.overall.n), from: day(perf.from), to: day(perf.to) })}</dd>
          </div>
          <div className="card card-flat">
            <dt className="kicker">{t('perfRoi')}</dt>
            <dd className={`num text-[40px] font-extrabold leading-none ${perf.roi && perf.roi.roi < 0 ? 'text-s-loss' : ''}`}>{perf.roi ? signed(perf.roi.roi) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{perf.roi ? t('perfRoiNote', { bets: f.number(perf.roi.bets) }) : t('perfRoiNone')}</dd>
          </div>
          <div className="card card-flat">
            <dt className="kicker">{t('perfSettled')}</dt>
            <dd className="num text-[40px] font-extrabold leading-none">{perf.overall.n ? f.number(perf.overall.n) : '–'}</dd>
            <dd className="text-[13px] text-s-muted">{t('perfSettledNote')}</dd>
          </div>
        </dl>

        <div className="mt-10">
          {recent.length ? (
            <>
              <h3 className="text-[20px]">{t('perfRecent')}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{t('perfRecentSub')}</p>
              <ul className="mt-4 divide-y divide-s-line overflow-hidden rounded-[14px] border border-s-line bg-s-surface">
                {recent.map((w) => (
                  <li key={w.fixtureId}>
                    <Link href={`/predictions/${w.fixtureId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-s-raised sm:px-5">
                      <span className={`tag ${w.outcome === 'won' ? 'tag-win' : 'tag-loss'}`}>{w.outcome === 'won' ? tc('won') : tc('lost')}</span>
                      <span className="min-w-0 flex-1 font-semibold">{w.homeName} <span className="num">{w.homeScore}–{w.awayScore}</span> {w.awayName}</span>
                      <span className="text-[13px] text-s-muted">{pickName(w)} · <span className="num">{pct(w.confidence, 0)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rounded-[14px] border border-dashed border-s-n400 px-5 py-4">
              <h3 className="text-[18px]">{t('perfSummary')}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{t('perfSummarySub')}</p>
            </div>
          )}
        </div>
      </Page>

      {/* ── G. Fiyat ve deneme ──────────────────────────────────────── */}
      <section className="border-y border-s-line bg-s-surface">
        <Page className="py-14 lg:py-20">
          <h2 className="max-w-[20ch] text-[30px] sm:text-[38px]">{t('priceTitle')}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card card-flat !bg-s-bg">
              <h3 className="text-[20px]">{t('priceTrial')}</h3>
              <p className="num text-[36px] font-extrabold leading-none">{money(0)} <span className="text-[15px] font-medium text-s-muted">· {tp('freeFor')}</span></p>
              <p className="text-[15px]">{t('priceTrialSub')}</p>
              <p className="text-[14px] text-s-muted">{t('priceTrialAfter')}</p>
              {!authed && <Link href={REGISTER_HREF} className="btn btn-secondary mt-auto self-start" data-cta="home-price-trial">{t('ctaTry')}</Link>}
            </div>
            <div className="card card-accent">
              <h3 className="text-[20px]">{t('pricePro')}</h3>
              <p className="num text-[36px] font-extrabold leading-none">{money(PLAN_PRICES.monthly.amount)}<span className="text-[15px] font-medium text-s-muted">{t('perMonth')} · {t('priceWeekly', { price: money(PLAN_PRICES.weekly.amount) })}</span></p>
              <p className="text-[15px]">{t('priceProSub')}</p>
              <p className="text-[14px] text-s-muted">{t('priceCancel')}</p>
              <Link href={PRICING_HREF} className="mt-auto self-start text-[15px] font-semibold text-s-accent-700 hover:underline" data-cta="home-price-compare">{t('priceLink')}</Link>
            </div>
          </div>
        </Page>
      </section>

      {/* ── H. SSS ──────────────────────────────────────────────────── */}
      <Page className="py-14 lg:py-24">
        <h2 className="text-[30px] sm:text-[38px]">{t('faqTitle')}</h2>
        <div className="mt-6 max-w-[820px] divide-y divide-s-line border-y border-s-line">
          {faqs.map((x) => (
            <details key={x.q} className="faq group">
              <summary className="flex min-h-[56px] items-center justify-between gap-4 py-3 text-[17px] font-semibold">
                {x.q}
                <Plus size={18} className="faq-plus shrink-0 text-s-muted" aria-hidden />
              </summary>
              <p className="pb-5 pr-8 text-[15px] text-s-muted">{x.a}</p>
            </details>
          ))}
        </div>
      </Page>

      {/* ── I. Kapanış ──────────────────────────────────────────────── */}
      <section className="band-dark pitch-bg">
        <Page className="flex flex-col items-start gap-5 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[28px] sm:text-[34px]">{t('closeTitle')}</h2>
            {!authed && <p className="mt-2 text-[15px] text-s-muted">{t('closeNote')}</p>}
          </div>
          <Link href={primary.href} className="btn btn-primary btn-lg shrink-0" data-cta="home-close">{primary.label}</Link>
        </Page>
      </section>
    </>
  );
}
