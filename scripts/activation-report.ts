// Yeni kayıt aktivasyon raporu (2026-10-28). Kaynak: profiles.last_seen_at / first_match_view_at
// (migration 20261028010000, yazım src/lib/site/seen.ts).
// Kullanım (repo kökünde, .env.local ile):  node --import tsx scripts/activation-report.ts [gün=7]
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const days = Number(process.argv[2] || 7);
const HOUR = 3600_000;

async function main() {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: users, error } = await sb.from('users').select('email,name,password_hash,email_verified,created_at').gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const emails = (users ?? []).map((u: any) => u.email);
  const { data: profiles, error: e2 } = await sb.from('profiles').select('email,last_seen_at,first_match_view_at,trial_ends_at').in('email', emails);
  if (e2) throw new Error(e2.message);
  const byEmail = new Map((profiles ?? []).map((p: any) => [String(p.email).toLowerCase(), p]));
  let returned = 0, matchViewed = 0;
  console.log(`Son ${days} gün · ${users?.length ?? 0} kayıt · şimdi ${new Date().toISOString().slice(0, 16)}Z`);
  console.log('kayıt            | e-posta                        | yöntem   | son görülme      | ilk maç görüntüsü | geri geldi');
  for (const u of users ?? []) {
    const p = byEmail.get(String(u.email).toLowerCase());
    const created = Date.parse(u.created_at);
    const seen = p?.last_seen_at ? Date.parse(p.last_seen_at) : null;
    const back = seen != null && seen - created > HOUR;  // throttle saatlik: kayıt anındaki ilk yazımı saymaz
    if (back) returned++;
    if (p?.first_match_view_at) matchViewed++;
    const f = (x?: string | null) => (x ? x.replace('T', ' ').slice(0, 16) : '-').padEnd(16);
    console.log(`${f(u.created_at)} | ${String(u.email).slice(0, 30).padEnd(30)} | ${(u.password_hash ? 'password' : 'google').padEnd(8)} | ${f(p?.last_seen_at)} | ${f(p?.first_match_view_at)}  | ${back ? 'evet' : '-'}`);
  }
  const n = users?.length ?? 0;
  console.log(`\nMaç sayfası açan: ${matchViewed}/${n} · kayıttan ≥1 saat sonra geri gelen: ${returned}/${n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
