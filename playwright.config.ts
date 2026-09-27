import { defineConfig, devices } from '@playwright/test';

// İki mod:
//  • E2E_BASE_URL verilmezse: yerel `next dev` başlatılır, yalnız veritabanı
//    gerektirmeyen testler (@static) koşar. CI bu moddadır (secret yok).
//  • E2E_BASE_URL=https://footballanalytics.pro (veya bir Vercel preview):
//    sunucu başlatılmaz, @data testleri de koşar. Salt okuma — form göndermez.
const external = process.env.E2E_BASE_URL;
const port = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  grepInvert: external ? undefined : /@data/,
  use: {
    baseURL: external || `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx next dev -p ${port}`,
        url: `http://localhost:${port}/en/about`,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: {
          // Sahte, erişilemeyen adresler: @static testler DB'ye ihtiyaç duymaz.
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:9',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'e2e',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'e2e',
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'e2e-secret',
          NEXTAUTH_URL: `http://localhost:${port}`,
          CRON_SECRET: 'e2e-cron-secret',
          NEXT_TELEMETRY_DISABLED: '1',
        },
      },
});
