import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SITE_URL,
  matchSlug,
  parseFixtureId,
  getPublicAnalysis,
  matchResultLabel,
  overUnderLabel,
  bttsLabel,
  formatMatchDate,
  type PublicAnalysis,
} from '@/lib/seo';
import ShareButtons from './ShareButtons';
import MountEvent from '@/components/analytics/MountEvent';
import TrackedLink from '@/components/analytics/TrackedLink';

// On-demand ISR: pages render on first request, cached & revalidated hourly.
export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: { slug: string } };

async function load(slug: string): Promise<PublicAnalysis | null> {
  const fixtureId = parseFixtureId(slug);
  if (!fixtureId) return null;
  return getPublicAnalysis(fixtureId);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const a = await load(params.slug);
  if (!a) {
    return { title: 'Analiz bulunamadı' };
  }
  const canonical = `${SITE_URL}/analysis/${matchSlug(a.home_team, a.away_team, a.fixture_id)}`;
  const mr = matchResultLabel(a.match_result_prediction, a.home_team, a.away_team);
  const dateStr = formatMatchDate(a.match_date);
  const title = `${a.home_team} - ${a.away_team} AI Tahmini & Analizi${dateStr ? ` (${dateStr})` : ''}`;
  const desc =
    `${a.home_team} vs ${a.away_team} maçı için yapay zeka tahmini: ${mr}` +
    (a.overall_confidence ? ` (%${a.overall_confidence} güven)` : '') +
    (a.best_bet_selection ? `. En sağlam bahis: ${a.best_bet_selection}` : '') +
    (a.league ? `. ${a.league}.` : '.');

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description: desc,
      siteName: 'Football Analytics Pro',
    },
    twitter: { card: 'summary_large_image', title, description: desc },
  };
}

function Pred({ label, value, confidence }: { label: string; value: string; confidence?: number | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="text-xs uppercase tracking-wide text-content-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-content">{value}</div>
      {confidence != null && (
        <div className="mt-1 text-sm text-brand-400">%{confidence} güven</div>
      )}
    </div>
  );
}

function settledResult(a: PublicAnalysis) {
  if (!a.is_settled) return null;
  const score =
    a.actual_home_score != null && a.actual_away_score != null
      ? `${a.actual_home_score} - ${a.actual_away_score}`
      : null;
  const actual = matchResultLabel(a.actual_match_result, a.home_team, a.away_team);
  return { score, actual, correct: a.match_result_correct };
}

export default async function AnalysisPage({ params }: Params) {
  const a = await load(params.slug);
  if (!a) notFound();

  const canonical = `${SITE_URL}/analysis/${matchSlug(a.home_team, a.away_team, a.fixture_id)}`;
  const dateStr = formatMatchDate(a.match_date);
  const mr = matchResultLabel(a.match_result_prediction, a.home_team, a.away_team);
  const result = settledResult(a);
  const pageTitle = `${a.home_team} - ${a.away_team} AI Tahmini`;

  // Structured data: SportsEvent + the prediction as an analysis snippet.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${a.home_team} vs ${a.away_team}`,
    sport: 'Soccer',
    ...(a.match_date ? { startDate: a.match_date } : {}),
    homeTeam: { '@type': 'SportsTeam', name: a.home_team },
    awayTeam: { '@type': 'SportsTeam', name: a.away_team },
    ...(a.league ? { superEvent: { '@type': 'SportsOrganization', name: a.league } } : {}),
    url: canonical,
    description: `${a.home_team} vs ${a.away_team} yapay zeka maç tahmini ve analizi.`,
  };

  return (
    <div className="fa-shell min-h-screen">
      <main className="px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MountEvent name="view_analysis" params={{ fixture_id: String(a.fixture_id) }} />
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 text-sm text-content-muted">
          <Link href="/analysis" className="hover:text-content">
            ← Tüm Analizler
          </Link>
        </nav>

        <header className="mb-8">
          {a.league && (
            <div className="mb-2 text-sm font-medium text-brand-400">{a.league}</div>
          )}
          <h1 className="text-3xl font-semibold text-content tracking-tight sm:text-4xl">
            {a.home_team} <span className="text-content-subtle">vs</span> {a.away_team}
          </h1>
          <p className="mt-2 text-content-muted">
            {dateStr && <span>{dateStr} · </span>}
            Yapay Zeka Maç Tahmini &amp; Analizi
          </p>
        </header>

        {/* Verified result banner (great for trust & SEO) */}
        {result && (
          <div
            className={`mb-6 rounded-xl border p-4 ${
              result.correct
                ? 'border-positive/40 bg-positive/10'
                : 'border-negative/40 bg-negative/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-content-muted">Maç Sonuçlandı</div>
                <div className="text-lg font-semibold text-content">
                  {result.score ? `Skor: ${result.score}` : result.actual}
                </div>
              </div>
              <div
                className={`rounded-lg px-3 py-1 text-sm font-bold ${
                  result.correct ? 'bg-positive text-white' : 'bg-negative text-white'
                }`}
              >
                {result.correct ? '✓ Tahmin Tuttu' : '✗ Tutmadı'}
              </div>
            </div>
          </div>
        )}

        {/* Headline prediction */}
        <section className="mb-6 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
          <div className="text-xs uppercase tracking-wide text-brand-400">AI Konsensüs Tahmini</div>
          <div className="mt-1 text-2xl font-bold text-content">{mr}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-content-muted">
            {a.overall_confidence != null && <span>Genel güven: <b className="text-content">%{a.overall_confidence}</b></span>}
            {a.agreement != null && <span>Model uzlaşısı: <b className="text-content">%{a.agreement}</b></span>}
            {a.risk_level && <span>Risk: <b className="text-content capitalize">{a.risk_level}</b></span>}
          </div>
        </section>

        {/* Best bet */}
        {a.best_bet_selection && (
          <section className="mb-6 rounded-xl border border-caution/30 bg-caution/5 p-5">
            <div className="text-xs uppercase tracking-wide text-caution">🔥 En Sağlam Bahis</div>
            <div className="mt-1 text-xl font-bold text-content">{a.best_bet_selection}</div>
            <div className="mt-1 text-sm text-content-muted">
              {a.best_bet_market}
              {a.best_bet_confidence != null && <> · <b className="text-caution">%{a.best_bet_confidence} güven</b></>}
            </div>
          </section>
        )}

        {/* Market predictions grid */}
        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Pred label="Maç Sonucu" value={mr} confidence={a.match_result_confidence} />
          <Pred label="Alt / Üst" value={overUnderLabel(a.over_under_prediction)} confidence={a.over_under_confidence} />
          <Pred label="Karşılıklı Gol" value={bttsLabel(a.btts_prediction)} confidence={a.btts_confidence} />
        </section>

        {(a.models_used?.length || a.systems_used?.length) && (
          <p className="mb-8 text-sm text-content-subtle">
            Analiz motorları:{' '}
            {(a.models_used && a.models_used.length ? a.models_used : a.systems_used || []).join(', ')}
          </p>
        )}

        <div className="mb-8">
          <ShareButtons url={canonical} title={pageTitle} />
        </div>

        {/* Conversion CTA */}
        <section className="rounded-xl border border-line bg-gradient-to-r from-brand-600/20 to-sky-600/20 p-6 text-center">
          <h2 className="text-xl font-bold text-content">Her maç için canlı AI analizi ister misin?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-content-muted">
            4 elite AI modeli + uzman agent&apos;lar her maçı senin için analiz etsin. İlk 7 gün ücretsiz.
          </p>
          <TrackedLink
            href="/login"
            event="cta_click"
            params={{ location: 'analysis_page', fixture_id: String(a.fixture_id) }}
            className="fa-btn fa-btn-primary fa-btn-lg mt-4 inline-flex"
          >
            Ücretsiz Başla →
          </TrackedLink>
        </section>

        <p className="mt-8 text-center text-xs text-content-subtle">
          Bu analiz yapay zeka tarafından üretilmiştir ve yatırım/bahis tavsiyesi değildir. 18+
        </p>
      </div>
      </main>
    </div>
  );
}
