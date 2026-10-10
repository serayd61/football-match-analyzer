// SEO içerik görsellerini yeniler (denetim 2026-10-10). Dev sunucu 3000'de açıkken:
//   npx -y -p playwright-core@1.56 node scripts/seo-screenshots.js
// Headless Chromium: ms-playwright önbelleğindeki chromium_headless_shell (EXE yolu);
// yoksa `npx playwright install chromium-headless-shell`. Çıktı: public/images/*.png
// (1120px, 2x, açık tema). Boyut değişirse src/lib/site/content-images.ts'i güncelleyin.
const { chromium } = require('playwright-core');
const OUT = require('path').join(__dirname, '..', 'public', 'images') + '/';
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1120, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'en-GB' });
  const page = await ctx.newPage();
  const go = async (u) => {
    for (let i = 0; i < 4; i++) {
      try { await page.goto(u, { waitUntil: 'networkidle', timeout: 240000 }); await page.waitForSelector('main h1', { timeout: 120000 }); await page.waitForTimeout(1500); return; }
      catch (e) { if (i === 3) throw e; console.error('retry', i, String(e).slice(0, 80)); await page.waitForTimeout(4000); }
    }
  };
  const r = {};
  await go('http://localhost:3000/en');
  r.homeH1 = await page.locator('main h1').first().textContent();
  const demo = page.locator('#demo'); r.demo = await demo.count();
  if (r.demo) { await page.addStyleTag({ content: '[data-cta="hero-record-chip"]{display:none !important}' }); await demo.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await demo.screenshot({ path: OUT + 'sample-match-analysis-probabilities-confidence-risk.png' }); }
  await go('http://localhost:3000/en/leagues/premier-league');
  const st = page.locator('.tbl-scroll').first(); r.standings = await st.count();
  if (r.standings) { await st.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await st.screenshot({ path: OUT + 'premier-league-standings-table.png' }); }
  await go('http://localhost:3000/en/performance');
  const main = page.locator('main'); const mb = await main.boundingBox();
  const monthly = page.getByText('Monthly hit rate', { exact: true }).first();
  const mo = await monthly.boundingBox();
  const h = mo ? (mo.y - 28 - mb.y) : 500;
  await page.screenshot({ path: OUT + 'prediction-track-record-hit-rate-roi.png', clip: { x: mb.x, y: mb.y, width: mb.width, height: h } });
  r.perfClipH = h;
  r.perf = mb;
  await browser.close();
  console.log(JSON.stringify(r));
})().catch((e) => { console.error(e); process.exit(1); });
