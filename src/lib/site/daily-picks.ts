import 'server-only';
import { db } from './db';
import { listDayFresh } from './fixtures';

import type { SitePrediction } from './predictions';
import { todayYmd, addDays } from './time';
import { selectDailyPicks, settlePick, RULE_VERSION, type PickMarket, type PickSelection, type PickCandidateInput } from './daily-picks-rule';
/** Cron/preview yolu: sayfa önbelleğini atlayıp DB'den okur (ingest sonrası bayat 'hasModel=0' görülmesin). */
const freshRows = async (ymd: string) => (await listDayFresh(ymd)).rows;

// Günün 3 seçimi — üretim + okuma + karne. Kural daily-picks-rule.ts'te.
// Seçimler günde bir kez site_daily_picks'e dondurulur (cron 06:15 UTC ya da
// ilk panel açılışı); sonraki okumalar tabloyu döner. Böylece karne, sabah
// söylediğimizle ölçülür.

export interface DailyPick {
  date: string;
  fixtureId: number;
  market: PickMarket;
  selection: PickSelection;
  modelP: number;
  odds: number;
  oddsSource: 'book' | 'fair';
  leagueSlug: string;
  homeName: string;
  awayName: string;
  kickoff: string;
  ruleVersion: string;
}

export interface PicksRecord {
  days: number;
  n: number;
  won: number;
  /** sabit 1 birim, seçimdeki oranla (adil oranlı ayaklar dahil) */
  roi: number | null;
  byMarket: Record<PickMarket, { n: number; won: number }>;
}

const TABLE = 'site_daily_picks';

function fromRow(r: any): DailyPick {
  return {
    date: String(r.pick_date), fixtureId: Number(r.fixture_id), market: r.market, selection: r.selection,
    modelP: Number(r.model_p), odds: Number(r.odds), oddsSource: r.odds_source, leagueSlug: r.league_slug,
    homeName: r.home_name, awayName: r.away_name, kickoff: r.kickoff, ruleVersion: r.rule_version,
  };
}

/** SitePrediction → kural girdisi (olasılıklar seçilen tarafa değil, "var"/"üst" tarafına çevrilir). */
function toInput(r: SitePrediction, bttsYesOdds: number | null, over25Odds: number | null = null): PickCandidateInput {
  const pBtts = r.btts ? (r.btts.pick === 'yes' ? r.btts.pRaw : 1 - r.btts.pRaw) : null;
  const pOver = r.overUnder ? (r.overUnder.pick === 'over' ? r.overUnder.pRaw : 1 - r.overUnder.pRaw) : null;
  return { fixtureId: r.fixtureId, leagueSlug: r.league?.slug ?? null, kickoff: r.kickoff, pBttsYes: pBtts, pOver25: pOver, bttsYesOdds, over25Odds };
}

/** Kural girdilerini görmek için (cron ?debug=1). */
export async function debugInputs(ymd: string) {
  const all = await freshRows(ymd);
  const rows = all.filter((r) => r.covered && r.hasModel && !r.settled);
  const c = { covered: all.filter((r) => r.covered).length, hasModel: all.filter((r) => r.hasModel).length, coveredModel: all.filter((r) => r.covered && r.hasModel).length, settled: all.filter((r) => r.settled).length, sampleCovered: all.filter((r) => r.covered).slice(0, 3).map((r) => ({ id: r.fixtureId, league: r.league?.slug, hasModel: r.hasModel, settled: r.settled, btts: r.btts, ou: r.overUnder, mv: r.modelVersion })) };
  return { total: all.length, eligible: rows.length, counts: c, inputs: rows.map((r) => toInput(r, null)) };
}

/** Son görüş (en geç faz) KG Var ve Üst 2,5 kitap oranları — prediction_odds sütunlarından, tek sorgu. */
async function latestBookOdds(ids: number[]): Promise<Map<number, { btts: number | null; over: number | null }>> {
  const out = new Map<number, { btts: number | null; over: number | null }>();
  const rank: Record<string, number> = { opening: 0, h24: 1, h12: 2, h6: 3, h3: 4, closing: 5 };
  const best = new Map<number, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from('prediction_odds').select('fixture_id, phase, btts_yes_odds, over25_odds').in('fixture_id', ids.slice(i, i + 200));
    if (error) { // over25_odds sütunu henüz yoksa KG ile devam
      const { data: d2 } = await db().from('prediction_odds').select('fixture_id, phase, btts_yes_odds').in('fixture_id', ids.slice(i, i + 200));
      for (const r of (d2 ?? []) as any[]) { const k = Number(r.fixture_id); const rk = rank[r.phase] ?? -1; if (rk >= (best.get(k) ?? -1)) { best.set(k, rk); out.set(k, { btts: r.btts_yes_odds > 1 ? Number(r.btts_yes_odds) : null, over: null }); } }
      continue;
    }
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); const rk = rank[r.phase] ?? -1; if (rk >= (best.get(k) ?? -1)) { best.set(k, rk); out.set(k, { btts: r.btts_yes_odds > 1 ? Number(r.btts_yes_odds) : null, over: r.over25_odds > 1 ? Number(r.over25_odds) : null }); } }
  }
  return out;
}

async function generate(ymd: string, now = Date.now(), includeSettled = false): Promise<DailyPick[]> {
  // Simülasyonda (asOf geçmiş) sonuçlanmış satırlar da aday: kural o sabah ne derdi?
  const rows = (await freshRows(ymd)).filter((r) => r.covered && r.hasModel && (includeSettled || !r.settled));
  // 2026-09-14: kitap oranları sütundan (KG akıştan, Üst 2,5 API-Football'dan); raw taranmaz.
  const books = await latestBookOdds(rows.map((r) => r.fixtureId));
  const inputs = rows.map((r) => toInput(r, books.get(r.fixtureId)?.btts ?? null, books.get(r.fixtureId)?.over ?? null));
  const picks = selectDailyPicks(inputs, now);
  const byId = new Map(rows.map((r) => [r.fixtureId, r]));
  return picks.map((p) => {
    const r = byId.get(p.fixtureId)!;
    return { date: ymd, fixtureId: p.fixtureId, market: p.market, selection: p.selection, modelP: p.modelP, odds: p.odds, oddsSource: p.oddsSource, leagueSlug: p.leagueSlug, homeName: r.homeName, awayName: r.awayName, kickoff: r.kickoff, ruleVersion: RULE_VERSION };
  });
}

/**
 * Günün seçimleri. Tabloda varsa onları döner; yoksa üretip dondurur.
 * Yalnız bugün/yarın için üretir (geçmiş gün için sadece okur).
 */
export async function previewDailyPicks(ymd: string, asOf?: number): Promise<DailyPick[]> {
  return generate(ymd, asOf ?? Date.now(), asOf != null);
}

export async function getDailyPicks(ymd = todayYmd()): Promise<{ picks: DailyPick[]; generated: boolean }> {
  const { data, error } = await db().from(TABLE).select('*').eq('pick_date', ymd).order('kickoff');
  // Tablo henüz yoksa (migration bekliyor) panel boş kalmasın: üret, kaydetme.
  if (error) console.error('[daily-picks] read failed', error.message);
  if (data?.length) return { picks: data.map(fromRow), generated: false };

  const today = todayYmd();
  if (ymd !== today && ymd !== addDays(today, 1)) return { picks: [], generated: false };

  const picks = await generate(ymd);
  if (!picks.length) return { picks, generated: true };
  const { error: insErr } = await db().from(TABLE).upsert(
    picks.map((p) => ({ pick_date: p.date, fixture_id: p.fixtureId, market: p.market, selection: p.selection, model_p: p.modelP, odds: p.odds, odds_source: p.oddsSource, league_slug: p.leagueSlug, home_name: p.homeName, away_name: p.awayName, kickoff: p.kickoff, rule_version: p.ruleVersion })),
    { onConflict: 'pick_date,fixture_id', ignoreDuplicates: true },
  );
  if (insErr) console.error('[daily-picks] insert failed', insErr.message);
  return { picks, generated: true };
}

/** Son N günün seçimlerini skorla sonuçlandırır (bugün hariç). */
export async function dailyPicksRecord(days = 30): Promise<PicksRecord> {
  const today = todayYmd();
  const empty: PicksRecord = { days, n: 0, won: 0, roi: null, byMarket: { btts: { n: 0, won: 0 }, ou25: { n: 0, won: 0 } } };
  const { data } = await db().from(TABLE).select('*').lt('pick_date', today).gte('pick_date', addDays(today, -days));
  if (!data?.length) return empty;
  const picks = data.map(fromRow);
  const ids = [...new Set(picks.map((p) => p.fixtureId))];
  const { data: scores } = await db().from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids).not('home_score', 'is', null).not('away_score', 'is', null);
  const score = new Map<number, [number, number]>();
  for (const s of (scores ?? []) as any[]) if (!score.has(Number(s.fixture_id))) score.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  let staked = 0, returned = 0;
  const rec = { ...empty, byMarket: { btts: { n: 0, won: 0 }, ou25: { n: 0, won: 0 } } };
  for (const p of picks) {
    const sc = score.get(p.fixtureId);
    if (!sc) continue;
    const won = settlePick(p.market, sc[0], sc[1]);
    rec.n++; rec.byMarket[p.market].n++;
    if (won) { rec.won++; rec.byMarket[p.market].won++; returned += p.odds; }
    staked += 1;
  }
  rec.roi = staked ? (returned - staked) / staked : null;
  return rec;
}
