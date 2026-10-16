// @static — Testers Community geri bildirimi (2026-10-16): şifre göster/gizle,
// ilk-ziyaret turu (yalnız Play modunda), tema geçişi, Play modunda footer
// paylaş/puanla. Veritabanı gerektirmez; form göndermez.
import { test, expect } from '@playwright/test';
import { collectPageErrors } from './helpers';

test.describe('@static app-ux', () => {
  for (const locale of ['en', 'tr'] as const) {
    test(`${locale}/login: şifre göster/gizle formu göndermeden type'ı değiştirir`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto(`/${locale}/login`);
      const input = page.locator('input[autocomplete="current-password"]');
      const toggle = page.getByTestId('password-toggle');
      await expect(input).toHaveAttribute('type', 'password');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle).toHaveAttribute('type', 'button');
      await input.fill('secret-123');
      const before = page.url();
      await toggle.click();
      await expect(input).toHaveAttribute('type', 'text');
      await expect(input).toHaveValue('secret-123');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(page.url()).toBe(before); // form gönderilmedi
      await toggle.click();
      await expect(input).toHaveAttribute('type', 'password');
      expect(errors).toEqual([]);
    });
  }

  test('eski /reset-password sayfasında da göster/gizle var', async ({ page }) => {
    await page.goto('/reset-password?token=e2e&lang=en');
    const first = page.locator('input[type="password"]').first();
    await expect(first).toBeVisible();
    const toggle = page.getByRole('button', { name: /show password/i });
    await toggle.click();
    await expect(page.locator('input[type="text"]')).toHaveCount(2); // iki alan birlikte açılır
    await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible();
  });

  test('tur web\'de kendiliğinden açılmaz', async ({ page }) => {
    await page.goto('/en/about');
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('onboarding')).toHaveCount(0);
  });

  test('tur Play modunda (?src=twa) ilk ziyarette açılır, atlanınca bir daha açılmaz', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/en/about?src=twa');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByText('Step 1 of 5')).toBeVisible();
    await page.getByTestId('onboarding-next').click();
    await expect(dialog.getByText('Step 2 of 5')).toBeVisible();
    await page.getByTestId('onboarding-back').click();
    await expect(dialog.getByText('Step 1 of 5')).toBeVisible();
    // Esc = atla
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('onboarding')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('fa-onboarding'))).toBe('skipped');
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('onboarding')).toHaveCount(0);
    // Play modunda footer'da paylaş/puanla/geri bildirim
    await expect(page.getByTestId('rate-app').first()).toHaveAttribute('href', 'market://details?id=pro.footballanalytics');
    await expect(page.getByTestId('share-app').first()).toBeVisible();
    await expect(page.getByTestId('send-feedback').first()).toHaveAttribute('href', '/contact?lang=en');
    expect(errors).toEqual([]);
  });

  test('tur sonuna kadar gidilince "done" yazılır', async ({ page }) => {
    await page.goto('/tr/about?src=twa');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) await page.getByTestId('onboarding-next').click();
    await expect(dialog.getByText('Adım 5 / 5')).toBeVisible();
    await page.getByTestId('onboarding-done').click();
    await expect(page.getByTestId('onboarding')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('fa-onboarding'))).toBe('done');
  });

  test('web\'de footer\'da Play düğmeleri yok', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page.getByTestId('rate-app')).toHaveCount(0);
  });

  test('tema geçişi data-theme yazar ve yenilemede kalır', async ({ page }) => {
    const vw = page.viewportSize()?.width ?? 0;
    test.skip(vw < 1024, 'tema düğmesi mobilde menü içinde');
    await page.goto('/en/about');
    const btn = page.getByRole('button', { name: /^Theme:/ }).first();
    await btn.click(); // system → light
    await expect(page.locator('.site')).toHaveAttribute('data-theme', 'light');
    await btn.click(); // light → dark
    await expect(page.locator('.site')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('.site')).toHaveAttribute('data-theme', 'dark');
  });
});
