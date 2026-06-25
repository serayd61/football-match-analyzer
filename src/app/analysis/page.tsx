import type { Metadata } from 'next';
import {
  SITE_URL,
  getRecentAnalyses,
  getAccuracyStats,
} from '@/lib/seo';
import AnalysisIndexClient from './AnalysisIndexClient';

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
        <AnalysisIndexClient analyses={analyses} stats={stats} />
      </main>
    </div>
  );
}
