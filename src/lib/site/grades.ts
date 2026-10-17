import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, dbFresh } from './db';
import { resolveOfficialVersion, officialFilter } from './official';
import { coveredLeagueIds } from './results';
import { latestPhase } from './odds-phases';
import { SNAPSHOT_TABLE } from './assessment-snapshot-rule';
import { isoWeekLabel, previousIsoWeek, type IsoWeek } from '@/lib/engine/scoring';
import { gradeMatch, weekLessons, toGradeRow, fromGradeRow, preKickoffMarket, GRADE_TABLE, GRADE_RULE_VERSION, type GradeInput, type GradeStatusSnapshot, type MatchGrade, type WeekLessons, type GradeRow } from './grade-rule';

// ============================================================================
// DERECE KARTI — yazma + okuma (grade-1.0, 2026-10-16). Kural grade-rule.ts'te.
// Saatlik cron (:50, settle-engine :20'den sonra): son N günde sonuçlanmış resmî
// satırlar → henüz kartı olmayanlar derecelenir → site_match_grades'e bir kez
// yazılır (ignoreDuplicates). Pazartesi: önceki ISO haftanın dersleri →
// engine_learning_log (layer 'review', subject 'grade-1.0/<hafta>'), bir kez.
// Piyasa: yalnız kickoff ÖNCESİ yakalanmış satırlar. Durum: yalnız gölge kayıt.
// Tablo yoksa hata döner; başka hiçbir cron işi etkilenmez.
// ============================================================================

const ROW_COLS = 'fixture_id, league_id, home_name, away_name, kickoff, model_version, p_home, p_draw, p_away, p_over25, p_btts_yes, pick, ou_pick, btts_pick, home_score, away_score, settled_at';
const CHUNK = 200;
export const LESSON_ACTOR = 'cron:match-grades';
const lessonSubject = (w: IsoWeek) => `${GRADE_RULE_VERSION}/${isoWeekLabel(w)}`;

export interface GradeRunResult {
  days: number;
  candidates: number;
  alreadyGraded: number;
  attempted: number;
  inserted: number;
  withMarket: number;
  withStatus: number;
  ruleVersion: string;
  error: string | null;
}

async function preKickoffMarkets(ids: number[], kickoffOf: Map<number, string>) {
  const out = new Map<number, GradeInput['market']>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await dbFresh().from('prediction_odds')
      .select('fixture_id, phase, provider, captured_at, p_home_market, p_draw_market, p_away_market')
      .in('fixture_id', ids.slice(i, i + 100)).limit(100 * 8);
    const by = new Map<number, any[]>();
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push({ ...r, capturedAt: String(r.captured_at) }); }
    for (const [k, rows] of by) {
      const ko = kickoffOf.get(k); if (!ko) continue;
      const l = preKickoffMarket(rows.filter((r) => r.p_home_market != null), ko, (rs) => latestPhase(rs));
      if (!l) continue;
      out.set(k, { pHome: Number(l.p_home_market), pDraw: Number(l.p_draw_market), pAway: Number(l.p_away_market), phase: l.phase ?? null, capturedAt: l.capturedAt, provider: l.provider ?? null });
    }
  }
  return out;
}

async function statusSnapshots(ids: number[]): Promise<Map<number, GradeStatusSnapshot[]>> {
  const out = new Map<number, GradeStatusSnapshot[]>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await dbFresh().from(SNAPSHOT_TABLE).select('fixture_id, market, selection, status, reasons, rule_version, assessed_at').in('fixture_id', ids.slice(i, i + CHUNK));
    if (error) { console.error('[grades] snapshot read failed (table missing?)', error.message); return out; }
    for (const r of (data ?? []) as any[]) {
      const k = Number(r.fixture_id);
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push({ market: r.market, selection: String(r.selection), status: r.status, reasons: (r.reasons ?? []) as string[], ruleVersion: String(r.rule_version), assessedAt: String(r.assessed_at) });
    }
  }
  return out;
}

/** Son `days` günde sonuçlanmış (kickoff ≥ 3 sa geçmiş) resmî satırları dereceler; write=false yalnız sayar. */
export async function recordMatchGrades(days = 14, write = true, now = Date.now()): Promise<GradeRunResult> {
  const base = { days, ruleVersion: GRADE_RULE_VERSION };
  const from = new Date(now - days * 86_400_000).toISOString();
  const cutoff = new Date(now - 3 * 3_600_000).toISOString();
  const official = await resolveOfficialVersion();
  const { data, error } = await officialFilter(dbFresh().from('engine_predictions').select(ROW_COLS)
    .eq('settled', true).not('home_score', 'is', null).not('away_score', 'is', null)
    .gte('kickoff', from).lt('kickoff', cutoff), official).order('kickoff', { ascending: true }).limit(5000);
  if (error) return { ...base, candidates: 0, alreadyGraded: 0, attempted: 0, inserted: 0, withMarket: 0, withStatus: 0, error: error.message };
  const rows = ((data ?? []) as any[]).filter((r) => r.pick || r.ou_pick || r.btts_pick);
  const ids = [...new Set(rows.map((r) => Number(r.fixture_id)))];
  if (!ids.length) return { ...base, candidates: 0, alreadyGraded: 0, attempted: 0, inserted: 0, withMarket: 0, withStatus: 0, error: null };

  const done = new Set<number>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data: g, error: ge } = await dbFresh().from(GRADE_TABLE).select('fixture_id').eq('rule_version', GRADE_RULE_VERSION).in('fixture_id', ids.slice(i, i + CHUNK));
    if (ge) return { ...base, candidates: ids.length, alreadyGraded: 0, attempted: 0, inserted: 0, withMarket: 0, withStatus: 0, error: ge.message };
    for (const r of (g ?? []) as any[]) done.add(Number(r.fixture_id));
  }
  const todo = rows.filter((r) => !done.has(Number(r.fixture_id)));
  const todoIds = [...new Set(todo.map((r) => Number(r.fixture_id)))];
  const kickoffOf = new Map(todo.map((r) => [Number(r.fixture_id), String(r.kickoff)] as const));
  const [markets, statuses, idMap] = await Promise.all([preKickoffMarkets(todoIds, kickoffOf), statusSnapshots(todoIds), coveredLeagueIds().catch(() => ({} as Record<string, number[]>))]);
  const slugOf = new Map<number, string>();
  for (const [slug, lids] of Object.entries(idMap)) for (const id of lids) slugOf.set(id, slug);

  const grades: MatchGrade[] = [];
  const seen = new Set<number>();
  let withMarket = 0, withStatus = 0;
  for (const r of todo) {
    const fid = Number(r.fixture_id);
    if (seen.has(fid)) continue; // aynı maçın birden çok sürümü → officialFilter zaten tek bırakır; emniyet
    seen.add(fid);
    const lid = r.league_id == null ? null : Number(r.league_id);
    const input: GradeInput = {
      fixtureId: fid, leagueId: lid, leagueSlug: lid != null ? slugOf.get(lid) ?? null : null, covered: lid != null && slugOf.has(lid),
      homeName: String(r.home_name), awayName: String(r.away_name), kickoff: String(r.kickoff), modelVersion: r.model_version ?? null,
      pHome: Number(r.p_home), pDraw: Number(r.p_draw), pAway: Number(r.p_away), pick: r.pick ?? null,
      pOver25: r.p_over25 == null ? null : Number(r.p_over25), overPick: r.ou_pick ?? null,
      pBtts: r.p_btts_yes == null ? null : Number(r.p_btts_yes), bttsPick: r.btts_pick ?? null,
      homeScore: Number(r.home_score), awayScore: Number(r.away_score),
      market: markets.get(fid) ?? null, statuses: statuses.get(fid) ?? [],
    };
    const gs = gradeMatch(input);
    if (gs.some((g) => g.marketP != null)) withMarket++;
    if (gs.some((g) => g.statusSource === 'snapshot')) withStatus++;
    grades.push(...gs);
  }

  let inserted = 0, err: string | null = null;
  if (write && grades.length) {
    const out: GradeRow[] = grades.map(toGradeRow);
    for (let i = 0; i < out.length; i += CHUNK) {
      const { data: ins, error: e } = await dbFresh().from(GRADE_TABLE).upsert(out.slice(i, i + CHUNK), { onConflict: 'fixture_id,market,rule_version', ignoreDuplicates: true }).select('fixture_id');
      if (e) { err = e.message; console.error('[grades] insert failed', e.message); break; }
      inserted += (ins ?? []).length;
    }
  }
  return { ...base, candidates: ids.length, alreadyGraded: done.size, attempted: grades.length, inserted, withMarket, withStatus, error: err };
}

export async function gradesForWeek(week: IsoWeek, ruleVersion = GRADE_RULE_VERSION): Promise<MatchGrade[]> {
  const out: MatchGrade[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await dbFresh().from(GRADE_TABLE).select('*').eq('rule_version', ruleVersion).eq('iso_year', week.isoYear).eq('iso_week', week.isoWeek)
      .order('fixture_id', { ascending: true }).order('market', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    const list = (data ?? []) as GradeRow[];
    out.push(...list.map(fromGradeRow));
    if (list.length < 1000) break;
  }
  return out;
}

export interface LessonRunResult { week: string; grades: number; lessons: number; written: boolean; existed: boolean; error: string | null; summary: WeekLessons | null }

/** Haftanın derslerini hesaplar ve (write ise, daha önce yazılmadıysa) engine_learning_log'a bir kez yazar. */
export async function recordWeekLessons(week: IsoWeek = previousIsoWeek(), write = true): Promise<LessonRunResult> {
  const label = isoWeekLabel(week);
  try {
    const grades = await gradesForWeek(week);
    const summary = weekLessons(grades, week);
    const subject = lessonSubject(week);
    const { data: ex } = await dbFresh().from('engine_learning_log').select('id').eq('layer', 'review').eq('subject', subject).limit(1);
    const existed = !!(ex && ex.length);
    let written = false;
    if (write && !existed && grades.length) {
      const { error } = await dbFresh().from('engine_learning_log').insert({
        layer: 'review', action: 'report', subject, actor: LESSON_ACTOR,
        evidence: summary, after: { lessons: summary.lessons.map((l) => l.code) },
        note: `grade-1.0 haftalık dersler (keşifsel): ${summary.grades} kart / ${summary.fixtures} maç; durum kapsamı ${summary.statusCoverage.withSnapshot}/${summary.grades}.`,
      });
      if (error) return { week: label, grades: grades.length, lessons: summary.lessons.length, written: false, existed, error: error.message, summary };
      written = true;
    }
    return { week: label, grades: grades.length, lessons: summary.lessons.length, written, existed, error: null, summary };
  } catch (e: any) {
    return { week: label, grades: 0, lessons: 0, written: false, existed: false, error: e?.message ?? String(e), summary: null };
  }
}

export interface StoredLessons { week: string; generatedAt: string; summary: WeekLessons }

/** Karne sayfası: kaydedilmiş son N haftanın dersleri (engine_learning_log'dan; yeniden hesaplanmaz). */
export const getStoredLessons = unstable_cache(
  async (weeks = 4): Promise<StoredLessons[]> => {
    const { data, error } = await db().from('engine_learning_log').select('subject, occurred_at, evidence')
      .eq('layer', 'review').eq('actor', LESSON_ACTOR).like('subject', `${GRADE_RULE_VERSION}/%`)
      .order('occurred_at', { ascending: false }).limit(weeks * 3);
    if (error) { console.error('[grades] lessons read failed', error.message); return []; }
    const seen = new Set<string>();
    const out: StoredLessons[] = [];
    for (const r of (data ?? []) as any[]) {
      const s = r.evidence as WeekLessons | null;
      if (!s || !s.week || seen.has(s.week)) continue;
      seen.add(s.week);
      out.push({ week: s.week, generatedAt: String(r.occurred_at), summary: s });
      if (out.length >= weeks) break;
    }
    return out;
  },
  ['site-grade-lessons'],
  { revalidate: 60 * 60 },
);
