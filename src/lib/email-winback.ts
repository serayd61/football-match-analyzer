// ============================================================================
// Geri kazanım e-postası (win-back) — saf şablon (dış bağımlılık yok; önizleme
// ve test doğrudan çalıştırır). 2026-11-14. Seçim: lib/site/winback.ts,
// gönderim: api/cron/winback. Dil: İngilizce (diğer kampanyalarla aynı; profilde dil yok).
//
// İçerik sırası (kullanıcı isteği): o günün ücretsiz maçları (Telegram'da
// yayınlananla aynı liste) → karne → Pro (yıllık planın aylığa göre farkı) →
// "Android uygulamasında artık Google Play ile abone olunabiliyor".
// Konu ve giriş cümlesi adıma göre değişir; son adım bunun son mail olduğunu söyler.
// ============================================================================

export type WinbackLeg = {
  /** yerel saat, örn. "18:30" */ time: string;
  home: string; away: string; league: string;
  /** örn. "Over 2.5", "Benfica win" */ selection: string;
  /** model olasılığı, yüzde (0–100) */ modelPct: number;
};

export type WinbackEmailInput = {
  step: number; maxSteps: number;
  name?: string | null;
  /** örn. "14 November" */ dateLabel: string;
  /** saat dilimi etiketi, örn. "CET" */ tz: string;
  legs: WinbackLeg[];
  /** son 7 günün vitrin karnesi; <10 örnek → gösterilmez */
  stats: { n: number; won: number } | null;
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const usd = (n: number) => `$${n.toFixed(2)}`;

export function winbackSubject(i: Pick<WinbackEmailInput, 'step' | 'maxSteps' | 'legs' | 'savingPct'>): string {
  const n = i.legs.length;
  const free = `today's ${n === 1 ? 'free match' : `${n} free matches`}`;
  if (i.step >= i.maxSteps) return `Last note from us: ${free}, and how to come back`;
  if (i.step === 1) return `New: subscribe to Pro inside the Android app, plus ${free}`;
  if (i.step === 3 && i.savingPct) return `Yearly Pro costs ${i.savingPct}% less than paying monthly, plus ${free}`;
  return `${free.charAt(0).toUpperCase()}${free.slice(1)} from the model`;
}

function intro(i: WinbackEmailInput): string {
  if (i.step >= i.maxSteps) return 'this is the last of these notes. Your account stays open on the free view, and the public record stays open to everyone.';
  if (i.step === 1) return 'your free trial has ended, but the model keeps publishing. Here is what it rates today, free, and one piece of news for Android users.';
  return 'the model published today\'s free matches. Same list as in our Telegram channel.';
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
          <strong>${esc(l.home)} – ${esc(l.away)}</strong><br>
          <span style="font-size:12px;color:${MUTED}">${esc(l.league)}</span>
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};font-size:14px;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">
          ${esc(l.selection)}<br><span style="font-size:12px;color:${BRAND};font-weight:700">model ${Math.round(l.modelPct)}%</span>
        </td>
      </tr>`).join('');

  const statsHtml = i.stats && i.stats.n >= 10
    ? `<p style="margin:0 0 18px;font-size:14px;color:${INK}">Public record, last 7 days: <strong>${i.stats.won} of ${i.stats.n}</strong> correct (${Math.round((i.stats.won / i.stats.n) * 100)}%). Misses are published too.</p>`
    : '';

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:${INK}">
    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${BRAND}">Football Analytics Pro</p>
    <p style="margin:0 0 18px;font-size:12px;color:${MUTED}">Free matches · ${esc(i.dateLabel)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hi${hi}, ${intro(i)}</p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${LINE};border-radius:10px;border-collapse:separate;margin:0 0 8px">
      <tr><td colspan="3" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${MUTED}">Today's free matches · kick-off in ${esc(i.tz)}</td></tr>${rows}
    </table>
    <p style="margin:0 0 18px;font-size:12px;color:${MUTED}">The same list goes out every morning in our <a href="${i.telegramUrl}" style="color:${BRAND}">free Telegram channel</a>. Pro opens every match in every league the model rates.</p>
    ${statsHtml}
    <p style="margin:0 0 6px;font-size:15px;line-height:1.5">Pro is ${priceHtml}, cancel any time. ${esc(saving)}</p>
    ${promo ? `<p style="margin:0 0 6px;font-size:13px;color:${MUTED}">${esc(promo)}</p>` : ''}
    <p style="text-align:center;margin:20px 0"><a href="${i.pricingUrl}" style="background:${BRAND};color:#fff;text-decoration:none;padding:14px 30px;border-radius:10px;font-weight:700;display:inline-block">See Pro plans</a></p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f6f5;border-radius:10px;margin:0 0 18px"><tr><td style="padding:14px 16px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${INK}">New in the Android app: subscribe with Google Play</p>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${MUTED}">You can now buy Pro inside the app, billed through your Google Play account. Update the app first, then open Plans.</p>
      <a href="${i.playUrl}" style="font-size:13px;font-weight:700;color:${BRAND}">Update on Google Play →</a>
    </td></tr></table>

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
    `Today's free matches (${i.dateLabel}, kick-off in ${i.tz}):`,
    ...i.legs.map((l) => `${l.time}  ${l.home} – ${l.away} (${l.league}): ${l.selection}, model ${Math.round(l.modelPct)}%`),
    '',
    `Also every morning in our free Telegram channel: ${i.telegramUrl}`,
    i.stats && i.stats.n >= 10 ? `Public record, last 7 days: ${i.stats.won} of ${i.stats.n} correct.` : '',
    '',
    `Pro is ${priceText}, cancel any time. ${saving}`.trim(),
    promo,
    `Pro plans: ${i.pricingUrl}`,
    '',
    'New in the Android app: you can now buy Pro inside the app, billed through Google Play. Update the app first, then open Plans.',
    `Google Play: ${i.playUrl}`,
    '',
    last ? 'This was the last of these notes.' : `We send at most ${i.maxSteps} of these, one every 3 days (${i.step} of ${i.maxSteps}).`,
    'Predictions are probabilities, not guarantees. 18+. Nothing here is betting advice.',
    `Unsubscribe: ${i.unsubscribeUrl}`,
  ].filter((l, idx, a) => !(l === '' && a[idx - 1] === '')).join('\n');

  return { subject, html, text };
}
