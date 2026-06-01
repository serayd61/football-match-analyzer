// ============================================================================
// SEO helpers — public site URL, match slugs, public analysis data access
// ============================================================================
import { getSupabaseAdmin } from '@/lib/supabase';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://footballanalytics.pro'
).replace(/\/$/, '');

/** URL-safe slug: lowercases, strips diacritics, collapses to hyphens. */
export function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .replace(/ø/gi, 'o') // ø has no NFD decomposition
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** e.g. "galatasaray-vs-fenerbahce-19705532" */
export function matchSlug(homeTeam: string, awayTeam: string, fixtureId: number | string): string {
  const base = `${slugify(homeTeam)}-vs-${slugify(awayTeam)}`;
  return `${base}-${fixtureId}`;
}

/** Pulls the trailing fixture id off a slug; null if absent. */
export function parseFixtureId(slug: string): number | null {
  const m = String(slug).match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

export interface PublicAnalysis {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string | null;
  match_date: string | null;
  match_result_prediction: string | null;
  over_under_prediction: string | null;
  btts_prediction: string | null;
  overall_confidence: number | null;
  match_result_confidence: number | null;
  over_under_confidence: number | null;
  btts_confidence: number | null;
  agreement: number | null;
  risk_level: string | null;
  best_bet_market: string | null;
  best_bet_selection: string | null;
  best_bet_confidence: number | null;
  models_used: string[] | null;
  systems_used: string[] | null;
  is_settled: boolean | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  actual_match_result: string | null;
  match_result_correct: boolean | null;
  over_under_correct: boolean | null;
  btts_correct: boolean | null;
  updated_at: string | null;
}

const PUBLIC_COLUMNS =
  'fixture_id,home_team,away_team,league,match_date,match_result_prediction,over_under_prediction,btts_prediction,overall_confidence,match_result_confidence,over_under_confidence,btts_confidence,agreement,risk_level,best_bet_market,best_bet_selection,best_bet_confidence,models_used,systems_used,is_settled,actual_home_score,actual_away_score,actual_match_result,match_result_correct,over_under_correct,btts_correct,updated_at';

export async function getPublicAnalysis(fixtureId: number): Promise<PublicAnalysis | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('unified_analysis')
    .select(PUBLIC_COLUMNS)
    .eq('fixture_id', fixtureId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as PublicAnalysis;
}

export async function getRecentAnalyses(limit = 60): Promise<PublicAnalysis[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('unified_analysis')
    .select(PUBLIC_COLUMNS)
    .order('match_date', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as PublicAnalysis[];
}

/** All fixture ids + dates for the sitemap. */
export async function getAllAnalysisRefs(): Promise<
  { fixture_id: number; home_team: string; away_team: string; match_date: string | null; updated_at: string | null }[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('unified_analysis')
    .select('fixture_id,home_team,away_team,match_date,updated_at')
    .order('match_date', { ascending: false })
    .limit(5000);
  if (error || !data) return [];
  return data as any;
}

export interface AccuracyStats {
  total: number;
  settled: number;
  matchResultCorrect: number;
  accuracyPct: number; // match-result accuracy over judged matches
  leagues: number;
}

export async function getAccuracyStats(): Promise<AccuracyStats> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('unified_analysis')
    .select('is_settled,match_result_correct,league')
    .limit(5000);
  const rows = data || [];
  const total = rows.length;
  const settled = rows.filter((r: any) => r.is_settled).length;
  const judged = rows.filter((r: any) => r.is_settled && r.match_result_correct !== null);
  const correct = judged.filter((r: any) => r.match_result_correct).length;
  const leagues = new Set(rows.map((r: any) => r.league).filter(Boolean)).size;
  return {
    total,
    settled,
    matchResultCorrect: correct,
    accuracyPct: judged.length ? Math.round((correct / judged.length) * 100) : 0,
    leagues,
  };
}

// ---- Human-readable prediction labels (Turkish primary) -------------------

export function matchResultLabel(pred: string | null, home: string, away: string): string {
  switch ((pred || '').toLowerCase()) {
    case 'home':
    case '1':
      return `${home} Kazanır`;
    case 'away':
    case '2':
      return `${away} Kazanır`;
    case 'draw':
    case 'x':
      return 'Beraberlik';
    default:
      return pred || '—';
  }
}

export function overUnderLabel(pred: string | null): string {
  const p = (pred || '').toLowerCase();
  if (p === 'over') return '2.5 Üst';
  if (p === 'under') return '2.5 Alt';
  return pred || '—';
}

export function bttsLabel(pred: string | null): string {
  const p = (pred || '').toLowerCase();
  if (p === 'yes') return 'Karşılıklı Gol: Var';
  if (p === 'no') return 'Karşılıklı Gol: Yok';
  return pred || '—';
}

export function formatMatchDate(date: string | null): string {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return '';
  }
}
