import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { listDay } from './fixtures';
import { loadCoverage } from '@/lib/coverage/registry';
import { resolveOfficialVersion, officialFilter } from './official';
import { zonedStartOfDay, addDays } from './time';
import type { SitePrediction } from './predictions';
import {
  exactScorePick, scoreBucket, scoreLabel, settleScore, addTally, emptyTally,
  SCORE_BUCKETS, type ScoreBucket, type ScoreProb, type Tally,
} from './exact-score';

// ============================================================================
// SKOR TAHMİNLERİ — günün listesi + geçmiş karne (2026-10-14)
// ----------------------------------------------------------------------------
// Günün satırları listDay'den (kapsanan + kapsam dışı, gizli ligler hariç);
// skor exact-score.ts'ten türetilir, DB'ye yazılmaz (λ zaten donmuş kayıt).
// Geçmiş: resmi sürümün skorla sonuçlanmış son N günü, aynı kuralla yeniden
// hesaplanır — λ maç öncesi yazıldığı için sızıntı yok. Dilim (15–18 / 18–20 /
// 20+) ve skor (0-0, 1-0…) karnesi günün satırlarının yanına yazılır.
// ============================================================================

export interface ScoreRow {
  fixtureId: number;
  kickoff: string;
  leagueLabel: string;
  covered: boolean;
  homeName: string; awayName: string;
  homeCrest: string | null; awayCrest: string | null;
  score: ScoreProb;
  bucket: ScoreBucket;
  homeScore: number | null; awayScore: number | null;
  won: boolean | null;
  status: SitePrediction['status'];
}

export interface ScoreHistory {
  days: number;
  all: Tally;
  byBucket: Record<ScoreBucket, Tally>;
  byScore: Array<{ score: string; tally: Tally }>;
  recent: ScoreRow[];
  pending: number;
}

type CovMap = Map<number, { status: string; name: string; ccode: string }>;

async function coverage(): Promise<CovMap> {
  const rows = await loadCoverage().catch(() => []);
  return new Map(rows.map((c) => [Number(c.league_id), { status: c.status, name: c.name, ccode: c.ccode || '' }]));
}

const leagueLabel = (r: { covered: boolean; leagueId: number | null; leagueName: string }, cov: CovMap) => {
  const c = !r.covered && r.leagueId != null ? cov.get(r.leagueId) : undefined;
  return c?.ccode ? `${c.ccode} · ${c.name || r.leagueName}` : r.leagueName;
};

function toRow(r: SitePrediction, cov: CovMap): ScoreRow | null {
  if (!r.hasModel) return null;
  if (r.leagueId != null && cov.get(r.leagueId)?.status === 'hidden') return null;
  const score = exactScorePick(r.lambdaHome, r.lambdaAway);
  if (!score) return null;
  return {
    fixtureId: r.fixtureId, kickoff: r.kickoff, leagueLabel: leagueLabel(r, cov), covered: r.covered,
    homeName: r.homeName, awayName: r.awayName, homeCrest: r.homeCrest, awayCrest: r.awayCrest,
    score, bucket: scoreBucket(score.p), homeScore: r.homeScore, awayScore: r.awayScore,
    won: settleScore(score, r.homeScore, r.awayScore), status: r.status,
  };
}

/** Günün skor tahminleri (≥%15), olasılığa göre azalan. */
export async function listScoreDay(ymd: string): Promise<{ rows: ScoreRow[]; scanned: number }> {
  const [day, cov] = await Promise.all([listDay(ymd), coverage()]);
  const rows = day.rows.map((r) => toRow(r, cov)).filter((x): x is ScoreRow => x != null).sort((a, b) => b.score.p - a.score.p || a.kickoff.localeCompare(b.kickoff));
  return { rows, scanned: day.rows.filter((r) => r.hasModel).length };
}

const crest = (id: number | null) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null);

/** Son `days` günün skorla sonuçlanmış skor tahminleri (resmi sürüm, gizli ligler hariç). */
export const scoreHistory = unstable_cache(
  async (days: number, today: string): Promise<ScoreHistory> => {
    const [official, cov] = await Promise.all([resolveOfficialVersion(), coverage()]);
    const from = zonedStartOfDay(addDays(today, -days)).toISOString();
    const to = zonedStartOfDay(addDays(today, 1)).toISOString();
    const rows: any[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await officialFilter(
        db().from('engine_predictions').select('fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, lambda_home, lambda_away, home_score, away_score, settled'),
        official,
      ).gte('kickoff', from).lt('kickoff', to).not('lambda_home', 'is', null).order('kickoff', { ascending: false }).range(off, off + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const all = emptyTally();
    const byBucket = Object.fromEntries(SCORE_BUCKETS.map((b) => [b, emptyTally()])) as Record<ScoreBucket, Tally>;
    const byScore = new Map<string, Tally>();
    const recent: ScoreRow[] = [];
    let pending = 0;
    for (const r of rows) {
      const lid = r.league_id == null ? null : Number(r.league_id);
      if (lid != null && cov.get(lid)?.status === 'hidden') continue;
      const score = exactScorePick(r.lambda_home, r.lambda_away);
      if (!score) continue;
      const hs = r.home_score == null ? null : Number(r.home_score), as = r.away_score == null ? null : Number(r.away_score);
      const won = settleScore(score, hs, as);
      if (won == null) { if (!r.settled) pending++; continue; }
      addTally(all, won, score.p);
      addTally(byBucket[scoreBucket(score.p)], won, score.p);
      const key = scoreLabel(score);
      addTally(byScore.get(key) ?? byScore.set(key, emptyTally()).get(key)!, won, score.p);
      if (recent.length < 60) {
        const covered = false; // etiket için yeterli: kapsanan ligler de kataloğa göre adlandırılır
        recent.push({
          fixtureId: Number(r.fixture_id), kickoff: r.kickoff, leagueLabel: leagueLabel({ covered, leagueId: lid, leagueName: r.league_name || '' }, cov), covered,
          homeName: r.home_name, awayName: r.away_name, homeCrest: crest(r.home_id == null ? null : Number(r.home_id)), awayCrest: crest(r.away_id == null ? null : Number(r.away_id)),
          score, bucket: scoreBucket(score.p), homeScore: hs, awayScore: as, won, status: 'finished',
        });
      }
    }
    return {
      days, all, byBucket,
      byScore: [...byScore.entries()].map(([score, tally]) => ({ score, tally })).sort((a, b) => b.tally.n - a.tally.n).slice(0, 8),
      recent, pending,
    };
  },
  ['site-score-history-v1'],
  { revalidate: REVALIDATE.results },
);
