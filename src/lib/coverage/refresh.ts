import type { SupabaseClient } from '@supabase/supabase-js';
import { getCatalogMap } from '@/lib/league-catalog';
import { resolveLeague } from '@/lib/site/leagues';
import { aggregateLeague, evaluateLeague, hideDecision, isProposalEligibleName, PROPOSAL_COOLDOWN_DAYS, type CoverageStatus, type CoverageProposal } from './rules';

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
const COLS = 'league_id, league_name, kickoff, p_over25, p_btts_yes, p_home, p_draw, p_away, home_score, away_score, correct, ll_1x2';

export interface RefreshResult { leagues: number; inserted: number; repaired: number; proposals: Array<{ leagueId: number; name: string; type: string; to: CoverageStatus }>; skippedCooldown: number; rows: number; hidden: number; unhidden: number }

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
  let inserted = 0, repaired = 0;
  const hideLog: any[] = [];
  for (const [leagueId, { name, rows }] of byLeague) {
    const cat = catalog.get(leagueId);
    const known = cur.get(leagueId);
    // ccode: katalog → sicil satırının kendi ccode'u (ilk eklemede yazılmıştı) → yok
    const ccode = cat?.ccode || known?.ccode || null;
    // Ad: motor satırında ingest anındaki "League 937276" kalmış olabilir → katalog / sicil adı önce
    const resolveName = cat?.name || known?.name || name;
    const site = resolveLeague(resolveName, leagueId, ccode);
    const stats = aggregateLeague(rows, WINDOW_DAYS);
    const alias = !known && site?.slug ? bySlug.get(site.slug) : null;
    // Onarım: daha önce otomatik 'excluded' açılmış ama aslında slug'lı bir site ligine
    // çözülen mevsimlik id (Eredivisie 937276 → 57, 22 Eyl) alias'a çevrilir; admin
    // kararıyla yazılmış satırlara (reason 'otomatik:' değilse) dokunulmaz.
    const repair = known && !known.slug && String(known.reason || '').startsWith('otomatik') && site?.slug ? bySlug.get(site.slug) : null;
    const status: CoverageStatus = repair?.status ?? known?.status ?? alias?.status ?? 'excluded';
    if (!known) inserted++;
    if (repair || alias) { repaired++; console.log(`[coverage] alias ${leagueId} ${resolveName} (${ccode ?? '-'}) → ${(repair ?? alias).slug} ${(repair ?? alias).status}${repair ? ' (onarım)' : ''}`); }
    // Gizleme kuralı (otomatik, admin kararlı 'hidden' satırına dokunmaz): excluded ↔ hidden
    const auto = !known || String(known.reason || '').startsWith('otomatik');
    const hd = !repair && !alias && auto ? hideDecision(status, stats) : null;
    const hidePatch = hd === 'hide'
      ? { status: 'hidden' as const, reason: `otomatik: 1X2 log-loss ${stats.x12.ll} ≥ rastgele (n=${stats.x12.n})`, decided_at: nowIso, decided_by: ACTOR }
      : hd === 'unhide' ? { status: 'excluded' as const, reason: `otomatik: 1X2 log-loss ${stats.x12.ll} düzeldi (n=${stats.x12.n})`, decided_at: nowIso, decided_by: ACTOR } : null;
    if (hidePatch) hideLog.push({ layer: 'coverage', action: 'apply', subject: `league:${leagueId}`, before: { status }, after: { status: hidePatch.status, type: hd }, evidence: { league: resolveName, x12: stats.x12, n: stats.n }, actor: ACTOR, note: hidePatch.reason });
    upserts.push(known
      ? repair
        ? { ...known, status: repair.status, tier: repair.tier, country: repair.country ?? known.country, reason: `alias: ${repair.slug} (mevsimlik id ${leagueId})`, decided_at: nowIso, decided_by: ACTOR, stats, updated_at: nowIso }
        : { ...known, stats, updated_at: nowIso, ...(hidePatch ?? {}) }      // durum/kademe/gerekçe korunur (gizleme kuralı hariç)
      : alias
        ? { league_id: leagueId, slug: null, name: cat?.name || name, ccode: cat?.ccode ?? null, country: alias.country ?? null, status: alias.status, tier: alias.tier, reason: `alias: ${alias.slug} (mevsimlik id ${leagueId})`, stats, decided_at: nowIso, decided_by: ACTOR, review_at: null, updated_at: nowIso }
        : { league_id: leagueId, slug: site?.slug ?? null, name: cat?.name || name, ccode: cat?.ccode ?? null, country: site?.country ?? null, tier: 9, stats, review_at: null, updated_at: nowIso, ...(hidePatch ?? { status: 'excluded', reason: 'otomatik: akışta görüldü, kapsam dışı', decided_at: nowIso, decided_by: ACTOR }) });
    if (alias || repair || hidePatch || status === 'hidden') continue; // alias'ın önerisi ana satırdan gelir; gizli lig öneri üretmez
    if (status === 'excluded' && !isProposalEligibleName(cat?.name || name)) continue;
    const p = evaluateLeague(status, stats);
    if (p) evaluated.push({ leagueId, name: known?.name ?? (cat?.name || name), status, proposal: p });
  }
  for (let i = 0; i < upserts.length; i += 200) {
    const { error } = await sb.from('league_coverage').upsert(upserts.slice(i, i + 200), { onConflict: 'league_id' });
    if (error) throw new Error(`league_coverage upsert: ${error.message}`);
  }
  const hiddenN = hideLog.filter((h) => h.after.type === 'hide').length, unhiddenN = hideLog.length - hiddenN;
  if (hideLog.length) {
    const { error } = await sb.from('engine_learning_log').insert(hideLog);
    if (error) console.error('[coverage] hide log insert failed:', error.message);
    console.log(`[coverage] hidden=${hiddenN} unhidden=${unhiddenN}: ${hideLog.map((h) => `${h.evidence.league}→${h.after.status}`).join(', ')}`);
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
  console.log(`[coverage] leagues=${byLeague.size} inserted=${inserted} repaired=${repaired} proposals=${out.length} cooldown=${skipped} rows=${total}`);
  return { leagues: byLeague.size, inserted, repaired, proposals: out, skippedCooldown: skipped, rows: total, hidden: hiddenN, unhidden: unhiddenN };
}
