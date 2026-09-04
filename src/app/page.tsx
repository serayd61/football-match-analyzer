'use client';

// ============================================================================
// LANDING — brutalist editorial. Kağıt zemin, mürekkep çizgileri, tek sinyal
// rengi; dar grotesk manşetler (Archivo), serif gövde (Newsreader), mono
// rakam/etiket (IBM Plex Mono). Kart/gölge/blur/yuvarlak köşe yok; yapı 1px
// çizgilerle görünür. Bölümler folyo numarasıyla açılır (01, 02, …).
// Kopya/i18n `src/lib/landing-content.ts`'ten aynen gelir; CTA'lar, promo
// video, kilitli önizleme, SEO ve yönlendirme davranışı değişmedi.
// İçerikteki emoji ikonlar render edilmez; yerlerine folyo numaraları gelir.
// ============================================================================

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archivo, Newsreader, IBM_Plex_Mono } from 'next/font/google';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LandingNav from '@/components/landing/LandingNav';
import HeroSpotlight from '@/components/landing/HeroSpotlight';
import LiveProof from '@/components/landing/LiveProof';
import { labels, labelsDE } from '@/lib/landing-content';
import { useProof, formatAccuracy } from '@/lib/hooks/useProof';
import { Spinner } from '@/components/ui';

const display = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-brut-display', display: 'swap' });
const serif = Newsreader({ subsets: ['latin', 'latin-ext'], style: ['normal', 'italic'], variable: '--font-brut-serif', display: 'swap', adjustFontFallback: false });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-brut-mono', display: 'swap' });

// Hero rozeti metni — "6.868 maçta %76,2 çifte şans isabeti"
const PROOF_LINE: Record<string, (acc: string, n: string) => string> = {
  tr: (acc, n) => `${n} maçta ${acc} çifte şans isabeti`,
  en: (acc, n) => `${acc} double chance accuracy over ${n} matches`,
  de: (acc, n) => `${acc} Trefferquote (Doppelte Chance) in ${n} Spielen`,
};

// Gerçek rakamlardan kurulan istatistik şeridi etiketleri
// DİKKAT: `marketsValue` de dile bağlı — "KG" (Karşılıklı Gol) Türkçe bir
// kısaltmadır ve EN/DE'de "BTTS" olmalı. Sabit string sanılıp her dile
// verilirse landing'e Türkçe sızar (bkz. lib/i18n/server-text.ts kuralı).
const STAT_LABELS: Record<string, { dc: string; settled: string; high: string; markets: string; marketsValue: string }> = {
  tr: { dc: 'Çifte şans isabeti', settled: 'Sonuçlanmış maç', high: 'Yüksek güvenli seçimlerde', markets: 'Tahmin pazarı', marketsValue: '1X2 · Üst/Alt · KG' },
  en: { dc: 'Double chance accuracy', settled: 'Settled matches', high: 'On high-confidence picks', markets: 'Prediction markets', marketsValue: '1X2 · O/U 2.5 · BTTS' },
  de: { dc: 'Doppelte-Chance-Quote', settled: 'Abgerechnete Spiele', high: 'Bei hoher Konfidenz', markets: 'Wettmärkte', marketsValue: '1X2 · Ü/U 2.5 · BTTS' },
};

// Birkaç küçük etiket i18n dosyasında yok; burada tutulur.
const UI: Record<string, { glance: string; sample: string; lockedRows: string; contact: string; home: string; away: string; steps: string; multipliers: string }> = {
  tr: { glance: 'Bir bakışta', sample: 'Örnek kart', lockedRows: 'Bugünün tahminleri', contact: 'İletişim', home: 'Ev', away: 'Dep.', steps: 'Adımlar', multipliers: 'Çarpan' },
  en: { glance: 'See it in action', sample: 'Sample card', lockedRows: "Today's predictions", contact: 'Contact', home: 'Home', away: 'Away', steps: 'Steps', multipliers: 'Multiplier' },
  de: { glance: 'Auf einen Blick', sample: 'Beispielkarte', lockedRows: 'Heutige Tipps', contact: 'Kontakt', home: 'Heim', away: 'Ausw.', steps: 'Schritte', multipliers: 'Faktor' },
};

/** İçerik dosyasındaki baştaki emoji/işaretleri metinden ayıklar; kopya aynen kalır. */
function stripLeadingEmoji(s: string): string {
  return s.replace(/^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u2713]|\s)+/u, '');
}
const pad = (n: number) => String(n).padStart(2, '0');

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  // Kanıt verisi TEK kez çekilir; hero rozeti ve LiveProof aynı sonucu kullanır
  const proof = useProof();

  useEffect(() => {
    if (session) router.push('/dashboard');
  }, [session, router]);

  const allLabels = { ...labels, de: labelsDE };
  const l = (allLabels[lang as keyof typeof allLabels] || labels.en) as any;
  const ui = UI[lang] || UI.en;

  const dc = proof?.record?.doubleChance;
  const locale = lang === 'tr' ? 'tr-TR' : lang === 'de' ? 'de-DE' : 'en-US';
  const proofLine = dc?.total
    ? (PROOF_LINE[lang] || PROOF_LINE.en)(formatAccuracy(dc.accuracy, lang), dc.total.toLocaleString(locale))
    : null;

  const sl = STAT_LABELS[lang] || STAT_LABELS.en;
  const high = proof?.record?.doubleChanceHigh;
  const liveStats = dc?.total
    ? [
        { value: formatAccuracy(dc.accuracy, lang), label: sl.dc },
        { value: dc.total.toLocaleString(locale), label: sl.settled },
        ...(high?.total ? [{ value: formatAccuracy(high.accuracy, lang), label: sl.high }] : []),
        { value: sl.marketsValue, label: sl.markets },
      ].slice(0, 4)
    : null;

  // Folyo sayacı: kanıt bloğu görünüyorsa 01'i o alır.
  let folio = dc?.total ? 1 : 0;
  const next = () => pad(++folio);

  const fontVars = `${display.variable} ${serif.variable} ${mono.variable}`;

  if (status === 'loading') {
    return (
      <div className={`brut ${fontVars} min-h-screen grid place-items-center`}>
        <Spinner size={28} className="text-[#141414]" />
      </div>
    );
  }

  return (
    <div className={`brut ${fontVars} min-h-screen`} lang={lang}>
      <LandingNav lang={lang} />

      {/* ── Hero (cursor-spotlight reveal) ───────────────────────────────── */}
      <HeroSpotlight l={l.hero} proofLine={proofLine} />

      {/* ── Canlı kanıt (ölçülmüş karne) ─────────────────────────────────
          Hero'nun HEMEN altında: reklamdan gelen ziyaretçi kayıt olmadan
          gerçek isabet oranını ve dünün gerçek sonuçlarını burada görür.
          Veri yoksa bileşen hiç render edilmez. */}
      <LiveProof lang={lang} data={proof} />

      {/* ── Künye şeridi (gerçek rakamlar; yoksa jenerik etiketler) ───────── */}
      <section className="border-b grid grid-cols-2 md:grid-cols-4">
        {(liveStats || (l.stats as Array<{ value: string; label: string }>)).map((s, i, arr) => (
          <div key={i} className={`px-4 sm:px-6 py-5 ${i % 2 === 0 ? 'border-r' : i < arr.length - 1 ? 'md:border-r' : ''} ${i < 2 ? 'border-b md:border-b-0' : ''}`}>
            <div className="fd tnum leading-none text-[1.9rem] sm:text-[2.6rem]">{s.value}</div>
            <div className="fm-label mt-2 text-[var(--ink-2)]">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Promo video ──────────────────────────────────────────────────── */}
      <section id="promo-video" className="border-b scroll-mt-14">
        <div className="border-b flex items-center justify-between px-4 sm:px-6 py-2.5 fm-label">
          <span>{next()} · {ui.glance}</span>
          <span className="hidden sm:inline">promo.mp4</span>
        </div>
        <div className="px-4 sm:px-6 py-6 sm:py-8">
          <div className="border-2 bg-[#141414]">
            <video className="w-full h-auto block" src="/promo.mp4" poster="/promo-poster.jpg"
              controls autoPlay muted loop playsInline preload="metadata" />
          </div>
        </div>
      </section>

      {/* ── Live predictions teaser (locked) ─────────────────────────────── */}
      <section id="live-predictions" className="border-b scroll-mt-14">
        <Folio n={next()} badge={l.livePredictions.badge} title={l.livePredictions.title} subtitle={l.livePredictions.subtitle} />
        <div className="relative">
          {/* Sansürlü cetvel: satırlar var, içerik mürekkep bandı */}
          <div className="px-4 sm:px-6 py-2 fm-label text-[var(--ink-2)] border-b">{ui.lockedRows}</div>
          <ul aria-hidden className="select-none">
            {[[7, 4, 3], [5, 6, 3], [8, 3, 2], [6, 5, 3]].map((w, i) => (
              <li key={i} className="grid grid-cols-[1.25rem_1fr_1fr_5rem] items-center gap-4 px-4 sm:px-6 py-3.5 border-b">
                <span className="w-3.5 h-3.5 border-2 border-[#141414]" />
                <span className="redact" style={{ width: `${w[0] * 9}%` }} />
                <span className="redact" style={{ width: `${w[1] * 9}%` }} />
                <span className="redact justify-self-end" style={{ width: `${w[2] * 12}%` }} />
              </li>
            ))}
          </ul>
          <div className="absolute inset-0 grid place-items-center px-4">
            <Link href="/login" className="bb bb-sig bb-lg">
              <Lock size={16} strokeWidth={2.5} /> {l.livePredictions.lockCta}
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-b scroll-mt-14">
        <Folio n={next()} badge={l.engineHow.badge} title={l.engineHow.title} subtitle={l.engineHow.subtitle} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {l.engineHow.steps.map((s: any, i: number, arr: any[]) => (
            <div key={i} className={`px-4 sm:px-6 py-6 ${i < arr.length - 1 ? 'border-b lg:border-b-0' : ''} ${i < arr.length - 1 ? 'lg:border-r' : ''} ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
              <div className="fd text-[3.2rem] leading-none tnum text-[#e63b1f]">{pad(i + 1)}</div>
              <h3 className="fd text-[1.5rem] leading-none mt-5">{s.title}</h3>
              <p className="fs mt-2 text-[1rem] leading-snug text-[var(--ink-2)] max-w-[34ch]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features (ters bant) ─────────────────────────────────────────── */}
      <section id="features" className="inv border-b scroll-mt-14">
        <Folio n={next()} title={l.features.title} subtitle={l.features.subtitle} />
        <ol className="grid grid-cols-1 md:grid-cols-2">
          {l.features.items.map((item: any, i: number, arr: any[]) => (
            <li key={i} className={`grid grid-cols-[3.5rem_1fr] gap-4 px-4 sm:px-6 py-5 ${i % 2 === 0 ? 'md:border-r' : ''} ${i === arr.length - 1 ? '' : i >= arr.length - 2 ? 'border-b md:border-b-0' : 'border-b'}`}>
              <span className="fm text-[0.8rem] tnum pt-1.5 text-[var(--ink-2)]">{pad(i + 1)}</span>
              <div>
                <h3 className="fd text-[1.6rem] leading-none">{item.title}</h3>
                <p className="fs mt-2 text-[1rem] leading-snug text-[var(--ink-2)] max-w-[44ch]">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Match Intelligence showcase ──────────────────────────────────── */}
      <section className="border-b">
        <Folio n={next()} badge={l.matchIntel.badge} title={l.matchIntel.title} subtitle={l.matchIntel.subtitle} />
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="border-b lg:border-b-0 lg:border-r">
            <ol>
              {l.matchIntel.bullets.map((b: any, i: number) => (
                <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-4 px-4 sm:px-6 py-5 border-b">
                  <span className="fm text-[0.8rem] tnum pt-1.5 text-[var(--ink-2)]">{pad(i + 1)}</span>
                  <div>
                    <h3 className="fd text-[1.5rem] leading-none">{b.title}</h3>
                    <p className="fs mt-2 text-[1rem] leading-snug text-[var(--ink-2)] max-w-[44ch]">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="px-4 sm:px-6 py-6">
              <Link href="/login" className="bb bb-ink">{l.matchIntel.cta}</Link>
            </div>
          </div>

          {/* Örnek maç kağıdı */}
          <div className="px-4 sm:px-6 py-6 sm:py-8">
            <div className="border-2">
              <div className="flex items-center justify-between px-4 py-2 border-b fm-label">
                <span>{l.matchIntel.sampleLabel}</span>
                <div className="flex">
                  {['TR', 'EN', 'DE'].map((x) => (
                    <span key={x} className={`px-2 ${x === String(lang).toUpperCase() ? 'bg-[#141414] text-[#f2efe6]' : 'text-[var(--ink-2)]'}`}>{x}</span>
                  ))}
                </div>
              </div>
              <div className="px-4 pt-4 fm text-[0.72rem] uppercase tracking-wider text-[var(--ink-2)]">{l.matchIntel.sampleLeague}</div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 pt-2 pb-4">
                <div>
                  <div className="fm-label text-[var(--ink-2)]">{ui.home}</div>
                  <div className="fd text-[2.2rem] sm:text-[2.8rem] leading-none mt-1">{l.matchIntel.sampleHome}</div>
                </div>
                <div className="fm text-[0.8rem] pb-1">vs</div>
                <div className="text-right">
                  <div className="fm-label text-[var(--ink-2)]">{ui.away}</div>
                  <div className="fd text-[2.2rem] sm:text-[2.8rem] leading-none mt-1 text-[#e63b1f]">{l.matchIntel.sampleAway}</div>
                </div>
              </div>
              {/* Olasılık çubuğu: ev = mürekkep, beraberlik = tarama, deplasman = sinyal */}
              <div className="mx-4 flex h-5 border">
                <div className="bg-[#141414]" style={{ width: '46%' }} />
                <div className="hatch border-l border-r" style={{ width: '27%' }} />
                <div className="bg-[#e63b1f]" style={{ width: '27%' }} />
              </div>
              <div className="grid grid-cols-3 px-4 pt-1.5 pb-4 fm text-[0.72rem] tnum">
                <span>{l.matchIntel.probHome}</span>
                <span className="text-center">{l.matchIntel.probDraw}</span>
                <span className="text-right">{l.matchIntel.probAway}</span>
              </div>
              <div className="grid grid-cols-2 border-t border-b">
                <div className="px-4 py-2.5 border-r fm text-[0.8rem] flex justify-between"><span>{l.matchIntel.over}</span><b className="tnum">55%</b></div>
                <div className="px-4 py-2.5 fm text-[0.8rem] flex justify-between"><span>{l.matchIntel.btts}</span><b className="tnum">58%</b></div>
              </div>
              <div className="px-4 py-4">
                <div className="fm-label text-[var(--ink-2)] mb-2">{l.matchIntel.previewLabel}</div>
                <p className="fs text-[1rem] leading-snug">{l.matchIntel.samplePreview}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tipster League ───────────────────────────────────────────────── */}
      <section className="border-b">
        <Folio n={next()} badge={l.tipsterLeague.badge} title={l.tipsterLeague.title} subtitle={l.tipsterLeague.description} kicker={l.tipsterLeague.subtitle} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b">
          {l.tipsterLeague.features.map((item: any, i: number, arr: any[]) => (
            <div key={i} className={`px-4 sm:px-6 py-5 ${i < 2 ? 'border-b lg:border-b-0' : i === 2 ? 'border-b sm:border-b-0' : ''} ${i < arr.length - 1 ? 'lg:border-r' : ''} ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
              <div className="fm text-[0.8rem] tnum text-[var(--ink-2)]">{pad(i + 1)}</div>
              <h3 className="fd text-[1.5rem] leading-none mt-3">{item.title}</h3>
              <p className="fs mt-2 text-[1rem] leading-snug text-[var(--ink-2)]">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[10rem_1fr] border-b">
          <div className="fm-label px-4 sm:px-6 pt-4 md:py-4 md:border-r">{ui.steps}</div>
          <ol className="grid grid-cols-2 lg:grid-cols-4">
            {l.tipsterLeague.howItWorks.map((item: any, i: number, arr: any[]) => (
              <li key={i} className={`px-4 sm:px-6 py-4 ${i % 2 === 0 ? 'border-r' : i < arr.length - 1 ? 'lg:border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''}`}>
                <div className="flex items-baseline gap-3">
                  <span className="fd text-[2rem] leading-none tnum text-[#e63b1f]">{item.step}</span>
                  <h4 className="fd text-[1.2rem] leading-none">{item.title}</h4>
                </div>
                <p className="fs mt-1.5 text-[0.95rem] leading-snug text-[var(--ink-2)]">{item.desc}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Puan çarpanları: tipografik tablo */}
        <div className="grid grid-cols-1 md:grid-cols-[10rem_1fr] border-b">
          <div className="fm-label px-4 sm:px-6 pt-4 md:py-4 md:border-r">{l.tipsterLeague.multipliers.title}</div>
          <div className="grid grid-cols-4">
            {l.tipsterLeague.multipliers.items.map((item: any, i: number, arr: any[]) => (
              <div key={i} className={`px-3 sm:px-6 py-4 ${i < arr.length - 1 ? 'border-r' : ''}`}>
                <div className="fd tnum leading-none" style={{ fontSize: 'clamp(2.2rem, 7vw, 5.5rem)' }}>{item.multiplier}</div>
                <div className="fm-label mt-2 text-[var(--ink-2)]">{item.type}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 px-4 sm:px-6 py-6">
          <Link href="/login" className="bb bb-ink">{stripLeadingEmoji(l.tipsterLeague.joinCta)}</Link>
          <Link href="/ai-performance" className="bb">{stripLeadingEmoji(l.tipsterLeague.aiPerfCta)}</Link>
        </div>
      </section>

      {/* ── Pro highlight ────────────────────────────────────────────────── */}
      <section className="border-b">
        <Folio n={next()} badge={l.proHighlight.badge} title={l.proHighlight.title} subtitle={l.proHighlight.subtitle} />
        <div className="grid grid-cols-1 md:grid-cols-3 border-b">
          {l.proHighlight.systems.map((s: any, i: number, arr: any[]) => (
            <div key={i} className={`px-4 sm:px-6 py-6 ${i < arr.length - 1 ? 'border-b md:border-b-0 md:border-r' : ''}`}>
              <span className="fm-label inline-block border-2 border-[#141414] px-2 py-1">{s.highlight}</span>
              <h3 className="fd text-[1.7rem] leading-none mt-5">{s.name}</h3>
              <p className="fs mt-2 text-[1rem] leading-snug text-[var(--ink-2)] max-w-[40ch]">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 py-6">
          <p className="fm text-[0.8rem] leading-snug max-w-[70ch]">{stripLeadingEmoji(l.proHighlight.bottomText)}</p>
          <Link href="/login" className="bb bb-sig">{l.proHighlight.cta}</Link>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-b scroll-mt-14">
        <Folio n={next()} title={l.pricing.title} subtitle={l.pricing.subtitle} />
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Free */}
          <div className="px-4 sm:px-6 py-7 border-b md:border-b-0 md:border-r flex flex-col">
            <div className="fm-label text-[var(--ink-2)]">{l.pricing.free.name}</div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="fd tnum text-[4rem] leading-none">{l.pricing.free.price}</span>
              <span className="fm text-[0.85rem]">{l.pricing.free.period}</span>
            </div>
            <ul className="mt-6 border-t">
              {l.pricing.free.features.map((f: string, i: number) => (
                <li key={i} className="fs text-[1rem] py-2.5 border-b flex gap-3 items-baseline">
                  <span className="w-2 h-2 bg-current shrink-0" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <Link href="/login" className="bb bb-block">{l.pricing.free.cta}</Link>
            </div>
          </div>

          {/* Pro (ters bant) */}
          <div className="inv px-4 sm:px-6 py-7 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="fm-label text-[var(--ink-2)]">{l.pricing.pro.name}</span>
              <span className="fm-label bg-[#e63b1f] text-[#141414] px-2 py-1">{l.pricing.pro.badge}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="fd tnum text-[4rem] leading-none">{l.pricing.pro.price}</span>
              <span className="fm text-[0.85rem]">{l.pricing.pro.period}</span>
            </div>
            <div className="mt-5 border p-3">
              <p className="fm text-[0.8rem] font-semibold">{stripLeadingEmoji(l.pricing.pro.trial)}</p>
              <p className="fs text-[0.9rem] leading-snug text-[var(--ink-2)] mt-1">{l.pricing.pro.trialDesc}</p>
            </div>
            <ul className="mt-5 border-t">
              {l.pricing.pro.features.map((f: string, i: number) => (
                <li key={i} className="fs text-[1rem] py-2.5 border-b flex gap-3 items-baseline">
                  <span className="w-2 h-2 bg-[#e63b1f] shrink-0" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <p className="fm text-[0.72rem] text-[var(--ink-2)] mt-3">{stripLeadingEmoji(l.pricing.pro.cancelAnytime)}</p>
            <div className="mt-auto pt-6">
              <Link href="/login" className="bb bb-sig bb-block">{l.pricing.pro.cta}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="border-b">
        <Folio n={next()} title={l.testimonials.title} />
        <div className="grid grid-cols-1 md:grid-cols-3">
          {l.testimonials.items.map((item: any, i: number, arr: any[]) => (
            <figure key={i} className={`px-4 sm:px-6 py-6 ${i < arr.length - 1 ? 'border-b md:border-b-0 md:border-r' : ''}`}>
              <div className="fd text-[4rem] leading-[0.6] text-[#e63b1f]" aria-hidden>&ldquo;</div>
              <blockquote className="fs text-[1.2rem] leading-snug mt-2">{item.text}</blockquote>
              <figcaption className="fm text-[0.75rem] mt-4">
                <span className="font-semibold">{item.author}</span>
                <span className="text-[var(--ink-2)]"> · {item.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Final CTA (sinyal bandı) ─────────────────────────────────────── */}
      <section className="sig border-b">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-end gap-6 px-4 sm:px-6 py-10 sm:py-14">
          <div>
            <h2 className="fd leading-[0.86]" style={{ fontSize: 'clamp(2.8rem, 9vw, 8rem)' }}>{l.cta.title}</h2>
            <p className="fs text-[1.15rem] leading-snug mt-4 max-w-[48ch]">{l.cta.subtitle}</p>
          </div>
          <Link href="/login" className="bb bb-lg !bg-[#141414] !text-[#f2efe6] hover:!bg-[#f2efe6] hover:!text-[#141414]">
            {l.cta.button}
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="inv">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 px-4 sm:px-6 pt-10 pb-8 border-b">
          <div>
            <div className="fd leading-[0.86]" style={{ fontSize: 'clamp(2.4rem, 7vw, 6rem)' }}>Football Analytics Pro</div>
            <p className="fm text-[0.78rem] mt-4 text-[var(--ink-2)]">{l.footer.poweredBy}</p>
            <a href="https://swissdigital.life" target="_blank" rel="noopener noreferrer" className="fm text-[0.78rem] underline underline-offset-4 hover:text-[#e63b1f] inline-block mt-1">
              {l.footer.developedBy}
            </a>
          </div>
          <div className="grid grid-cols-3 gap-8">
            <FooterCol title={l.footer.product} links={[
              { label: l.footer.features, href: '#features' },
              { label: l.footer.pricing, href: '/pricing' },
              { label: l.footer.demo, href: '#promo-video' },
              { label: ui.contact, href: '/contact' },
            ]} />
            <FooterCol title={l.footer.company} links={[
              { label: l.footer.about, href: 'https://swissdigital.life', external: true },
              { label: l.footer.blog, href: '#' },
              { label: l.footer.careers, href: '#' },
            ]} />
            <FooterCol title={l.footer.legal} links={[
              { label: l.footer.privacy, href: '/privacy' },
              { label: l.footer.terms, href: '#' },
            ]} />
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 fm text-[0.72rem] text-[var(--ink-2)]">{l.footer.copyright}</div>
      </footer>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Bölüm künyesi: sol sütunda folyo + rozet metni (mono), sağda manşet + alt başlık. */
function Folio({ n, badge, title, subtitle, kicker }: { n: string; badge?: string; title: string; subtitle?: string; kicker?: string }) {
  return (
    <div className="border-b grid grid-cols-1 md:grid-cols-[10rem_1fr] gap-x-4 px-4 sm:px-6 pt-6 pb-7">
      <div className="fm-label pt-2 md:pt-3 mb-4 md:mb-0">
        {n}{badge ? ` · ${stripLeadingEmoji(badge)}` : ''}
      </div>
      <div>
        <h2 className="fd leading-[0.9]" style={{ fontSize: 'clamp(2.4rem, 6.5vw, 5.4rem)' }}>{title}</h2>
        {kicker && <p className="fm text-[0.85rem] font-semibold mt-3 text-[#e63b1f]">{kicker}</p>}
        {subtitle && <p className="fs text-[1.15rem] leading-snug mt-3 max-w-[58ch] text-[var(--ink-2)]">{subtitle}</p>}
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div>
      <h4 className="fm-label text-[var(--ink-2)] mb-3">{title}</h4>
      <ul className="space-y-1.5">
        {links.map((lnk, i) => (
          <li key={i}>
            {lnk.external ? (
              <a href={lnk.href} target="_blank" rel="noopener noreferrer" className="fs text-[1rem] hover:underline underline-offset-4">{lnk.label}</a>
            ) : (
              <Link href={lnk.href} className="fs text-[1rem] hover:underline underline-offset-4">{lnk.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
