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
//
// Biçim: basılı sonuç cetveli. Dev rakam dar grotesk, satırlar 1px çizgi,
// skorlar/olasılıklar mono; tuttu = dolu kare, tutmadı = boş kare + üstü çizili.
// ============================================================================

import Link from 'next/link';
import { formatAccuracy, type ProofData, type ProofPick } from '@/lib/hooks/useProof';

const STR = {
  tr: {
    badge: 'Canlı karne',
    headline: 'çifte şans isabet oranı',
    headlineSub: (n: string) => `${n} sonuçlanmış maçta ölçüldü — ayıklanmamış, kaybedenler dahil.`,
    m30: 'Son 30 gün',
    mHigh: 'Yüksek güvenli seçimler',
    mMr: 'Tek sonuç (1X2)',
    n: 'maç',
    honest: 'Tek sonucu bilmek yapısal olarak zordur (maçların dörtte biri beraberlik biter). Bu yüzden motoru kazanılabilir forma çeviriyoruz: iki sonucu birden kapsayan çifte şans.',
    dayTitle: 'Dün ne oldu?',
    dayScore: (ok: number, n: number) => `${n} seçimden ${ok} doğru`,
    dayNote: 'Bu liste sonuçtan önce belirlenen kurala göre üretildi; kaybedenler silinmedi.',
    colMatch: 'Maç',
    colPick: 'Seçim',
    colScore: 'Skor',
    colProb: 'Olasılık',
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
    n: 'matches',
    honest: 'Calling a single outcome is structurally hard — a quarter of matches end in a draw. So we turn the engine into a winnable form: double chance, covering two outcomes at once.',
    dayTitle: 'What happened yesterday?',
    dayScore: (ok: number, n: number) => `${ok} of ${n} picks correct`,
    dayNote: 'This list follows a rule fixed before kickoff; losses were not removed.',
    colMatch: 'Match',
    colPick: 'Pick',
    colScore: 'Score',
    colProb: 'Prob.',
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
    n: 'Spiele',
    honest: 'Ein einzelnes Ergebnis zu treffen ist strukturell schwer — ein Viertel aller Spiele endet unentschieden. Deshalb übersetzen wir die Engine in eine gewinnbare Form: die doppelte Chance, die zwei Ergebnisse abdeckt.',
    dayTitle: 'Was ist gestern passiert?',
    dayScore: (ok: number, n: number) => `${ok} von ${n} Tipps richtig`,
    dayNote: 'Diese Liste folgt einer vor Anpfiff festgelegten Regel; Verluste wurden nicht entfernt.',
    colMatch: 'Spiel',
    colPick: 'Tipp',
    colScore: 'Ergebnis',
    colProb: 'Wahrsch.',
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

/** Tuttu: dolu mürekkep karesi. Tutmadı: boş kare, sinyal renkli çapraz. */
function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-3.5 h-3.5 shrink-0 border-2 border-[#141414] ${ok ? 'bg-[#141414]' : 'bg-transparent'}`}
      style={ok ? undefined : { backgroundImage: 'linear-gradient(45deg, transparent 42%, #e63b1f 42%, #e63b1f 58%, transparent 58%)' }}
      aria-label={ok ? 'correct' : 'missed'}
      role="img"
    />
  );
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
    <section id="live-proof" className="scroll-mt-14 border-b">
      {/* ── Bölüm künyesi ─────────────────────────────────────────────── */}
      <div className="border-b flex items-center justify-between px-4 sm:px-6 py-2.5 fm-label">
        <span className="flex items-center gap-3"><span className="dot dot-live" aria-hidden />01 · {t.badge}</span>
        <span className="hidden sm:inline tnum">n = {nfmt(dc.total)}</span>
      </div>

      {/* ── Manşet: dev rakam + başlık ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] items-end gap-x-10 gap-y-4 px-4 sm:px-6 pt-8 pb-8 lg:pb-10">
        <div className="fd leading-[0.8] tnum" style={{ fontSize: 'clamp(6.5rem, 24vw, 19rem)', letterSpacing: '-0.03em' }}>
          {acc(dc.accuracy)}
        </div>
        <div className="lg:pb-4 max-w-[38ch]">
          <h2 className="fd text-[2rem] sm:text-[2.6rem] leading-[0.92]">{t.headline}</h2>
          <p className="fs mt-3 text-[1.05rem] leading-snug text-[var(--ink-2)]">{t.headlineSub(nfmt(dc.total))}</p>
        </div>
      </div>

      {/* ── Kırılım: 30 gün / yüksek güven / 1X2 — ruled cells ─────────── */}
      <div className="border-t grid grid-cols-3">
        {metrics.map((m, i) => (
          <div key={m.key} className={`px-3 sm:px-6 py-4 sm:py-5 ${i < metrics.length - 1 ? 'border-r' : ''}`}>
            <div className={`fd tnum leading-none text-[2rem] sm:text-[3.4rem] ${m.key === 'mMr' ? 'text-[var(--ink-2)]' : ''}`}>
              {acc(m.scope!.accuracy)}
            </div>
            <div className="fm-label mt-2 leading-tight">{t[m.key]}</div>
            <div className="fm text-[0.7rem] tnum text-[var(--ink-2)] mt-0.5">{nfmt(m.scope!.total)} {t.n}</div>
          </div>
        ))}
      </div>

      {/* ── Dürüst not ─────────────────────────────────────────────────── */}
      <div className="border-t grid grid-cols-1 md:grid-cols-[10rem_1fr] px-4 sm:px-6 py-5 gap-2">
        <span className="fm-label pt-1.5">nb.</span>
        <p className="fs text-[1.05rem] leading-snug max-w-[62ch]">{t.honest}</p>
      </div>

      {/* ── Dünün gerçek maçları — cetvel ───────────────────────────────── */}
      {day.total > 0 && (
        <div className="border-t">
          <div className="flex items-baseline justify-between flex-wrap gap-2 px-4 sm:px-6 pt-5 pb-3">
            <h3 className="fd text-[1.6rem] sm:text-[2rem] leading-none">{t.dayTitle}</h3>
            <span className="fm text-[0.85rem] font-semibold tnum">{t.dayScore(day.correct, day.total)}</span>
          </div>

          <div className="hidden sm:grid grid-cols-[1.25rem_1fr_1fr_5rem_4.5rem] gap-x-4 px-4 sm:px-6 py-1.5 border-t border-b fm-label text-[var(--ink-2)]">
            <span />
            <span>{t.colMatch}</span>
            <span>{t.colPick}</span>
            <span className="text-right">{t.colScore}</span>
            <span className="text-right">{t.colProb}</span>
          </div>

          <ul className="border-b sm:border-t-0">
            {day.picks.map((p) => (
              <li
                key={p.fixtureId}
                className="grid grid-cols-[1.25rem_1fr_auto] sm:grid-cols-[1.25rem_1fr_1fr_5rem_4.5rem] items-center gap-x-4 gap-y-0.5 px-4 sm:px-6 py-2.5 border-b last:border-b-0"
              >
                <Mark ok={p.correct} />
                <div className="min-w-0">
                  <div className={`fs text-[1rem] leading-tight truncate ${p.correct ? '' : 'line-through decoration-[#e63b1f] decoration-2'}`}>
                    {p.home} <span className="text-[var(--ink-2)]">–</span> {p.away}
                  </div>
                  <div className="fm text-[0.68rem] uppercase tracking-wider text-[var(--ink-2)] truncate sm:hidden">
                    {p.league} · {dcLabel(p, t)}
                  </div>
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="fm text-[0.78rem] truncate">{dcLabel(p, t)}</div>
                  <div className="fm text-[0.68rem] uppercase tracking-wider text-[var(--ink-2)] truncate">{p.league}</div>
                </div>
                <div className="fd tnum text-[1.35rem] leading-none text-right">
                  {p.homeScore}–{p.awayScore}
                </div>
                <div className="hidden sm:block fm text-[0.8rem] tnum text-right text-[var(--ink-2)]">{p.probability}%</div>
              </li>
            ))}
          </ul>

          <p className="fm text-[0.7rem] text-[var(--ink-2)] px-4 sm:px-6 py-3">{t.dayNote}</p>
        </div>
      )}

      {/* ── Tek tıklık deneme yolu ────────────────────────────────────── */}
      <div className="border-t grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 py-6">
        <div>
          <p className="fm text-[0.78rem]">{t.ctaNote}</p>
          <p className="fm text-[0.68rem] text-[var(--ink-2)] mt-1">{t.disclaimer}</p>
        </div>
        <Link href="/login" className="bb bb-sig bb-lg w-full md:w-auto">
          {t.cta}
        </Link>
      </div>
    </section>
  );
}
