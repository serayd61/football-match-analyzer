import type { SupabaseClient } from '@supabase/supabase-js';
import { getCatalogMap } from '@/lib/league-catalog';
import { resolveLeague } from '@/lib/site/leagues';
import { aggregateLeague, evaluateLeague, isProposalEligibleName, PROPOSAL_COOLDOWN_DAYS, type CoverageStatus, type CoverageProposal } from './rules';

// ============================================================================
// KAPSAM SİCİLİ YENİLEME — haftalık inceleme adımı
// ----------------------------------------------------------------------------
// 1) Son WINDOW_DAYS günün sonuçlanmış satırlarını lig id'sine göre toplar.
// 2) league_coverage'ı UPSERT eder: yeni görülen lig 'excluded' olarak açılır
//    (durum yalnız eklemede yazılır; mevcut satırın durumu/kademe DOKUNULMAZ).
// 3) Kurala göre öneri üretir → engine_learning_log (layer 'coverage', propose);
//    aynı lig+tip için 28 gün içinde tekrar yazmaz. Karar admin'de.
// ============================================================================

export const WINDOW_DAYS = 180;
const PAGE = 1000;
const ACTOR = 'cron:engine-weekly-review';
const COLS = 'league_id, league_name, kickoff, p_over25, p_btts_yes, home_score, away_score, correct, ll_1x2';

export interface RefreshResult { leagues: number; inserted: number; proposals: Array<{ leagueId: number; name: string; type: string; to: CoverageStatus }>; skippedCooldown: number; rows: number }

export async function refreshCoverage(sb: SupabaseClient, now = new Date()): Promise<RefreshResult> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const byLeague = new Map<number, { name: string; rows: any[] }>();
  let total = 0;
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await sb.from('engine_predictions').select(COLS)
      .eq('settled', true).not('result', 'is', null).gte('kickoff', since)
      .order('kickoff', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`engine_predictions read: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as any[]) {
      if (r.league_id == null) continue;
      total++;
      const k = Number(r.league_id);
      if (!byLeague.has(k)) byLeague.set(k, { name: r.league_name || `League ${k}`, rows: [] });
      byLeague.get(k)!.rows.push(r);
    }
    if (data.length < PAGE) break;
  }

  const [catalog, { data: existing }] = await Promise.all([
    getCatalogMap().catch(() => new Map()),
    sb.from('league_coverage').select('*'),
  ]);
  // Toplu upsert'te satırlar aynı kolon kümesini taşımalı (eksik kolon null yazılır →
  // status not-null ihlali, 22 Eyl). Mevcut satır tüm alanlarıyla geri yazılır.
  const cur = new Map<number, any>((existing ?? []).map((r: any) => [Number(r.league_id), r]));
  // Slug → sicil satırı: FotMob büyük-5 dışı liglere her sezon yeni id verir; aynı site
  // ligine çözülen yeni id, slug'ı olan satırın DURUMUNU/KADEMESİNİ miras alır (alias),
  // slug ise tekil kalır (unique ihlali 22 Eyl).
  const bySlug = new Map<string, any>((existing ?? []).filter((r: any) => r.slug).map((r: any) => [r.slug, r]));

  const nowIso = now.toISOString();
  const upserts: any[] = [];
  const evaluated: Array<{ leagueId: number; name: string; status: CoverageStatus; proposal: CoverageProposal }> = [];
  let inserted = 0;
  for (const [leagueId, { name, rows }] of byLeague) {
    const cat = catalog.get(leagueId);
    const site = resolveLeague(name, leagueId, cat?.ccode);
    const stats = aggregateLeague(rows, WINDOW_DAYS);
    const known = cur.get(leagueId);
    const alias = !known && site?.slug ? bySlug.get(site.slug) : null;
    // Onarım: daha önce otomatik 'excluded' açılmış ama aslında slug'lı bir site ligine
    // çözülen mevsimlik id (Eredivisie 937276 → 57, 22 Eyl) alias'a çevrilir; admin
    // kararıyla yazılmış satırlara (reason 'otomatik:' değilse) dokunulmaz.
    const repair = known && !known.slug && String(known.reason || '').startsWith('otomatik') && site?.slug ? bySlug.get(site.slug) : null;
    const status: CoverageStatus = repair?.status ?? known?.status ?? alias?.status ?? 'excluded';
    if (!known) inserted++;
    upserts.push(known
      ? repair
        ? { ...known, status: repair.status, tier: repair.tier, country: repair.country ?? known.country, reason: `alias: ${repair.slug} (mevsimlik id ${leagueId})`, decided_at: nowIso, decided_by: ACTOR, stats, updated_at: nowIso }
        : { ...known, stats, updated_at: nowIso }      // durum/kademe/gerekçe korunur
      : alias
        ? { league_id: leagueId, slug: null, name: cat?.name || name, ccode: cat?.ccode ?? null, country: alias.country ?? null, status: alias.status, tier: alias.tier, reason: `alias: ${alias.slug} (mevsimlik id ${leagueId})`, stats, decided_at: nowIso, decided_by: ACTOR, review_at: null, updated_at: nowIso }
        : { league_id: leagueId, slug: site?.slug ?? null, name: cat?.name || name, ccode: cat?.ccode ?? null, country: site?.country ?? null, status: 'excluded', tier: 9, reason: 'otomatik: akışta görüldü, kapsam dışı', stats, decided_at: nowIso, decided_by: ACTOR, review_at: null, updated_at: nowIso });
    if (alias || repair) continue;                                   // alias'ın önerisi ana satırdan gelir
    if (status === 'excluded' && !isProposalEligibleName(cat?.name || name)) continue;
    const p = evaluateLeague(status, stats);
    if (p) evaluated.push({ leagueId, name: known?.name ?? (cat?.name || name), status, proposal: p });
  }
  for (let i = 0; i < upserts.length; i += 200) {
    const { error } = await sb.from('league_coverage').upsert(upserts.slice(i, i + 200), { onConflict: 'league_id' });
    if (error) throw new Error(`league_coverage upsert: ${error.message}`);
  }

  // Öneriler (soğuma penceresi: aynı lig + tip)
  const cooldownSince = new Date(now.getTime() - PROPOSAL_COOLDOWN_DAYS * 86_400_000).toISOString();
  const { data: recent } = await sb.from('engine_learning_log').select('subject, after')
    .eq('layer', 'coverage').eq('action', 'propose').gte('occurred_at', cooldownSince);
  const seen = new Set((recent ?? []).map((r: any) => `${r.subject}|${r.after?.type}`));
  const out: RefreshResult['proposals'] = [];
  let skipped = 0;
  for (const e of evaluated) {
    const subject = `league:${e.leagueId}`;
    if (seen.has(`${subject}|${e.proposal.type}`)) { skipped++; continue; }
    const { error } = await sb.from('engine_learning_log').insert({
      layer: 'coverage', action: 'propose', subject,
      before: { status: e.status }, after: { status: e.proposal.to, type: e.proposal.type },
      evidence: { league: e.name, ...e.proposal.evidence }, actor: ACTOR, note: e.proposal.reason,
    });
    if (error) console.error('[coverage] proposal insert failed:', error.message);
    else out.push({ leagueId: e.leagueId, name: e.name, type: e.proposal.type, to: e.proposal.to });
  }
  console.log(`[coverage] leagues=${byLeague.size} inserted=${inserted} proposals=${out.length} cooldown=${skipped} rows=${total}`);
  return { leagues: byLeague.size, inserted, proposals: out, skippedCooldown: skipped, rows: total };
}
