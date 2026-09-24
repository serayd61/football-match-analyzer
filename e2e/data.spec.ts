// @data — gerçek veri gerektirir. Yalnız E2E_BASE_URL ile koşar (ör. üretim/preview).
// Salt okuma: form göndermez, hesap açmaz.
import { test, expect } from '@playwright/test';
import { LOCALES, expectNoHorizontalScroll, collectPageErrors } from './helpers';

test.describe('@data site', () => {
  for (const locale of LOCALES) {
    test(`${locale} ana sayfa ve performans verisiyle yüklenir`, async ({ page }) => {
      const errors = collectPageErrors(page);
      for (const path of [`/${locale}`, `/${locale}/performance`, `/${locale}/leagues`]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator('h1').first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
      expect(errors).toEqual([]);
    });
  }

  test('lig detayına gidilebilir', async ({ page }) => {
    await page.goto('/en/leagues');
    const link = page.locator('a[href*="/en/leagues/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/en\/leagues\/[^/]+$/);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('landing kanıt API\'si tutarlı', async ({ request }) => {
    const res = await request.get('/api/v2/proof');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });
});
