#!/usr/bin/env node
// Validates docs/aso/google-play-*.md against Google Play listing limits.
//   node scripts/aso-validate.js
// Title ≤ 30, short ≤ 80, full ≤ 4000 characters (Unicode code points, as the
// Console counts). Also flags banned words (Ads gambling-certification language).
const fs = require('fs');
const path = require('path');

const LIMITS = { Title: 30, 'Short description': 80, 'Full description': 4000 };
const BANNED = [/\btips?\b/i, /\bpicks?\b/i, /sure bet/i, /\bbonus\b/i, /guarantee/i, /\bbanko\b/i, /\btüyo\b/i, /kesin kazan/i, /\bgaranti/i, /sichere wette/i, /wett-?tipps?/i];

const dir = path.join(__dirname, '..', 'docs', 'aso');
let failed = false;
for (const file of fs.readdirSync(dir).filter((f) => /^google-play-[a-z]{2}\.md$/.test(f))) {
  const md = fs.readFileSync(path.join(dir, file), 'utf8');
  console.log(`\n${file}`);
  for (const [section, limit] of Object.entries(LIMITS)) {
    // first ```text block after "## <section>"
    const re = new RegExp(`^## ${section}\\s*\\n[\\s\\S]*?\`\`\`text\\n([\\s\\S]*?)\\n\`\`\``, 'm');
    const m = md.match(re);
    if (!m) { console.log(`  ✗ ${section}: section not found`); failed = true; continue; }
    const text = m[1];
    const len = Array.from(text).length;
    const ok = len <= limit;
    if (!ok) failed = true;
    const banned = BANNED.filter((b) => b.test(text)).map(String);
    if (banned.length) failed = true;
    console.log(`  ${ok && !banned.length ? '✓' : '✗'} ${section}: ${len}/${limit} chars${banned.length ? ` — banned: ${banned.join(', ')}` : ''}`);
  }
}
console.log(failed ? '\nFAILED' : '\nOK');
process.exit(failed ? 1 : 0);
