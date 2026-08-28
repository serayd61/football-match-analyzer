'use client';

// ============================================================================
// DailyAnalyses — "Günün Analizleri" bloğu.
// Gece batch'inin hazırladığı 2-3 tam analizi vitrine çıkarır: tıklayan
// kullanıcı maç sayfasında CACHE'ten anında tam analizi görür (bekleme yok).
// Altta dünün analizleri skor + tuttu/tutmadı rozetleriyle durur — maç
// sayfasındaki FT karnesiyle aynı kanıt döngüsünün dashboard yüzü.
// Veri: /api/v2/daily-analyses (public özet). Boşsa blok hiç görünmez.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, ChevronRight, Clock } from 'lucide-react';
import { displayLeague } from '@/lib/league-names';

interface Summary {
  fixtureId: number;
  home: string;
  away: string;
  homeId: number | null;
  awayId: number | null;
  league: string | null;
  kickoff: string;
  matchResult: { prediction: string; confidence: number } | null;
  overUnder: { prediction: string; confidence: number } | null;
  btts: { prediction: string; confidence: number } | null;
  risk: string | null;
  result: {
    homeScore: number | null;
    awayScore: number | null;
    matchResultCorrect: boolean | null;
    overUnderCorrect: boolean | null;
    bttsCorrect: boolean | null;
  } | null;
}

const STR = {
  tr: {
    title: 'Günün Analizleri',
    subtitle: 'AI konsensüsü bu maçları önceden analiz etti — tıkla, tam analiz anında açılır',
    open: 'Analizi aç',
    mr: 'MS', ou: 'A/Ü 2.5', btts: 'KG',
    yTitle: 'Dünün analizleri ne yaptı?',
    hit: 'Tuttu', miss: 'Tutmadı',
    locale: 'tr-TR',
  },
  en: {
    title: "Today's Analyses",
    subtitle: 'The AI consensus pre-analyzed these matches — one click opens the full analysis instantly',
    open: 'Open analysis',
    mr: '1X2', ou: 'O/U 2.5', btts: 'BTTS',
    yTitle: "How did yesterday's analyses do?",
    hit: 'Hit', miss: 'Miss',
    locale: 'en-GB',
  },
  de: {
    title: 'Analysen des Tages',
    subtitle: 'Der KI-Konsens hat diese Spiele vorab analysiert — ein Klick öffnet die vollständige Analyse sofort',
    open: 'Analyse öffnen',
    mr: '1X2', ou: 'Ü/U 2.5', btts: 'BTTS',
    yTitle: 'Wie liefen die gestrigen Analysen?',
    hit: 'Richtig', miss: 'Falsch',
    locale: 'de-DE',
  },
} as const;

function matchHref(m: Summary): string {
  const p = new URLSearchParams({
    home: m.home,
    away: m.away,
    league: m.league || '',
    date: m.kickoff,
  });
  if (m.homeId) p.set('homeId', String(m.homeId));
  if (m.awayId) p.set('awayId', String(m.awayId));
  return `/match/${m.fixtureId}?${p.toString()}`;
}

export default function DailyAnalyses({ lang = 'tr' }: { lang?: string }) {
  const t = STR[lang as keyof typeof STR] || STR.en;
  const [today, setToday] = useState<Summary[]>([]);
  const [settled, setSettled] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/v2/daily-analyses')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setToday(d.today || []);
          setSettled(d.settled || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || (today.length === 0 && settled.length === 0)) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mb-12"
    >
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-brand-500/10 border border-brand-500/30 text-brand-400">
          <Brain size={18} />
        </span>
        <h2 className="text-xl font-semibold text-content tracking-tight">{t.title}</h2>
      </div>
      <p className="text-sm text-content-muted mb-5">{t.subtitle}</p>

      {today.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4 mb-5">
          {today.map((m) => (
            <Link
              key={m.fixtureId}
              href={matchHref(m)}
              className="fa-card p-4 block hover:border-brand-500/40 transition-colors group"
            >
              <div className="flex items-center justify-between text-[11px] text-content-muted mb-3">
                <span className="truncate">{displayLeague(m.league || '')}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Clock size={12} />
                  {new Date(m.kickoff).toLocaleString(t.locale, {
                    weekday: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm font-semibold text-content mb-3 truncate">
                {m.home} <span className="text-content-subtle">vs</span> {m.away}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.matchResult && (
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300">
                    {t.mr}: {m.matchResult.prediction} · %{m.matchResult.confidence}
                  </span>
                )}
                {m.overUnder && (
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-surface-3 border border-line text-content-muted">
                    {t.ou}: {m.overUnder.prediction}
                  </span>
                )}
                {m.btts && (
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-surface-3 border border-line text-content-muted">
                    {t.btts}: {m.btts.prediction}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-brand-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                {t.open} <ChevronRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <div className="fa-card p-4">
          <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-3">
            {t.yTitle}
          </p>
          <div className="space-y-2">
            {settled.map((m) => {
              const r = m.result!;
              const marks: { label: string; pred: string; ok: boolean | null }[] = [
                m.matchResult ? { label: t.mr, pred: m.matchResult.prediction, ok: r.matchResultCorrect } : null,
                m.overUnder ? { label: t.ou, pred: m.overUnder.prediction, ok: r.overUnderCorrect } : null,
                m.btts ? { label: t.btts, pred: m.btts.prediction, ok: r.bttsCorrect } : null,
              ].filter(Boolean) as { label: string; pred: string; ok: boolean | null }[];
              return (
                <Link
                  key={m.fixtureId}
                  href={matchHref(m)}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm text-content min-w-0 truncate">
                    {m.home} <span className="font-bold tabular-nums">{r.homeScore}-{r.awayScore}</span> {m.away}
                  </span>
                  <span className="flex gap-1.5 ml-auto shrink-0">
                    {marks.map((k, i) =>
                      k.ok == null ? null : (
                        <span
                          key={i}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            k.ok
                              ? 'bg-positive/10 border-positive/30 text-positive'
                              : 'bg-negative/10 border-negative/30 text-negative'
                          }`}
                          title={`${k.label}: ${k.pred}`}
                        >
                          {k.label} {k.ok ? '✓' : '✗'}
                        </span>
                      ),
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
}
