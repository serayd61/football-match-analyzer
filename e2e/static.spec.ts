// @static — veritabanı olmadan da çalışan akışlar (CI varsayılanı).
import { test, expect } from '@playwright/test';
import { LOCALES, expectNoHorizontalScroll, collectPageErrors } from './helpers';

const STATIC_PAGES = ['about', 'methodology', 'pricing', 'login', 'privacy', 'terms'];

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

  test('dil seçici aynı sayfada dili değiştirir', async ({ page, isMobile }) => {
    await page.goto('/en/methodology');
    if (isMobile) {
      const menu = page.getByRole('button', { name: /menu/i });
      if (await menu.isVisible()) await menu.click();
    }
    const select = page.getByRole('combobox').first();
    await select.selectOption('de');
    await expect(page).toHaveURL(/\/de\/methodology$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('bilinmeyen sayfa 404 döner', async ({ page }) => {
    const res = await page.goto('/en/bu-sayfa-yok');
    expect(res?.status()).toBe(404);
  });
});

test.describe('@static erişim kuralları', () => {
  test('üye sayfaları oturumsuz girişe yönlendirir', async ({ request }) => {
    for (const path of ['/en/predictions', '/en/dashboard', '/live', '/match/1']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeGreaterThanOrEqual(300);
      expect(res.status(), path).toBeLessThan(400);
      expect(res.headers()['location'] || '', path).toMatch(/\/login\?callbackUrl=/);
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
