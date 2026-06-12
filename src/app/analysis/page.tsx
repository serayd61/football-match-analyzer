import type { Metadata } from 'next';
import Link from 'next/link';
import {
  SITE_URL,
  matchSlug,
  getRecentAnalyses,
  getAccuracyStats,
  matchResultLabel,
  formatMatchDate,
} from '@/lib/seo';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Futbol AI Tahminleri & Maç Analizleri',
  description:
    'Yapay zeka destekli güncel futbol maç tahminleri ve analizleri. 25+ lig, çoklu AI konsensüs, doğrulanmış başarı geçmişi.',
  alternates: { canonical: `${SITE_URL}/analysis` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/analysis`,
    title: 'Futbol AI Tahminleri & Maç Analizleri',
    description: 'Yapay zeka destekli güncel futbol maç tahminleri ve analizleri.',
    siteName: 'Football Analytics Pro',
  },
};

export default async function AnalysisIndexPage() {
  const [analyses, stats] = await Promise.all([getRecentAnalyses(60), getAccuracyStats()]);

  return (
    <div className="fa-shell min-h-screen">
      <main className="px-4 py-10">
        <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-content tracking-tight sm:text-4xl">Futbol AI Tahminleri &amp; Analizleri</h1>
          <p className="mt-2 text-content-muted">
            4 elite AI modelinin konsensüsüyle üretilen maç tahminleri. Her analiz, sonuçlandıktan sonra
            doğrulanır.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={`${stats.total}+`} label="Analiz Edilen Maç" />
            <Stat value={`%${stats.accuracyPct}`} label="Maç Sonucu İsabeti" />
            <Stat value={`${stats.settled}`} label="Sonuçlanan Maç" />
            <Stat value={`${stats.leagues}`} label="Lig" />
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
                      {formatMatchDate(a.match_date)} · Tahmin: {mr}
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
            Şu anda gösterilecek analiz yok.
          </p>
        )}
        </div>
      </main>
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
