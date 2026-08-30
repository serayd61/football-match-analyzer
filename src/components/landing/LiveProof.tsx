'use client';

// ============================================================================
// LiveProof — landing'in KANIT bloğu (anonim ziyaretçiye açık).
// ----------------------------------------------------------------------------
// Reklamdan gelen ziyaretçi kayıt olmadan hiçbir gerçek sayı görmüyordu.
// Bu blok hero'nun hemen altında üç şeyi gösterir:
//   ① ölçülmüş isabet oranı (çifte şans, n ile birlikte),
//   ② dünün GERÇEK maçları — skor + tuttu/tutmadı, kaybedenler dahil,
//   ③ tek tıklık "kendin dene" yolu.
// Kaynak: /api/v2/proof (public, 15 dk cache). Veri yoksa/hata varsa blok hiç
// render edilmez — landing asla boş kutu göstermez.
//
// DÜRÜSTLÜK: 1X2 oranı (%49) çifte şans oranının (%76) YANINDA gösterilir.
// Yüksek olanı manşete alıp düşüğü gizlemek dönüşümü kısa vadede artırırdı
// ama ürün beklentiyi karşılamayınca iade/churn olarak geri döner.
// ============================================================================

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { countryInfo } from '@/lib/countries';
import { formatAccuracy, type ProofData, type ProofPick } from '@/lib/hooks/useProof';

const STR = {
  tr: {
    badge: 'Canlı karne',
    headline: 'çifte şans isabet oranı',
    headlineSub: (n: string) => `${n} sonuçlanmış maçta ölçüldü — ayıklanmamış, kaybedenler dahil.`,
    m30: 'Son 30 gün',
    mHigh: 'Yüksek güvenli seçimler',
    mMr: 'Tek sonuç (1X2)',
    honest: 'Tek sonucu bilmek yapısal olarak zordur (maçların dörtte biri beraberlik biter). Bu yüzden motoru kazanılabilir forma çeviriyoruz: iki sonucu birden kapsayan çifte şans.',
    dayTitle: 'Dün ne oldu?',
    dayScore: (ok: number, n: number) => `${n} seçimden ${ok} doğru`,
    dayNote: 'Bu liste sonuçtan önce belirlenen kurala göre üretildi; kaybedenler silinmedi.',
    or: 'veya',
    draw: 'beraberlik',
    cta: 'Bugünün maçlarını ücretsiz dene',
    ctaNote: 'Kayıt anında · günde 3 ücretsiz AI analizi · kart istemez',
    disclaimer: 'Bilgilendirme amaçlıdır, bahis tavsiyesi değildir.',
    locale: 'tr-TR',
  },
  en: {
    badge: 'Live track record',
    headline: 'double chance accuracy',
    headlineSub: (n: string) => `Measured across ${n} settled matches — unfiltered, losses included.`,
    m30: 'Last 30 days',
    mHigh: 'High-confidence picks',
    mMr: 'Single outcome (1X2)',
    honest: 'Calling a single outcome is structurally hard — a quarter of matches end in a draw. So we turn the engine into a winnable form: double chance, covering two outcomes at once.',
    dayTitle: 'What happened yesterday?',
    dayScore: (ok: number, n: number) => `${ok} of ${n} picks correct`,
    dayNote: 'This list follows a rule fixed before kickoff; losses were not removed.',
    or: 'or',
    draw: 'draw',
    cta: "Try today's matches free",
    ctaNote: 'Instant sign-up · 3 free AI analyses per day · no card required',
    disclaimer: 'For information only, not betting advice.',
    locale: 'en-US',
  },
  de: {
    badge: 'Live-Bilanz',
    headline: 'Trefferquote der Doppelten Chance',
    headlineSub: (n: string) => `Gemessen an ${n} abgerechneten Spielen — ungefiltert, Verluste inklusive.`,
    m30: 'Letzte 30 Tage',
    mHigh: 'Tipps mit hoher Konfidenz',
    mMr: 'Einzelergebnis (1X2)',
    honest: 'Ein einzelnes Ergebnis zu treffen ist strukturell schwer — ein Viertel aller Spiele endet unentschieden. Deshalb übersetzen wir die Engine in eine gewinnbare Form: die doppelte Chance, die zwei Ergebnisse abdeckt.',
    dayTitle: 'Was ist gestern passiert?',
    dayScore: (ok: number, n: number) => `${ok} von ${n} Tipps richtig`,
    dayNote: 'Diese Liste folgt einer vor Anpfiff festgelegten Regel; Verluste wurden nicht entfernt.',
    or: 'oder',
    draw: 'Unentschieden',
    cta: 'Heutige Spiele kostenlos testen',
    ctaNote: 'Sofort registrieren · 3 kostenlose KI-Analysen pro Tag · keine Karte nötig',
    disclaimer: 'Nur zur Information, keine Wettberatung.',
    locale: 'de-DE',
  },
};

function dcLabel(p: ProofPick, t: any): string {
  if (p.dcPick === '1X') return `${p.home} ${t.or} ${t.draw}`;
  if (p.dcPick === 'X2') return `${p.away} ${t.or} ${t.draw}`;
  return `${p.home} ${t.or} ${p.away}`;
}

export default function LiveProof({ lang = 'tr', data }: { lang?: string; data: ProofData | null }) {
  const t = (STR as any)[lang] || STR.en;

  const dc = data?.record?.doubleChance;
  // Manşet rakam yoksa blok hiç görünmez (boş kutu yerine yokluk)
  if (!data || !dc || !dc.total) return null;

  const nfmt = (n: number) => n.toLocaleString(t.locale);
  const acc = (x: number) => formatAccuracy(x, lang);

  const day = data.yesterday;
  const metrics = [
    { key: 'm30', scope: data.record.doubleChance30d },
    { key: 'mHigh', scope: data.record.doubleChanceHigh },
    { key: 'mMr', scope: data.record.matchResult },
  ].filter((m) => m.scope && m.scope.total > 0);

  return (
    <section id="live-proof" className="px-4 py-14 sm:py-20 border-y border-line bg-surface-1/40">
      <div className="max-w-5xl mx-auto">
        {/* ── Manşet: ölçülmüş oran ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-[13px] font-medium mb-5">
            <Activity size={13} /> {t.badge}
          </span>
          <div className="text-6xl sm:text-8xl font-bold tracking-tight text-brand-400 font-playfair italic leading-none">
            {acc(dc.accuracy)}
          </div>
          <h2 className="text-xl sm:text-3xl font-semibold text-content tracking-tight mt-2">
            {t.headline}
          </h2>
          <p className="text-content-muted text-base sm:text-lg mt-4 max-w-2xl mx-auto">
            {t.headlineSub(nfmt(dc.total))}
          </p>
        </motion.div>

        {/* ── Kırılım: 30 gün / yüksek güven / 1X2 (dürüst karşılaştırma) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-3 gap-2 sm:gap-3 mt-8"
        >
          {metrics.map((m) => (
            <div key={m.key} className="fa-card p-4 text-center">
              <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${m.key === 'mMr' ? 'text-content-muted' : 'text-content'}`}>
                {acc(m.scope!.accuracy)}
              </div>
              <div className="text-[11px] sm:text-xs text-content-subtle mt-1 leading-tight">{t[m.key]}</div>
              <div className="text-[10px] text-content-subtle/60 mt-0.5 tabular-nums">{nfmt(m.scope!.total)}</div>
            </div>
          ))}
        </motion.div>

        <p className="text-xs sm:text-sm text-content-subtle leading-relaxed mt-4 max-w-3xl mx-auto text-center">
          {t.honest}
        </p>

        {/* ── Dünün gerçek maçları ──────────────────────────────────────── */}
        {day.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.12 }}
            className="fa-card p-5 sm:p-6 mt-10"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h3 className="text-base font-semibold text-content flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-400" /> {t.dayTitle}
              </h3>
              <span className="text-sm font-bold text-brand-300 tabular-nums">
                {t.dayScore(day.correct, day.total)}
              </span>
            </div>

            <div className="space-y-1.5">
              {day.picks.map((p) => (
                <div
                  key={p.fixtureId}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                    p.correct
                      ? 'border-brand-500/25 bg-brand-500/[0.06]'
                      : 'border-rose-400/20 bg-rose-400/[0.04]'
                  }`}
                >
                  {p.correct
                    ? <Check size={15} className="text-brand-400 shrink-0" />
                    : <X size={15} className="text-rose-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-content truncate">
                      {p.home} <span className="text-content-subtle">–</span> {p.away}
                    </div>
                    <div className="text-[11px] text-content-subtle truncate">
                      {countryInfo(p.ccode)?.flag ? `${countryInfo(p.ccode)!.flag} ` : ''}
                      {p.league} · {dcLabel(p, t)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-content tabular-nums">
                      {p.homeScore}–{p.awayScore}
                    </div>
                    <div className="text-[10px] text-content-subtle tabular-nums">{p.probability}%</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-content-subtle/80 mt-3">{t.dayNote}</p>
          </motion.div>
        )}

        {/* ── Tek tıklık deneme yolu ────────────────────────────────────── */}
        <div className="text-center mt-9">
          <Link href="/login" className="fa-btn fa-btn-primary fa-btn-lg">
            {t.cta} <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-content-subtle mt-3">{t.ctaNote}</p>
          <p className="text-[11px] text-content-subtle/60 mt-4">{t.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
