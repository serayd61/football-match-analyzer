import 'server-only';
import { dbFresh as db } from './db';
import { listDayFresh } from './fixtures';
import { getPerformance } from './performance';
import { outsideStandingFor } from './outside-standing';
import { dailyStandingBoard, type MarketProbs1x2, type StandingPick } from './daily-standing';
import { latestPhase } from './odds-phases';
import { freezeState } from './showcase-rule';
import { todayYmd, addDays } from './time';
import { groupStandingDays, STANDING_RULE_VERSION, type StoredStandingPick, type StandingDay } from './standing-picks-rule';

// ============================================================================
// "Karneye uyan maçlar" kaydı — hesap + dondurma + gün gün karne (2026-10-10)
// ----------------------------------------------------------------------------
// /picks sayfası canlı hesaplanır; maç başlayınca satır düşer ve "o gün ne
// dedik" kaybolur. Saatlik cron aynı kuralı (dailyStandingBoard, yalnız
// 'strong') D..D+2 penceresine çalıştırır ve site_standing_picks'e yazar;
// başlamaya ≤3 saat kala satır donar (DB tetikleyicisi de korur). Geçmiş
// yalnız dondurulmuş satırlardan okunur: bugünün karne tablolarıyla geriye
// dönük yeniden hesap sızıntılı olurdu. Kazanan–kaybeden birlikte listelenir.
// ============================================================================

const TABLE = 'site_standing_picks';

/** Son görüş (en geç faz) marjsız 1X2 — doğrudan DB, önbelleksiz (vitrinle aynı). */
async function freshMarkets(ids: number[]): Promise<Record<number, MarketProbs1x2>> {
  const out: Record<number, MarketProbs1x2> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db().from('prediction_odds')
      .select('fixture_id, phase, captured_at, p_home_market, p_draw_market, p_away_market')
      .in('fixture_id', ids.slice(i, i + 100))
      .limit(100 * 6); // 6 faz × 100 id, (fixture_id, phase) tekil
    const by = new Map<number, any[]>();
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
    for (const [k, rows] of by) {
      const l = latestPhase(rows);
      if (l && l.p_home_market != null) out[k] = { pHome: Number(l.p_home_market), pDraw: Number(l.p_draw_market), pAway: Number(l.p_away_market) };
    }
  }
  return out;
}

function toRow(p: StandingPick, label: string, frozen: boolean, nowIso: string) {
  const s = p.standing;
  return {
    fixture_id: p.fixtureId, market: p.market, kickoff: p.row.kickoff,
    league_id: p.row.leagueId, league_slug: p.row.league?.slug ?? null, league_label: label, covered: p.row.covered,
    home_name: p.row.homeName, away_name: p.row.awayName, home_crest: p.row.homeCrest, away_crest: p.row.awayCrest,
    selection: p.selection, model_p: p.modelP, market_p: p.marketP, edge: p.edge,
    verdict: p.verdict, acc: s.acc, evidence_n: s.n, evidence_won: s.won, scope: s.scope,
    evidence_kind: s.primary.kind, evidence_bucket: s.primary.bucket,
    rule_version: STANDING_RULE_VERSION, frozen, frozen_at: frozen ? nowIso : null, computed_at: nowIso,
  };
}

export interface ComputeResult {
  window: number; scanned: number; matches: number; written: number; frozenNow: number; skippedFrozen: number; skippedLate: number; removed: number;
  byMarket: Record<string, number>; error: string | null;
  picks: Array<{ fixtureId: number; kickoff: string; league: string; match: string; market: string; selection: string; modelP: number; edge: number | null; acc: number | null; frozen: boolean }>;
}

/** D..D+days-1 penceresini sayfayla aynı kuraldan geçirir; write=false yazmaz (önizleme). */
export async function computeStandingPicks(days = 3, write = true, now = Date.now()): Promise<ComputeResult> {
  const today = todayYmd();
  const nowIso = new Date(now).toISOString();
  const [perf, outside] = await Promise.all([getPerformance(null), outsideStandingFor()]);
  const rows = [];
  for (let d = 0; d < days; d++) {
    const day = await listDayFresh(addDays(today, d));
    rows.push(...day.rows.filter((r) => r.hasModel && !r.settled && r.status === 'scheduled' && (r.covered || outside.eligible(r))));
  }
  const ids = rows.map((r) => r.fixtureId);
  const [markets, frozenRes] = await Promise.all([
    freshMarkets(ids),
    ids.length ? db().from(TABLE).select('fixture_id, market').in('fixture_id', ids).eq('frozen', true) : Promise.resolve({ data: [] as any[] }),
  ]);
  const frozen = new Set(((frozenRes.data ?? []) as any[]).map((r) => `${r.fixture_id}:${r.market}`));
  const board = dailyStandingBoard(rows, markets, perf.signals, undefined, outside.standing);

  const upserts: ReturnType<typeof toRow>[] = [];
  let skipped = 0, late = 0, froze = 0;
  const byMarket: Record<string, number> = {};
  const out: ComputeResult['picks'] = [];
  for (const { market, picks } of board.markets) {
    for (const p of picks) {
      if (frozen.has(`${p.fixtureId}:${market}`)) { skipped++; continue; }
      const state = freezeState(p.row.kickoff, now);
      if (state === 'late') { late++; continue; } // akış 'scheduled' dese de saat geçmişse yazma
      const fz = state === 'freeze';
      if (fz) froze++;
      byMarket[market] = (byMarket[market] ?? 0) + 1;
      upserts.push(toRow(p, outside.label(p.row), fz, nowIso));
      out.push({ fixtureId: p.fixtureId, kickoff: p.row.kickoff, league: outside.label(p.row), match: `${p.row.homeName} – ${p.row.awayName}`, market, selection: p.selection, modelP: p.modelP, edge: p.edge, acc: p.standing.acc, frozen: fz });
    }
  }

  let error: string | null = null;
  let removed = 0;
  if (write && ids.length) {
    // Güçlü olmaktan çıkan (donmamış) eski satırlar düşer; dondurulmuş satıra tetikleyici dokundurmaz.
    const keep = new Set(upserts.map((u) => `${u.fixture_id}:${u.market}`));
    const { data: stale } = await db().from(TABLE).select('fixture_id, market').in('fixture_id', ids).eq('frozen', false);
    const gone = ((stale ?? []) as any[]).filter((r) => !keep.has(`${r.fixture_id}:${r.market}`));
    for (const r of gone) {
      const { error: e } = await db().from(TABLE).delete().eq('fixture_id', r.fixture_id).eq('market', r.market).eq('frozen', false);
      if (!e) removed++;
    }
    if (upserts.length) {
      const { error: e } = await db().from(TABLE).upsert(upserts, { onConflict: 'fixture_id,market' });
      if (e) { error = e.message; console.error('[standing-picks] upsert failed', e.message); }
    }
  }
  return { window: days, scanned: board.scanned, matches: board.matches, written: write ? upserts.length : 0, frozenNow: froze, skippedFrozen: skipped, skippedLate: late, removed, byMarket, error, picks: out };
}

function fromRow(r: any): StoredStandingPick {
  const num = (v: any) => (v == null ? null : Number(v));
  return {
    fixtureId: Number(r.fixture_id), market: r.market, selection: String(r.selection), kickoff: String(r.kickoff),
    leagueLabel: String(r.league_label ?? ''), leagueSlug: r.league_slug ?? null, covered: !!r.covered,
    homeName: String(r.home_name), awayName: String(r.away_name), homeCrest: r.home_crest ?? null, awayCrest: r.away_crest ?? null,
    modelP: Number(r.model_p), marketP: num(r.market_p), edge: num(r.edge), verdict: String(r.verdict), acc: num(r.acc),
    evidenceN: Number(r.evidence_n ?? 0), evidenceWon: Number(r.evidence_won ?? 0), scope: r.scope ?? null,
  };
}

/**
 * Son N günün dondurulmuş seçimleri, skorla sonuçlanmış, gün gün (en yeni önce).
 * Başlamasına 3 saatten az kalan ya da başlamış maçlar girer; skoru gelmemişse
 * `pending`. Tablo yoksa boş döner (migration uygulanmadan sayfa kırılmaz).
 */
export async function standingHistory(days = 14, now = Date.now()): Promise<StandingDay[]> {
  const from = new Date(now - days * 86400_000).toISOString();
  const cutoff = new Date(now - 3 * 3600_000).toISOString();
  const { data, error } = await db().from(TABLE).select('*').eq('frozen', true).gte('kickoff', from).lt('kickoff', cutoff).order('kickoff', { ascending: true }).limit(2000);
  if (error) { console.error('[standing-picks] history read failed', error.message); return []; }
  if (!data?.length) return [];
  const rows = (data as any[]).map(fromRow);
  const ids = [...new Set(rows.map((r) => r.fixtureId))];
  const scores = new Map<number, [number, number]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sc } = await db().from('engine_predictions').select('fixture_id, home_score, away_score')
      .in('fixture_id', ids.slice(i, i + 200)).not('home_score', 'is', null).not('away_score', 'is', null);
    for (const s of (sc ?? []) as any[]) if (!scores.has(Number(s.fixture_id))) scores.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  }
  return groupStandingDays(rows, scores);
}
