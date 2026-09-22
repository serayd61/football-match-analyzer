import 'server-only';
import { db, dbFresh } from './db';
import { listDayFresh } from './fixtures';
import { latestGoalBook } from './goal-book';
import { yesSideP } from './goal-blend';
import { whitelistTiers } from '@/lib/coverage/registry';

import type { SitePrediction } from './predictions';
import { todayYmd, addDays } from './time';
import { selectDailyPicks, settlePick, tallyPicks, RULE_VERSION, TAKE, type PicksTally, type PickMarket, type PickSelection, type PickCandidateInput } from './daily-picks-rule';
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

export interface PicksRecord extends PicksTally {
  days: number;
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
  // goals-1.2: oran varsa piyasa ile harmanlanmış olasılık (goal-blend), yoksa model hamı
  const pBtts = yesSideP(r.btts, 'yes');
  const pOver = yesSideP(r.overUnder, 'over');
  return { fixtureId: r.fixtureId, leagueSlug: r.league?.slug ?? null, kickoff: r.kickoff, pBttsYes: pBtts, pOver25: pOver, bttsYesOdds, over25Odds };
}

/** Kural girdilerini görmek için (cron ?debug=1). */
export async function debugInputs(ymd: string) {
  const all = await freshRows(ymd);
  const rows = all.filter((r) => r.covered && r.hasModel && !r.settled);
  const c = { covered: all.filter((r) => r.covered).length, hasModel: all.filter((r) => r.hasModel).length, coveredModel: all.filter((r) => r.covered && r.hasModel).length, settled: all.filter((r) => r.settled).length, sampleCovered: all.filter((r) => r.covered).slice(0, 3).map((r) => ({ id: r.fixtureId, league: r.league?.slug, hasModel: r.hasModel, settled: r.settled, btts: r.btts, ou: r.overUnder, mv: r.modelVersion })) };
  return { total: all.length, eligible: rows.length, counts: c, inputs: rows.map((r) => toInput(r, null)) };
}

async function generate(ymd: string, now = Date.now(), includeSettled = false): Promise<DailyPick[]> {
  // Simülasyonda (asOf geçmiş) sonuçlanmış satırlar da aday: kural o sabah ne derdi?
  const rows = (await freshRows(ymd)).filter((r) => r.covered && r.hasModel && (includeSettled || !r.settled));
  // 2026-09-14: kitap oranları sütundan (KG akıştan, Üst 2,5 API-Football'dan); raw taranmaz.
  const books = await latestGoalBook(rows.map((r) => r.fixtureId));
  const inputs = rows.map((r) => toInput(r, books.get(r.fixtureId)?.bttsYes ?? null, books.get(r.fixtureId)?.over25 ?? null));
  const picks = selectDailyPicks(inputs, now, TAKE, await whitelistTiers()); // beyaz liste: kapsam sicili
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

/**
 * Yalnız okur, asla üretmez/yazmaz — sayfa render'ı için (denetim 2026-09-18).
 * Eskiden panel ilk okumada seçim üretip yazıyordu: eşzamanlı iki render farklı
 * aday kümesi yazıp günü 3'ten fazla satırla bırakabiliyor, db()'nin 300 sn'lik
 * önbelleği yüzünden cron yazdıktan sonra bile "boş" görüp yeniden üretebiliyordu.
 */
export async function readDailyPicks(ymd = todayYmd()): Promise<DailyPick[]> {
  // İlk yazılan TAKE satır resmî seçimdir (B07 kalanı: iki eşzamanlı üretim farklı aday yazarsa
  // upsert fixture bazında tekilleştirir ama günü sınırlamaz) → deterministik tavan burada.
  const { data, error } = await dbFresh().from(TABLE).select('*').eq('pick_date', ymd).order('created_at').order('fixture_id').limit(TAKE);
  if (error) console.error('[daily-picks] read failed', error.message);
  return (data ?? []).map(fromRow).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/** Üretim yolu (cron / sosyal yayın). Tabloda varsa onları döner; yoksa üretip dondurur. */
export async function getDailyPicks(ymd = todayYmd()): Promise<{ picks: DailyPick[]; generated: boolean }> {
  const existing = await readDailyPicks(ymd);
  if (existing.length) return { picks: existing, generated: false };

  const today = todayYmd();
  if (ymd !== today && ymd !== addDays(today, 1)) return { picks: [], generated: false };

  const picks = await generate(ymd);
  if (!picks.length) return { picks, generated: true };
  const { error: insErr } = await dbFresh().from(TABLE).upsert(
    picks.map((p) => ({ pick_date: p.date, fixture_id: p.fixtureId, market: p.market, selection: p.selection, model_p: p.modelP, odds: p.odds, odds_source: p.oddsSource, league_slug: p.leagueSlug, home_name: p.homeName, away_name: p.awayName, kickoff: p.kickoff, rule_version: p.ruleVersion })),
    { onConflict: 'pick_date,fixture_id', ignoreDuplicates: true },
  );
  if (insErr) console.error('[daily-picks] insert failed', insErr.message);
  // Yalnız kaydedilmiş seçim sunulur: yazılamayan ya da yarışı kaybeden hesap dönmez.
  return { picks: await readDailyPicks(ymd), generated: !insErr };
}

/** Son N günün seçimlerini skorla sonuçlandırır (bugün hariç). */
export async function dailyPicksRecord(days = 30): Promise<PicksRecord> {
  const today = todayYmd();
  const empty: PicksRecord = { days, ...tallyPicks([]) };
  const { data } = await db().from(TABLE).select('*').lt('pick_date', today).gte('pick_date', addDays(today, -days));
  if (!data?.length) return empty;
  const picks = data.map(fromRow);
  const ids = [...new Set(picks.map((p) => p.fixtureId))];
  const { data: scores } = await db().from('engine_predictions').select('fixture_id, home_score, away_score').in('fixture_id', ids).not('home_score', 'is', null).not('away_score', 'is', null);
  const score = new Map<number, [number, number]>();
  for (const s of (scores ?? []) as any[]) if (!score.has(Number(s.fixture_id))) score.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  const settled = picks.flatMap((p) => {
    const sc = score.get(p.fixtureId);
    return sc ? [{ market: p.market, odds: p.odds, oddsSource: p.oddsSource, won: settlePick(p.market, sc[0], sc[1]) }] : [];
  });
  return { days, ...tallyPicks(settled) };
}
