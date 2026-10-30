// Kapsam dışı liglerde takım izleme listesi (kullanıcı kararı 2026-10-24).
// Soru: kapsam dışı ligde modelin "en emin pazarı" (ham p ≥ 0,60) bazı takımlarda
// sürekli ≥%60 tutuyor mu? Takım bazlı beyaz liste İÇİN DEĞİL — 22 Eki ölçümü:
// takım kovası kuralı kötüleştirdi (%74,4 → %68–72), seçilen takımlar iddianın
// altında kalıyor. Yalnız izleme: Kasım'da yeniden ölç, lig düzeyi karara girdi.
//
//   node --import tsx scripts/team-watchlist.mts            → liste üret/yaz (docs/watchlist/teams-YYYY-MM-DD.json)
//   node --import tsx scripts/team-watchlist.mts --eval F   → F dosyasındaki takımların o tarihten sonraki isabeti
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const MIN_PICKS = 8, MIN_HIT = 0.6, P_MIN = 0.6; // 5 seçimle 443 takım çıktı (gürültü); 8 ile 115 takım / 31 lig

async function all(q: any) { const out: any[] = []; for (let o = 0; o < 100000; o += 1000) { const { data, error } = await q.range(o, o + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }

interface Pick { league: string; leagueId: number; home: string; away: string; d: string; p: number; w: boolean }
async function picks(since: string): Promise<Pick[]> {
  const { data: cov } = await sb.from('league_coverage').select('league_id,status'); const st = new Map((cov ?? []).map((r: any) => [Number(r.league_id), r.status]));
  const ep = await all(sb.from('engine_predictions').select('league_id,league_name,home_name,away_name,kickoff,p_home,p_away,p_over25,p_btts_yes,home_score,away_score').eq('model_version', 'dc-1.0').eq('settled', true).not('home_score', 'is', null).gte('kickoff', since).order('kickoff').order('id'));
  const out: Pick[] = [];
  for (const e of ep) {
    const s = st.get(Number(e.league_id)); if (s === 'hidden' || s === 'whitelist') continue;
    const h = e.home_score, a = e.away_score; const c: Array<[number, boolean]> = [];
    if (e.p_home != null) c.push(e.p_home >= e.p_away ? [e.p_home, h > a] : [e.p_away, a > h]);
    if (e.p_over25 != null) c.push(e.p_over25 >= 0.5 ? [e.p_over25, h + a > 2.5] : [1 - e.p_over25, h + a < 2.5]);
    if (e.p_btts_yes != null && e.p_btts_yes >= 0.5) c.push([e.p_btts_yes, h > 0 && a > 0]);
    const b = c.filter((x) => x[0] >= P_MIN).sort((x, y) => y[0] - x[0])[0]; if (!b) continue;
    out.push({ league: e.league_name, leagueId: Number(e.league_id), home: e.home_name, away: e.away_name, d: e.kickoff.slice(0, 10), p: b[0], w: b[1] });
  }
  return out;
}
type Cell = { n: number; won: number; p: number };
function byTeam(rows: Pick[], from = '', to = '9999') {
  const t = new Map<string, Cell>();
  for (const r of rows) { if (r.d < from || r.d >= to) continue; for (const n of [r.home, r.away]) { const k = `${r.league}|${n}`; const c = t.get(k) ?? { n: 0, won: 0, p: 0 }; c.n++; if (r.w) c.won++; c.p += r.p; t.set(k, c); } }
  return t;
}

const args = process.argv.slice(2);
if (args[0] === '--eval') {
  const f = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  const rows = await picks(f.cutoff);
  const t = byTeam(rows, f.cutoff);
  let N = 0, W = 0, P = 0, still = 0, seen = 0;
  for (const team of f.teams) { const c = t.get(team.key); if (!c || c.n < 3) continue; seen++; N += c.n; W += c.won; P += c.p; if (c.won / c.n >= MIN_HIT) still++; console.log(team.key.padEnd(48), `liste: ${team.won}/${team.n}`, '→ sonra:', `${c.won}/${c.n} = ${(100 * c.won / c.n).toFixed(0)}% (model ${(100 * c.p / c.n).toFixed(0)}%)`); }
  const allT = [...t.values()].filter((c) => c.n >= 3); const AN = allT.reduce((s, c) => s + c.n, 0), AW = allT.reduce((s, c) => s + c.won, 0);
  console.log(`\nİZLEME (${f.cutoff} sonrası, ≥3 seçim): ${seen}/${f.teams.length} takım ölçüldü | isabet ${(100 * W / N).toFixed(1)}% (model ${(100 * P / N).toFixed(1)}%, n=${N}) | hâlâ ≥%60: ${still}/${seen} | tüm kapsam dışı takımlar: ${(100 * AW / AN).toFixed(1)}% (n=${AN})`);
} else {
  const cutoff = args[0] || new Date().toISOString().slice(0, 10);
  const rows = await picks('2026-06-01');
  const t = byTeam(rows, '', cutoff);
  const teams = [...t.entries()].filter(([, c]) => c.n >= MIN_PICKS && c.won / c.n >= MIN_HIT).map(([key, c]) => ({ key, league: key.split('|')[0], team: key.split('|')[1], n: c.n, won: c.won, hit: Math.round(1000 * c.won / c.n) / 10, modelP: Math.round(1000 * c.p / c.n) / 10 })).sort((a, b) => b.hit - a.hit || b.n - a.n);
  const out = { createdAt: new Date().toISOString(), cutoff, rule: { minPicks: MIN_PICKS, minHit: MIN_HIT, pMin: P_MIN, scope: 'kapsam dışı (hidden/whitelist hariç), motorun en emin pazarı' }, note: 'İzleme listesi — beyaz liste adayı değil. Kasım 2026\'da --eval ile yeniden ölç, lig düzeyinde karar.', teams };
  const file = `docs/watchlist/teams-${cutoff}.json`; fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`${teams.length} takım → ${file}`); for (const x of teams) console.log(` ${x.league.padEnd(30)} ${x.team.padEnd(26)} ${x.won}/${x.n} = ${x.hit}% (model ${x.modelP}%)`);
}
