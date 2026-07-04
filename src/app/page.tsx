'use client';

// ============================================================================
// LANDING — rebuilt with the modern design system (`.fa-shell`).
// All copy/i18n preserved verbatim (src/lib/landing-content.ts). CTAs, promo
// video, locked teaser, SEO and routing behaviour unchanged.
// ============================================================================

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Check, Star, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LandingNav from '@/components/landing/LandingNav';
import HeroSpotlight from '@/components/landing/HeroSpotlight';
import { labels, labelsDE } from '@/lib/landing-content';
import { Spinner } from '@/components/ui';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();

  useEffect(() => {
    if (session) router.push('/dashboard');
  }, [session, router]);

  const allLabels = { ...labels, de: labelsDE };
  const l = (allLabels[lang as keyof typeof allLabels] || labels.en) as any;

  if (status === 'loading') {
    return (
      <div className="fa-shell min-h-screen grid place-items-center">
        <Spinner size={28} className="text-brand-400" />
      </div>
    );
  }

  return (
    <div className="fa-shell min-h-screen">
      <LandingNav lang={lang} />

      {/* ── Hero (cursor-spotlight reveal) ───────────────────────────────── */}
      <HeroSpotlight l={l.hero} />

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section className="px-4 pt-14 pb-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            {(l.stats as Array<{ value: string; label: string }>).map((s, i) => (
              <div key={i} className="fa-card p-5 text-center">
                <div className="text-xl md:text-2xl font-bold text-content tracking-tight">{s.value}</div>
                <div className="text-xs text-content-subtle mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Promo video ──────────────────────────────────────────────────── */}
      <section id="promo-video" className="px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xl sm:text-2xl font-semibold text-content mb-6">
            {lang === 'tr' ? 'Bir bakışta' : lang === 'de' ? 'Auf einen Blick' : 'See it in action'}
          </h2>
          <motion.div
            className="fa-card overflow-hidden p-0"
            initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            <video className="w-full h-auto block" src="/promo.mp4" poster="/promo-poster.jpg"
              controls autoPlay muted loop playsInline preload="metadata" />
          </motion.div>
        </div>
      </section>

      {/* ── Live predictions teaser (locked) ─────────────────────────────── */}
      <section id="live-predictions" className="px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <SectionTitle badge={l.livePredictions.badge} title={l.livePredictions.title} subtitle={l.livePredictions.subtitle} />
          <div className="relative mt-8">
            <div className="grid md:grid-cols-3 gap-4 blur-[6px] select-none pointer-events-none opacity-60" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="fa-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-20 bg-surface-4 rounded" />
                    <div className="h-3 w-12 bg-surface-4 rounded" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    {[0, 1].map((k) => (
                      <div key={k} className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-10 h-10 rounded-full bg-surface-4" />
                        <div className="h-2 w-14 bg-surface-4 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="h-9 rounded-xl bg-surface-3 mb-3" />
                  <div className="h-2 rounded-full bg-surface-4 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-surface-3 rounded-lg" />
                    <div className="h-6 w-16 bg-surface-3 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl grid place-items-center bg-brand-500/10 border border-brand-500/30 text-brand-400 mb-5">
                <Lock size={22} />
              </div>
              <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">
                {l.livePredictions.lockCta} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <SectionTitle badge={l.engineHow.badge} title={l.engineHow.title} subtitle={l.engineHow.subtitle} center />
          <div className="grid md:grid-cols-4 gap-4 mt-12">
            {l.engineHow.steps.map((s: any, i: number) => (
              <motion.div key={i} className="fa-card fa-card-hover p-6 relative"
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <span className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[#06281d] text-sm font-bold grid place-items-center shadow-glow-brand">
                  {i + 1}
                </span>
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className="text-base font-semibold text-content mb-1.5">{s.title}</h3>
                <p className="text-sm text-content-subtle leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="px-4 py-20 border-y border-line bg-surface-1/40">
        <div className="max-w-7xl mx-auto">
          <SectionTitle title={l.features.title} subtitle={l.features.subtitle} center />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {l.features.items.map((item: any, i: number) => (
              <motion.div key={i} className="fa-card fa-card-hover p-6"
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold text-content mb-2">{item.title}</h3>
                <p className="text-sm text-content-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Match Intelligence showcase ──────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle badge={l.matchIntel.badge} title={l.matchIntel.title} subtitle={l.matchIntel.subtitle} center />
          <div className="grid lg:grid-cols-2 gap-10 items-center mt-12">
            <div className="space-y-3">
              {l.matchIntel.bullets.map((b: any, i: number) => (
                <div key={i} className="flex items-start gap-4 fa-card fa-card-hover p-5">
                  <div className="text-2xl shrink-0">{b.icon}</div>
                  <div>
                    <h3 className="text-content font-semibold mb-1">{b.title}</h3>
                    <p className="text-sm text-content-subtle leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">{l.matchIntel.cta} <ArrowRight size={18} /></Link>
              </div>
            </div>

            {/* Sample card mockup */}
            <div className="fa-card p-6 shadow-elev-3">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-content-subtle font-mono uppercase tracking-wide">{l.matchIntel.sampleLabel}</span>
                <div className="flex gap-1">
                  {['TR', 'EN', 'DE'].map((x) => (
                    <span key={x} className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${x === String(lang).toUpperCase() ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-3 text-content-subtle'}`}>{x}</span>
                  ))}
                </div>
              </div>
              <div className="text-xs text-content-subtle mb-3">{l.matchIntel.sampleLeague}</div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="text-3xl">🇫🇷</div>
                  <span className="text-sm text-content-muted">{l.matchIntel.sampleHome}</span>
                </div>
                <div className="text-content-subtle text-xs font-bold">VS</div>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="text-3xl">🇧🇪</div>
                  <span className="text-sm text-content-muted">{l.matchIntel.sampleAway}</span>
                </div>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden mb-1.5">
                <div className="bg-brand-500/80" style={{ width: '46%' }} />
                <div className="bg-amber-400/70" style={{ width: '27%' }} />
                <div className="bg-sky-500/70" style={{ width: '27%' }} />
              </div>
              <div className="flex justify-between text-[11px] text-content-subtle mb-4">
                <span>{l.matchIntel.probHome}</span>
                <span>{l.matchIntel.probDraw}</span>
                <span>{l.matchIntel.probAway}</span>
              </div>
              <div className="flex gap-2 mb-4">
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-3 border border-line text-content-muted">{l.matchIntel.over}: <b className="text-content">55%</b></span>
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-3 border border-line text-content-muted">{l.matchIntel.btts}: <b className="text-content">58%</b></span>
              </div>
              <div className="border-t border-line pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-brand-300/80 mb-1.5">📰 {l.matchIntel.previewLabel}</div>
                <p className="text-xs text-content-muted leading-relaxed">{l.matchIntel.samplePreview}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tipster League ───────────────────────────────────────────────── */}
      <section className="px-4 py-20 border-y border-line bg-surface-1/40">
        <div className="max-w-7xl mx-auto">
          <SectionTitle badge={l.tipsterLeague.badge} title={l.tipsterLeague.title} subtitle={l.tipsterLeague.description} center />
          <p className="text-center text-amber-400 -mt-3 mb-10 font-medium">{l.tipsterLeague.subtitle}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {l.tipsterLeague.features.map((item: any, i: number) => (
              <div key={i} className="fa-card fa-card-hover p-6 text-center">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-base font-semibold text-content mb-1.5">{item.title}</h3>
                <p className="text-sm text-content-subtle">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="fa-card p-8 mb-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {l.tipsterLeague.howItWorks.map((item: any, i: number) => (
                <div key={i} className="text-center">
                  <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold grid place-items-center mx-auto mb-3">{item.step}</div>
                  <h4 className="text-content font-semibold mb-1">{item.title}</h4>
                  <p className="text-sm text-content-subtle">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="fa-card p-6">
            <h3 className="text-lg font-semibold text-content text-center mb-6">{l.tipsterLeague.multipliers.title}</h3>
            <div className="flex justify-center gap-3 flex-wrap">
              {l.tipsterLeague.multipliers.items.map((item: any, i: number) => (
                <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 text-center">
                  <div className="text-amber-400 font-bold text-2xl">{item.multiplier}</div>
                  <div className="text-content-subtle text-sm">{item.type}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">{l.tipsterLeague.joinCta}</Link>
            <Link href="/ai-performance" className="fa-btn fa-btn-secondary fa-btn-lg">{l.tipsterLeague.aiPerfCta}</Link>
          </div>
        </div>
      </section>

      {/* ── Pro highlight ────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <SectionTitle badge={l.proHighlight.badge} title={l.proHighlight.title} subtitle={l.proHighlight.subtitle} center />
          <div className="grid md:grid-cols-3 gap-4 mt-12">
            {l.proHighlight.systems.map((s: any, i: number) => (
              <div key={i} className="fa-card fa-card-hover p-7">
                <div className="text-4xl mb-4">{s.icon}</div>
                <span className="inline-flex px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[11px] font-semibold mb-3">{s.highlight}</span>
                <h3 className="text-lg font-semibold text-content mb-2">{s.name}</h3>
                <p className="text-sm text-content-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <p className="text-sm text-amber-300 font-medium mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 inline-block">
              {l.proHighlight.bottomText}
            </p>
            <div>
              <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">{l.proHighlight.cta} <ArrowRight size={18} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-4 py-20 border-y border-line bg-surface-1/40">
        <div className="max-w-4xl mx-auto">
          <SectionTitle title={l.pricing.title} subtitle={l.pricing.subtitle} center />
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Free */}
            <div className="fa-card p-8">
              <h3 className="text-xl font-semibold text-content mb-2">{l.pricing.free.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-content">{l.pricing.free.price}</span>
                <span className="text-content-subtle">{l.pricing.free.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {l.pricing.free.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-content-muted">
                    <Check size={16} className="text-brand-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="fa-btn fa-btn-secondary w-full">{l.pricing.free.cta}</Link>
            </div>

            {/* Pro */}
            <div className="fa-card p-8 relative border-brand-500/40 shadow-glow-brand">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-500 text-[#06281d] text-xs font-bold">{l.pricing.pro.badge}</span>
              <h3 className="text-xl font-semibold text-content mb-2">{l.pricing.pro.name}</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-4xl font-bold text-content">{l.pricing.pro.price}</span>
                <span className="text-content-subtle">{l.pricing.pro.period}</span>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4">
                <p className="text-amber-300 font-semibold text-sm">{l.pricing.pro.trial}</p>
                <p className="text-amber-200/70 text-xs mt-1">{l.pricing.pro.trialDesc}</p>
              </div>
              <ul className="space-y-3 mb-4">
                {l.pricing.pro.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-content-muted">
                    <Check size={16} className="text-brand-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <div className="text-center mb-4">
                <span className="inline-flex items-center gap-1 text-brand-300 text-sm font-medium bg-brand-500/10 px-3 py-1 rounded-full">{l.pricing.pro.cancelAnytime}</span>
              </div>
              <Link href="/login" className="fa-btn fa-btn-primary w-full">{l.pricing.pro.cta}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-content text-center mb-12 tracking-tight">{l.testimonials.title}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {l.testimonials.items.map((item: any, i: number) => (
              <div key={i} className="fa-card p-6">
                <div className="flex text-amber-400 mb-4">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={14} fill="currentColor" />)}</div>
                <p className="text-content-muted mb-5 leading-relaxed">&ldquo;{item.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-sky-500 grid place-items-center text-white font-bold text-sm">{item.author.charAt(0)}</div>
                  <div>
                    <div className="text-content font-semibold text-sm">{item.author}</div>
                    <div className="text-content-subtle text-xs">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden fa-card p-10 sm:p-14 text-center">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(40rem 20rem at 50% 0%, rgba(16,185,129,0.14), transparent 60%)' }} />
            <div className="relative">
              <Sparkles size={28} className="text-brand-400 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-4xl font-bold text-content tracking-tight">{l.cta.title}</h2>
              <p className="text-content-muted text-lg mt-3 mb-8">{l.cta.subtitle}</p>
              <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">{l.cta.button} <ArrowRight size={18} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-[#06281d]">⚽</div>
                <span className="text-content font-semibold">Football Analytics Pro</span>
              </div>
              <p className="text-content-subtle text-sm">{l.footer.poweredBy}</p>
              <a href="https://swissdigital.life" target="_blank" rel="noopener noreferrer"
                className="text-content-subtle text-sm hover:text-brand-400 transition-colors inline-flex items-center gap-1 mt-1.5">
                🇨🇭 {l.footer.developedBy}
              </a>
            </div>
            <FooterCol title={l.footer.product} links={[
              { label: l.footer.features, href: '#features' },
              { label: l.footer.pricing, href: '/pricing' },
              { label: l.footer.demo, href: '#promo-video' },
              { label: lang === 'tr' ? 'İletişim' : lang === 'de' ? 'Kontakt' : 'Contact', href: '/contact' },
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
          <div className="border-t border-line pt-8 text-center text-content-subtle text-sm">{l.footer.copyright}</div>
        </div>
      </footer>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function SectionTitle({ badge, title, subtitle, center }: { badge?: string; title: string; subtitle?: string; center?: boolean }) {
  // Lithos tipografi dili: başlığın ilk kelimesi Playfair italic serif.
  const [first, ...rest] = title.split(' ');
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      {badge && (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-line bg-surface-2 text-content-muted text-[13px] font-medium mb-4">
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-4xl font-bold text-content tracking-tight">
        <span className="font-playfair italic font-medium">{first}</span>
        {rest.length > 0 ? ` ${rest.join(' ')}` : ''}
      </h2>
      {subtitle && <p className="text-content-muted text-lg mt-3 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div>
      <h4 className="text-content font-semibold mb-4 text-sm">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((lnk, i) => (
          <li key={i}>
            {lnk.external ? (
              <a href={lnk.href} target="_blank" rel="noopener noreferrer" className="text-sm text-content-subtle hover:text-content transition-colors">{lnk.label}</a>
            ) : (
              <Link href={lnk.href} className="text-sm text-content-subtle hover:text-content transition-colors">{lnk.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
