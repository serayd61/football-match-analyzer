// Eleme kuralını (pruneReason) mevcut sicile bir kez uygular.
// Kullanım (repo kökünde, .env.local ile):  node --import tsx scripts/apply-prune-rule.ts
// - whitelist/observe satırlarına ve admin kararlı (reason 'otomatik' ile başlamayan) satırlara dokunmaz
// - kurala uyan excluded/otomatik-hidden satırları 'hidden' + reason 'otomatik: eleme: …' yapar
// - katalogda olup sicilde olmayan ligler için hidden satır açar (fikstür filtresi hemen çalışsın)
// Haftalık engine-weekly-review (refreshCoverage) aynı kuralı zaten uygular; bu betik yalnızca ilk geçiş içindir.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { pruneReason } from '../src/lib/coverage/rules';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
const ACTOR = 'manual:serkan (eleme kuralı 2026-10-17)';

async function main() {
  const { data: cat, error: e1 } = await sb.from('league_catalog').select('league_id,name,ccode');
  if (e1) throw new Error(e1.message);
  const { data: cov, error: e2 } = await sb.from('league_coverage').select('*');
  if (e2) throw new Error(e2.message);
  const known = new Map((cov ?? []).map((r: any) => [Number(r.league_id), r]));
  const now = new Date().toISOString();
  const ups: any[] = []; let updated = 0, inserted = 0, skipped = 0;
  for (const c of cat ?? []) {
    const why = pruneReason(c.name, c.ccode);
    if (!why) continue;
    const k = known.get(c.league_id);
    if (k) {
      const auto = String(k.reason || '').startsWith('otomatik');
      if (k.status === 'whitelist' || k.status === 'observe' || !auto || String(k.reason || '').startsWith('otomatik: eleme')) { skipped++; continue; }
      ups.push({ ...k, status: 'hidden', reason: `otomatik: eleme: ${why}`, decided_at: now, decided_by: ACTOR, updated_at: now }); updated++;
    } else {
      ups.push({ league_id: c.league_id, slug: null, name: c.name, ccode: c.ccode, country: null, status: 'hidden', tier: 9, reason: `otomatik: eleme: ${why}`, stats: null, decided_at: now, decided_by: ACTOR, review_at: null, updated_at: now }); inserted++;
    }
  }
  for (let i = 0; i < ups.length; i += 200) {
    const { error } = await sb.from('league_coverage').upsert(ups.slice(i, i + 200), { onConflict: 'league_id' });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  console.log(`güncellenen: ${updated}  eklenen: ${inserted}  atlanan (korunan): ${skipped}`);
  const { data: w } = await sb.from('league_coverage').select('status');
  const cnt: Record<string, number> = {}; for (const r of w ?? []) cnt[r.status] = (cnt[r.status] || 0) + 1;
  console.log('durum sayıları:', cnt);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
