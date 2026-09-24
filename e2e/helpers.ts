import { expect, type Page } from '@playwright/test';

export const LOCALES = ['en', 'de', 'it', 'tr'] as const;

/** Sayfa yatay kaydırma üretmemeli (denetim P2: tablet taşması). */
export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(client + 1);
}

/** Next dev hata katmanı veya konsol hatası olmadan yüklenmeli. */
export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
