// supabase/migrations tutarlılığı + şema kayması bekçisi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const MIG = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();

test('migration adları Supabase CLI biçiminde ve sürümler benzersiz', () => {
  assert.ok(files.length > 0);
  const versions = new Set<string>();
  for (const f of files) {
    assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, f);
    const v = f.slice(0, 14);
    assert.ok(!versions.has(v), `yinelenen sürüm ${v}`);
    versions.add(v);
  }
});

test('migration\'lar yıkıcı veri işlemi içermez', () => {
  for (const f of files) {
    const sql = readFileSync(join(MIG, f), 'utf8').replace(/--.*$/gm, '');
    assert.doesNotMatch(sql, /\btruncate\b/i, `${f}: TRUNCATE`);
    assert.doesNotMatch(sql, /\bdrop\s+table\b(?!\s+if\s+exists)/i, `${f}: DROP TABLE (if exists olmadan)`);
    assert.doesNotMatch(sql, /\bdelete\s+from\s+[\w.]+\s*;/i, `${f}: koşulsuz DELETE`);
  }
});

test('migration_status.sql her migration için bir imza satırı taşır', () => {
  const status = readFileSync(join(ROOT, 'supabase', 'queries', 'migration_status.sql'), 'utf8');
  for (const f of files) assert.ok(status.includes(`'${f.slice(0, 14)}'`), `imza yok: ${f}`);
});

// Canlıda olup repoda CREATE'i olmayan tablolar (bkz. supabase/README.md).
// Bu liste yalnız KÜÇÜLMELİ: baseline dökümü alındıkça buradan sil.
const KNOWN_UNDECLARED = new Set([
  'confidence_calibration', 'confidence_performance', 'email_campaign_log', 'email_unsubscribes',
  'ip_tracking', 'league_catalog', 'model_comparison', 'password_reset_tokens', 'prediction_odds',
  'predictions', 'profiles', 'subscriptions', 'user_analysis_history', 'users',
]);

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

test('koddaki her tablo repoda tanımlı ya da bilinen açık listesinde', () => {
  const used = new Set<string>();
  for (const f of [...walk(join(ROOT, 'src'), /\.(ts|tsx)$/), ...walk(join(ROOT, 'engine'), /\.py$/)]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\.from\('([a-z_0-9]+)'\)/g)) used.add(m[1]);
  }
  const defined = new Set<string>();
  const sqlFiles = [...walk(join(ROOT, 'supabase'), /\.sql$/), ...walk(join(ROOT, 'engine'), /\.sql$/)];
  for (const f of sqlFiles) {
    const re = /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi;
    const sql = readFileSync(f, 'utf8').replace(/--.*$/gm, '');
    for (const m of sql.matchAll(re)) defined.add(m[1].toLowerCase());
  }
  const missing = [...used].filter((t) => !defined.has(t) && !KNOWN_UNDECLARED.has(t)).sort();
  assert.deepEqual(missing, [], `migration'ı olmayan yeni tablo(lar): ${missing.join(', ')}`);
  const nowDefined = [...KNOWN_UNDECLARED].filter((t) => defined.has(t));
  assert.deepEqual(nowDefined, [], `artık tanımlı, KNOWN_UNDECLARED'dan sil: ${nowDefined.join(', ')}`);
});
