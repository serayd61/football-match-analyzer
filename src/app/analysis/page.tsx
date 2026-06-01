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
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Futbol AI Tahminleri &amp; Analizleri</h1>
          <p className="mt-2 text-gray-400">
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

        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {analyses.map((a) => {
            const slug = matchSlug(a.home_team, a.away_team, a.fixture_id);
            const mr = matchResultLabel(a.match_result_prediction, a.home_team, a.away_team);
            return (
              <li key={a.fixture_id}>
                <Link
                  href={`/analysis/${slug}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {a.home_team} <span className="text-gray-500">vs</span> {a.away_team}
                    </div>
                    <div className="truncate text-sm text-gray-400">
                      {a.league ? `${a.league} · ` : ''}
                      {formatMatchDate(a.match_date)} · Tahmin: {mr}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.overall_confidence != null && (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400">
                        %{a.overall_confidence}
                      </span>
                    )}
                    {a.is_settled && (
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${
                          a.match_result_correct ? 'bg-emerald-500 text-white' : 'bg-rose-500/80 text-white'
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
          <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
            Şu anda gösterilecek analiz yok.
          </p>
        )}
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  );
}
