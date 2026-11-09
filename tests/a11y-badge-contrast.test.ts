import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// PSI erişilebilirlik 97 (2026-11-09): örnek maç kartındaki .risk-medium, .tag-win,
// .tag-loss rozetlerinde metin/zemin kontrastı 4,5:1 altındaydı (4,14 / 4,39 / 4,37).
// Neden: metin ile %12–14 alfa zemin aynı renk tonundan türüyordu. Bu test
// site.css'teki tokenlardan kontrastı WCAG formülüyle hesaplar; bir token
// değişince rozetler sessizce eşiğin altına düşemez.

const CSS = readFileSync(resolve(__dirname, '../src/app/(site)/site.css'), 'utf8');

type RGB = [number, number, number];
type Tokens = Record<string, RGB>;

function tokensIn(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/--(s-[a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  return out;
}

function blockAfter(selector: string): string {
  const i = CSS.indexOf(selector);
  assert.ok(i >= 0, `seçici yok: ${selector}`);
  const open = CSS.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < CSS.length; j++) {
    if (CSS[j] === '{') depth++;
    else if (CSS[j] === '}' && --depth === 0) return CSS.slice(open + 1, j);
  }
  throw new Error('blok kapanmadı');
}

const LIGHT = tokensIn(blockAfter('\n.site {'));
const DARK = tokensIn(blockAfter(".site[data-theme='dark'],\n.site .band-dark {"));
const DARK_AUTO = tokensIn(blockAfter(".site:not([data-theme='light']) {"));

function lum([r, g, b]: RGB): number {
  const f = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: RGB, b: RGB): number {
  const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
}
function blend(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;
}

const BADGES = ['tag-win', 'tag-loss', 'tag-live', 'risk-low', 'risk-medium', 'risk-high'];

function badgeRule(cls: string) {
  const m = new RegExp(`\\.site \\.${cls} \\{[^}]*background: rgb\\(var\\(--(s-[a-z0-9-]+)\\) / ([0-9.]+)\\);[^}]*color: rgb\\(var\\(--(s-[a-z0-9-]+)\\)\\)`).exec(CSS);
  assert.ok(m, `.${cls} kuralı beklenen biçimde değil`);
  return { bgToken: m[1], alpha: Number(m[2]), inkToken: m[3] };
}

for (const [theme, T] of [['açık', LIGHT], ['koyu', DARK]] as const) {
  test(`rozet kontrastı ≥ 4,5:1 — ${theme} tema, kart ve raised zemin üzerinde`, () => {
    for (const cls of BADGES) {
      const r = badgeRule(cls);
      for (const surface of ['s-surface', 's-raised'] as const) {
        const bg = blend(T[r.bgToken], r.alpha, T[surface]);
        const ratio = contrast(T[r.inkToken], bg);
        assert.ok(ratio >= 4.5, `.${cls} ${theme} tema ${surface}: ${ratio.toFixed(2)}:1 (metin --${r.inkToken}, zemin --${r.bgToken} %${r.alpha * 100})`);
      }
    }
  });
}

test('rozet mürekkep tokenları üç tema bloğunda da tanımlı ve otomatik koyu = açık koyu', () => {
  for (const tok of ['s-win-ink', 's-loss-ink', 's-warn-ink']) {
    assert.ok(LIGHT[tok], `açık temada --${tok} yok`);
    assert.ok(DARK[tok], `data-theme=dark/.band-dark bloğunda --${tok} yok`);
    assert.deepEqual(DARK_AUTO[tok], DARK[tok], `prefers-color-scheme bloğu --${tok} için farklı değer taşıyor`);
  }
  // Açık tema metni tabandan koyu olmalı (ton aynı, parlaklık düşük) — zemin tasarımı değişmedi.
  assert.ok(lum(LIGHT['s-win-ink']) < lum(LIGHT['s-win']));
  assert.ok(lum(LIGHT['s-loss-ink']) < lum(LIGHT['s-loss']));
  assert.ok(lum(LIGHT['s-warn-ink']) < lum(LIGHT['s-accent2-700']));
});
