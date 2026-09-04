'use client';

// ============================================================================
// AnalysisIndexClient — presentational, language-aware view for /analysis.
// Data is fetched in the server component (page.tsx) and passed as props.
// ============================================================================

import Link from 'next/link';
import {
  matchSlug,
  matchResultLabel,
  formatMatchDate,
  type PublicAnalysis,
  type AccuracyStats,
} from '@/lib/seo';
import { useLanguage } from '@/components/LanguageProvider';

const L = {
  tr: {
    title: 'Futbol AI Tahminleri & Analizleri',
    desc: '4 elite AI modelinin konsensüsüyle üretilen maç tahminleri. Her analiz, sonuçlandıktan sonra doğrulanır.',
    analyzedMatches: 'Analiz Edilen Maç',
    accuracy: 'Maç Sonucu İsabeti',
    settled: 'Sonuçlanan Maç',
    leagues: 'Lig',
    prediction: 'Tahmin',
    empty: 'Şu anda gösterilecek analiz yok.',
  },
  en: {
    title: 'Football AI Predictions & Analysis',
    desc: 'Match predictions produced by the consensus of 4 elite AI models. Every analysis is verified once the match settles.',
    analyzedMatches: 'Analyzed Matches',
    accuracy: 'Match Result Accuracy',
    settled: 'Settled Matches',
    leagues: 'League',
    prediction: 'Prediction',
    empty: 'No analyses to show right now.',
  },
  de: {
    title: 'Fußball-KI-Vorhersagen & Analysen',
    desc: 'Spielvorhersagen aus dem Konsens von 4 erstklassigen KI-Modellen. Jede Analyse wird nach Spielende überprüft.',
    analyzedMatches: 'Analysierte Spiele',
    accuracy: 'Spielergebnis-Treffer',
    settled: 'Abgeschlossene Spiele',
    leagues: 'Liga',
    prediction: 'Vorhersage',
    empty: 'Derzeit keine Analysen.',
  },
} as const;

export default function AnalysisIndexClient({
  analyses,
  stats,
}: {
  analyses: PublicAnalysis[];
  stats: AccuracyStats;
}) {
  const { lang } = useLanguage();
  const t = L[lang] || L.en;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-content tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-content-muted">{t.desc}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={`${stats.total}+`} label={t.analyzedMatches} />
          <Stat value={`%${stats.accuracyPct}`} label={t.accuracy} />
          <Stat value={`${stats.settled}`} label={t.settled} />
          <Stat value={`${stats.leagues}`} label={t.leagues} />
        </div>
      </header>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-2">
        {analyses.map((a) => {
          const slug = matchSlug(a.home_team, a.away_team, a.fixture_id);
          const mr = matchResultLabel(a.match_result_prediction, a.home_team, a.away_team);
          return (
            <li key={a.fixture_id}>
              <Link
                href={`/analysis/${slug}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-content">
                    {a.home_team} <span className="text-content-subtle">vs</span> {a.away_team}
                  </div>
                  <div className="truncate text-sm text-content-muted">
                    {a.league ? `${a.league} · ` : ''}
                    {formatMatchDate(a.match_date)} · {t.prediction}: {mr}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.overall_confidence != null && (
                    <span className="rounded-md bg-brand-500/15 px-2 py-1 text-xs font-semibold text-brand-300">
                      %{a.overall_confidence}
                    </span>
                  )}
                  {a.is_settled && (
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold ${
                        a.match_result_correct ? 'bg-positive text-white' : 'bg-negative/80 text-white'
                      }`}
                    >
                      {a.match_result_correct ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {analyses.length === 0 && (
        <p className="rounded-xl border border-line bg-surface-2 p-6 text-center text-content-muted">
          {t.empty}
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
      <div className="text-2xl font-bold text-content">{value}</div>
      <div className="mt-1 text-xs text-content-muted">{label}</div>
    </div>
  );
}
