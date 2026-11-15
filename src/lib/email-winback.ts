// ============================================================================
// Geri kazanım e-postası (win-back) — saf şablon (dış bağımlılık yok; önizleme
// ve test doğrudan çalıştırır). 2026-11-14. Seçim: lib/site/winback.ts,
// gönderim: api/cron/winback. Dil: İngilizce (diğer kampanyalarla aynı; profilde dil yok).
//
// İçerik sırası (kullanıcı isteği): o günün ücretsiz maçları (Telegram'da
// yayınlananla aynı liste) → karne → Pro (yıllık planın aylığa göre farkı) →
// "Android uygulamasında artık Google Play ile abone olunabiliyor".
// Konu ve giriş cümlesi adıma göre değişir; son adım bunun son mail olduğunu söyler.
//
// 2026-11-14 (2): maç satırı artık maçın kendi sayfasına gider (o günün ücretsiz
// maçı süresi dolmuş üyeye tam açık, lib/site/free-today-rule.ts) ve mail, kişiye
// bir önceki mailde giden maçların sonucuyla açılır (`last`, kaybeden de yazılır;
// çoğunluğu tutan gün konu satırına çıkar). Kaynak: lib/site/winback-results.ts.
//
// 2026-11-15: maçsız sürüm (`legs` boş). Milli arada günlük liste 6 gün üst üste
// boş kaldı ve seri hiç başlayamadı; kullanıcı kararıyla İLK mail maçsız günde de
// gider. Asıl haber maça bağlı değil: Android uygulamasında Google Play ile
// abonelik. Bu sürümde maç tablosu yok, Android kutusu en üstte, altında "bugün
// ücretsiz maç yok" notu var. Hangi adımın maçsız gideceğine route karar verir.
// ============================================================================

export type WinbackLeg = {
  /** yerel saat, örn. "18:30" */ time: string;
  home: string; away: string; league: string;
  /** örn. "Over 2.5", "Benfica win" */ selection: string;
  /** model olasılığı, yüzde (0–100) */ modelPct: number;
  /** maçın tam analiz sayfası (bugün ücretsiz açık); yoksa satır bağlantısız */ url?: string | null;
};

/** Bir önceki mailde giden maçların sonucu. */
export type WinbackLast = {
  /** o mailin günü, örn. "11 November" */ dateLabel: string;
  n: number; won: number;
  rows: Array<{ home: string; away: string; label: string; score: string; won: boolean }>;
};

export type WinbackEmailInput = {
  step: number; maxSteps: number;
  name?: string | null;
  /** örn. "14 November" */ dateLabel: string;
  /** saat dilimi etiketi, örn. "CET" */ tz: string;
  legs: WinbackLeg[];
  /** son 7 günün vitrin karnesi; <10 örnek → gösterilmez */
  stats: { n: number; won: number } | null;
  /** önceki mailin sonucu; kayıt yoksa ya da maçlar bitmediyse null */ last?: WinbackLast | null;
  monthly: number;
  /** yıllık plan fiyatı; yoksa yalnız aylık yazılır */ yearly: number | null;
  /** yıllık planın 12 aylık ödemeye göre farkı (%) */ savingPct: number | null;
  /** aktif promosyon kodu (aylık, ilk 3 ay %50) */ promoCode: string | null;
  pricingUrl: string; matchesUrl: string; playUrl: string; telegramUrl: string; unsubscribeUrl: string;
};

const BRAND = '#0f7a4a';
const INK = '#131a17';
const MUTED = '#5b6660';
const LINE = '#e3e8e5';
const LOSS = '#b42318';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Çoğunluğu tutan gün konu satırına çıkar (lib/site/winback-results.isWinningDay ile aynı kural). */
const winning = (l: WinbackLast | null | undefined): l is WinbackLast => !!l && l.n > 0 && l.won * 2 > l.n;

export function winbackSubject(i: Pick<WinbackEmailInput, 'step' | 'maxSteps' | 'legs' | 'savingPct' | 'last'>): string {
  const n = i.legs.length;
  if (n === 0) {
    if (i.step >= i.maxSteps) return 'Last note from us, and how to come back';
    if (i.step === 3 && i.savingPct) return `Yearly Pro costs ${i.savingPct}% less than paying monthly`;
    return 'New: subscribe to Pro inside the Android app';
  }
  const free = `today's ${n === 1 ? 'free match' : `${n} free matches`}`;
  if (i.step >= i.maxSteps) return `Last note from us: ${free}, and how to come back`;
  if (winning(i.last)) return `Last time: ${i.last.won} of ${i.last.n} correct. ${free.charAt(0).toUpperCase()}${free.slice(1)} ${n === 1 ? 'is' : 'are'} open`;
  if (i.step === 1) return `New: subscribe to Pro inside the Android app, plus ${free}`;
  if (i.step === 3 && i.savingPct) return `Yearly Pro costs ${i.savingPct}% less than paying monthly, plus ${free}`;
  return `${free.charAt(0).toUpperCase()}${free.slice(1)} from the model`;
}

function intro(i: WinbackEmailInput): string {
  if (i.step >= i.maxSteps) return 'this is the last of these notes. Your account stays open on the free view, and the public record stays open to everyone.';
  if (!i.legs.length) return i.step === 1
    ? 'your free trial has ended, and there is one piece of news: Android users can now subscribe to Pro inside the app.'
    : 'a short note while the model has no free matches today.';
  if (i.step === 1) return 'your free trial has ended, but the model keeps publishing. Here is what it rates today, free, and one piece of news for Android users.';
  return 'the model published today\'s free matches. Each one opens in full with your account, no subscription needed.';
}

export function buildWinbackEmail(i: WinbackEmailInput): { subject: string; html: string; text: string } {
  const subject = winbackSubject(i);
  const hi = i.name ? ` ${esc(i.name)}` : '';
  const last = i.step >= i.maxSteps;
  const priceHtml = `<strong>${usd(i.monthly)}/month</strong>${i.yearly ? ` or <strong>${usd(i.yearly)}/year</strong>` : ''}`;
  const priceText = `${usd(i.monthly)}/month${i.yearly ? ` or ${usd(i.yearly)}/year` : ''}`;
  const saving = i.yearly && i.savingPct ? `The yearly plan costs ${i.savingPct}% less than twelve monthly payments.` : '';
  const promo = i.promoCode ? `Year-end offer on the monthly plan: code ${i.promoCode} takes 50% off your first 3 months (until 31 Dec 2026).` : '';

  const rows = i.legs.map((l) => `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top">${esc(l.time)}</td>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};font-size:14px;color:${INK}">
          ${l.url ? `<a href="${l.url}" style="color:${INK};text-decoration:none"><strong>${esc(l.home)} – ${esc(l.away)}</strong></a>` : `<strong>${esc(l.home)} – ${esc(l.away)}</strong>`}<br>
          <span style="font-size:12px;color:${MUTED}">${esc(l.league)}</span>${l.url ? `<br><a href="${l.url}" style="font-size:12px;font-weight:700;color:${BRAND};white-space:nowrap">Full analysis, free →</a>` : ''}
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};font-size:14px;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">
          ${esc(l.selection)}<br><span style="font-size:12px;color:${BRAND};font-weight:700">model ${Math.round(l.modelPct)}%</span>
        </td>
      </tr>`).join('');

  const linked = i.legs.some((l) => l.url);
  const prev = i.last && i.last.n > 0 ? i.last : null;
  const prevHead = prev ? `Last time · ${prev.dateLabel}: ${prev.won} of ${prev.n} correct` : '';
  const prevHtml = prev ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f6f5;border-radius:10px;margin:0 0 18px">
      <tr><td colspan="3" style="padding:12px 12px 6px;font-size:14px;font-weight:700;color:${INK}">${esc(prevHead)}</td></tr>${prev.rows.map((r) => `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:${INK}">${esc(r.home)} <strong style="white-space:nowrap">${esc(r.score)}</strong> ${esc(r.away)}</td>
        <td style="padding:6px 12px;font-size:13px;color:${MUTED};white-space:nowrap">${esc(r.label)}</td>
        <td style="padding:6px 12px;font-size:13px;font-weight:700;text-align:right;white-space:nowrap;color:${r.won ? BRAND : LOSS}">${r.won ? 'Correct' : 'Missed'}</td>
      </tr>`).join('')}
      <tr><td colspan="3" style="padding:4px 12px 12px;font-size:12px;color:${MUTED}">These are the matches from our previous email to you. Misses are shown the same way as hits.</td></tr>
    </table>` : '';

  const statsHtml = i.stats && i.stats.n >= 10
    ? `<p style="margin:0 0 18px;font-size:14px;color:${INK}">Public record, last 7 days: <strong>${i.stats.won} of ${i.stats.n}</strong> correct (${Math.round((i.stats.won / i.stats.n) * 100)}%). Misses are published too.</p>`
    : '';

  const noMatches = i.legs.length === 0;
  const NO_MATCH_NOTE = 'The model has no free matches today. On match days the free matches open in full with your account, and the same list goes out in our free Telegram channel.';
  const androidHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f6f5;border-radius:10px;margin:0 0 18px"><tr><td style="padding:14px 16px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${INK}">New in the Android app: subscribe with Google Play</p>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${MUTED}">You can now buy Pro inside the app, billed through your Google Play account. Update the app first, then open Plans.</p>
      <a href="${i.playUrl}" style="font-size:13px;font-weight:700;color:${BRAND}">Update on Google Play →</a>
    </td></tr></table>`;
  const matchesHtml = noMatches
    ? `${androidHtml}
    <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:${MUTED}">The model has no free matches today. On match days the free matches open in full with your account, and the same list goes out in our <a href="${i.telegramUrl}" style="color:${BRAND}">free Telegram channel</a>.</p>`
    : `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${LINE};border-radius:10px;border-collapse:separate;margin:0 0 8px">
      <tr><td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${MUTED}">Today's free matches · kick-off in ${esc(i.tz)}</td></tr>${rows}
    </table>
    <p style="margin:0 0 18px;font-size:12px;color:${MUTED}">${linked ? 'Sign in with your account and each of these opens in full today, free. ' : ''}The same list goes out every morning in our <a href="${i.telegramUrl}" style="color:${BRAND}">free Telegram channel</a>. Pro opens every match in every league the model rates.</p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:${INK}">
    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${BRAND}">Football Analytics Pro</p>
    <p style="margin:0 0 18px;font-size:12px;color:${MUTED}">${noMatches ? '' : 'Free matches · '}${esc(i.dateLabel)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hi${hi}, ${intro(i)}</p>
${prevHtml}${matchesHtml}
    ${statsHtml}
    <p style="margin:0 0 6px;font-size:15px;line-height:1.5">Pro is ${priceHtml}, cancel any time. ${esc(saving)}</p>
    ${promo ? `<p style="margin:0 0 6px;font-size:13px;color:${MUTED}">${esc(promo)}</p>` : ''}
    <p style="text-align:center;margin:20px 0"><a href="${i.pricingUrl}" style="background:${BRAND};color:#fff;text-decoration:none;padding:14px 30px;border-radius:10px;font-weight:700;display:inline-block">See Pro plans</a></p>

${noMatches ? '' : androidHtml}

    <p style="margin:0 0 4px;font-size:13px;color:${MUTED}"><a href="${i.matchesUrl}" style="color:${BRAND}">This week's matches</a> · Something in the way? Reply to this email, we read every reply.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;line-height:1.5">
      You get this because your free trial at footballanalytics.pro has ended. ${last ? 'This was the last one.' : `We send at most ${i.maxSteps} of these, one every 3 days (${i.step} of ${i.maxSteps}).`}<br>
      Predictions are probabilities, not guarantees. 18+. Nothing here is betting advice.<br>
      <a href="${i.unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>
    </p>
  </div>`;

  const text = [
    `Hi${i.name ? ` ${i.name}` : ''}, ${intro(i)}`,
    '',
    ...(prev ? [prevHead, ...prev.rows.map((r) => `${r.home} ${r.score} ${r.away}: ${r.label}, ${r.won ? 'correct' : 'missed'}`), ''] : []),
    ...(noMatches ? ['New in the Android app: you can now buy Pro inside the app, billed through Google Play. Update the app first, then open Plans.', `Google Play: ${i.playUrl}`, '', NO_MATCH_NOTE] : [`Today's free matches (${i.dateLabel}, kick-off in ${i.tz}):`]),
    ...i.legs.map((l) => `${l.time}  ${l.home} – ${l.away} (${l.league}): ${l.selection}, model ${Math.round(l.modelPct)}%${l.url ? `\n       Full analysis, free today: ${l.url}` : ''}`),
    '',
    `${noMatches ? 'Free Telegram channel' : 'Also every morning in our free Telegram channel'}: ${i.telegramUrl}`,
    i.stats && i.stats.n >= 10 ? `Public record, last 7 days: ${i.stats.won} of ${i.stats.n} correct.` : '',
    '',
    `Pro is ${priceText}, cancel any time. ${saving}`.trim(),
    promo,
    `Pro plans: ${i.pricingUrl}`,
    '',
    ...(noMatches ? [] : ['New in the Android app: you can now buy Pro inside the app, billed through Google Play. Update the app first, then open Plans.', `Google Play: ${i.playUrl}`, '']),
    last ? 'This was the last of these notes.' : `We send at most ${i.maxSteps} of these, one every 3 days (${i.step} of ${i.maxSteps}).`,
    'Predictions are probabilities, not guarantees. 18+. Nothing here is betting advice.',
    `Unsubscribe: ${i.unsubscribeUrl}`,
  ].filter((l, idx, a) => !(l === '' && a[idx - 1] === '')).join('\n');

  return { subject, html, text };
}
