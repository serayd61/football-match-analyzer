import { phaseForMinutes, type OddsPhase } from './odds-phases';

// Oran cron'unun iş sırası (2026-10-10). Hafta sonu bütçe (40 çağrı/saat) bitiyordu:
// gözlem liglerinin akışta oranı olmayan maçları (Highland League, 3. Divisjon…)
// her tur yeniden deneniyor, kickoff sırası onları öne alıyordu; Real Madrid–Villarreal
// 19:00Z'de hiç oran görmedi. Kural: kapanış > beyaz liste/kapsanan > gözlem; eşitlikte
// en yakın kickoff. Son 4 saatte boş dönen maç bu turda atlanır (`missed`).

export interface OddsJob { fixtureId: number; kickoff: string; phase: OddsPhase; ccode: string; tier: number }

export interface CandidateInput {
  preds: Array<{ fixture_id: number; league_id: number; kickoff: string }>;
  now: Date;
  /** league_id → 0 (beyaz liste / kapsanan), 1 (gözlem), null (oran alınmaz) */
  tierOf: (leagueId: number) => number | null;
  ccodeOf: (leagueId: number) => string;
}

/** Oran alınacak maçlar: maç başına tek kayıt (model sürümleri tekilleşir), o anki faz. */
export function oddsCandidates(input: CandidateInput): OddsJob[] {
  const seen = new Set<number>();
  const out: OddsJob[] = [];
  for (const p of input.preds) {
    const fid = Number(p.fixture_id);
    if (seen.has(fid)) continue; // birden çok model sürümü aynı maçı yazar
    const tier = input.tierOf(Number(p.league_id));
    if (tier == null) continue;
    seen.add(fid);
    const mins = (new Date(p.kickoff).getTime() - input.now.getTime()) / 60000;
    out.push({ fixtureId: fid, kickoff: p.kickoff, phase: phaseForMinutes(mins), ccode: input.ccodeOf(Number(p.league_id)), tier });
  }
  return out;
}

export interface PickInput {
  /** `${fixtureId}:${phase}` zaten yazılmış */
  done: Set<string>;
  /** son turlarda boş dönen fixtureId'ler */
  missed: Set<number>;
  max: number;
}

/** Bu turda çağrılacaklar: kapanış > beyaz liste > gözlem; eşitlikte en yakın kickoff. */
export function pickOddsJobs(candidates: OddsJob[], input: PickInput): OddsJob[] {
  const rank = (j: OddsJob) => (j.phase === 'closing' ? 0 : 1) * 10 + j.tier;
  return candidates
    .filter((c) => !input.done.has(`${c.fixtureId}:${c.phase}`) && !input.missed.has(c.fixtureId))
    .sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff))
    .slice(0, input.max);
}
