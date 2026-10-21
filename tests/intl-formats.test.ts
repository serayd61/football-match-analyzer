import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 2026-10-21: /performance called f.number(x, 'percent') while only percent0/percent1
// exist in src/i18n/request.ts. next-intl logs MISSING_FORMAT (5,149 errors since
// 13 Sept) and silently falls back to a plain number, so "65%" rendered as "0.65".
// Every named number/dateTime format used in the app must be declared.

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

function declared(kind: 'number' | 'dateTime'): Set<string> {
  const src = readFileSync('src/i18n/request.ts', 'utf8');
  const block = src.split(`${kind}: {`)[1]?.split('\n      }')[0] ?? '';
  return new Set([...block.matchAll(/^\s*(\w+):\s*\{/gm)].map((m) => m[1]));
}

/** Named format of each `.number(` / `.dateTime(` call: the trailing 'name' argument, found by balancing parentheses. */
function namedFormats(src: string, kind: 'number' | 'dateTime'): string[] {
  const out: string[] = [];
  const open = `.${kind}(`;
  for (let i = src.indexOf(open); i !== -1; i = src.indexOf(open, i + 1)) {
    let depth = 1, j = i + open.length;
    while (j < src.length && depth > 0) { if (src[j] === '(') depth++; else if (src[j] === ')') depth--; j++; }
    const m = /,\s*'(\w+)'\s*$/.exec(src.slice(i + open.length, j - 1));
    if (m) out.push(m[1]);
  }
  return out;
}

test('every named next-intl format used in src is declared in request.ts', () => {
  const num = declared('number');
  const dt = declared('dateTime');
  assert.ok(num.has('percent0') && dt.has('kickoff'), 'format parser sanity');
  const missing: string[] = [];
  let seen = 0;
  for (const file of walk('src')) {
    const s = readFileSync(file, 'utf8');
    for (const n of namedFormats(s, 'number')) { seen++; if (!num.has(n)) missing.push(`${file}: number '${n}'`); }
    for (const n of namedFormats(s, 'dateTime')) { seen++; if (!dt.has(n)) missing.push(`${file}: dateTime '${n}'`); }
  }
  assert.ok(seen > 20, `expected to find named format calls, saw ${seen}`);
  assert.deepEqual(missing, []);
});
