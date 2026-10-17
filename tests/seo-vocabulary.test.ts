import { test } from 'node:test';
import assert from 'node:assert/strict';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// SEO Faz 0.9 (2026-10-17): gambling-coded wording stays out of the anonymous
// surfaces — it is what ad platforms and search classify a site on. The site offers
// no betting and links to no bookmaker, so the responsible-gambling block is gone too.
test('anonymous surfaces carry no gambling-coded wording', () => {
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const key of ['v3.landing.tagline', 'v2.footer.line', 'v2.footer.compliance', 'v2.performance.lead', 'league.metaDescription']) {
      const v = (key.split('.').reduce((o, k) => o[k], m) as string).toLowerCase();
      assert.ok(!/18\+|begambleaware|gamcare/.test(v), `${name} ${key} carries gambling-coded wording`);
    }
    // The slip namespace ships to the client on every page (lib/site/messages.ts), so it must be clean too.
    assert.ok(!/18\+|bookmaker|buchmacher|bahisçi/i.test(JSON.stringify(m.slip)), `${name}: slip strings carry gambling-coded wording`);
    assert.equal(m.v2.footer.help, undefined, `${name}: responsible-gambling footer paragraph must be gone`);
  }
});
