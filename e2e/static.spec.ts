// @static — veritabanı olmadan da çalışan akışlar (CI varsayılanı).
import { test, expect } from '@playwright/test';
import { LOCALES, expectNoHorizontalScroll, collectPageErrors } from './helpers';

const STATIC_PAGES = ['about', 'methodology', 'pricing', 'login', 'privacy', 'terms', 'app'];

test.describe('@static site', () => {
  test('/ locale önekine yönlenir', async ({ page }) => {
    const res = await page.goto('/about');
    expect(res?.ok()).toBeTruthy();
    expect(new URL(page.url()).pathname).toMatch(/^\/(en|de|it|tr)\/about$/);
  });

  for (const locale of LOCALES) {
    for (const slug of STATIC_PAGES) {
      test(`${locale}/${slug} yüklenir, html lang doğru, yatay taşma yok`, async ({ page }) => {
        const errors = collectPageErrors(page);
        const res = await page.goto(`/${locale}/${slug}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page).toHaveTitle(/Football Analytics/);
        await expect(page.locator('h1').first()).toBeVisible();
        await expectNoHorizontalScroll(page);
        expect(errors).toEqual([]);
      });
    }
  }

  test('dil seçici aynı sayfada dili değiştirir', async ({ page }) => {
    await page.goto('/en/methodology');
    // Below the lg breakpoint (tablet + mobile) the switcher sits in the hamburger
    // menu. The footer used to hold a second <select>; SEO Faz 0 replaced it with
    // crawlable hreflang links (see the test below), so open the menu whenever the
    // header's own switcher is not visible — not only on `isMobile` devices.
    const menu = page.getByRole('button', { name: /menu/i });
    if (await menu.isVisible()) await menu.click();
    const select = page.getByRole('combobox').first();
    await select.selectOption('de');
    await expect(page).toHaveURL(/\/de\/methodology$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('footer her dil için hreflang bağlantısı taşır', async ({ page }) => {
    await page.goto('/en/methodology');
    for (const l of LOCALES) {
      await expect(page.locator(`footer a[hreflang="${l}"]`), l).toHaveAttribute('href', new RegExp(`/${l}/methodology$`));
    }
  });

  test('bilinmeyen sayfa 404 döner', async ({ page }) => {
    const res = await page.goto('/en/bu-sayfa-yok');
    expect(res?.status()).toBe(404);
  });
});

test.describe('@static erişim kuralları', () => {
  // SEO Faz 0 (2026-10-17): account pages still bounce anonymous visitors to the
  // sign-in; the members' prediction pages answer 200 with a noindex login wall
  // (Google keeps the URL, no 307 chain); legacy public paths 301 to the site.
  test('üye sayfaları oturumsuz girişe yönlendirir', async ({ request }) => {
    for (const path of ['/en/dashboard', '/en/account', '/favorites']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeGreaterThanOrEqual(300);
      expect(res.status(), path).toBeLessThan(400);
      expect(res.headers()['location'] || '', path).toMatch(/\/login\?callbackUrl=/);
    }
  });

  test('tahmin sayfaları oturumsuz 200 + noindex giriş duvarı döner', async ({ request }) => {
    const res = await request.get('/en/predictions', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).toMatch(/href="\/en\/login[^"]*"[^>]*rel="nofollow"|rel="nofollow"[^>]*href="\/en\/login/);
  });

  test('eski herkese açık yollar yerelleştirilmiş siteye 301 gider', async ({ request }) => {
    for (const [path, to] of [['/live', '/en/matches'], ['/match/1', '/en/predictions/1'], ['/analysis/arsenal-vs-chelsea-123', '/en/matches/arsenal-vs-chelsea-123'], ['/leaderboard', '/en/performance']]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(301);
      expect(res.headers()['location'] || '', path).toMatch(new RegExp(to.replace(/\//g, '\\/') + '$'));
    }
  });

  test('korumalı API uçları anonim çağrıya kapalı', async ({ request }) => {
    expect((await request.get('/api/contact')).status()).toBe(401);
    expect((await request.get('/api/cron/settle-engine')).status()).toBe(401);
    expect((await request.post('/api/v2/settle', { data: {} })).status()).toBe(401);
    expect((await request.get('/api/admin/env-check')).status()).toBe(403);
  });

  test('servis sırrı admin uçlarını açar (middleware)', async ({ request }) => {
    const res = await request.get('/api/admin/env-check', {
      headers: { authorization: 'Bearer e2e-cron-secret' },
    });
    expect(res.status()).not.toBe(403);
  });
});
