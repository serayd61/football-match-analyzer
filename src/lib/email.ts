// ============================================================================
// Email sending via Resend
// ============================================================================
import { Resend } from 'resend';
import { SITE_URL } from '@/lib/seo';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Use a verified domain sender in production; falls back to Resend's shared
// onboarding sender (only deliverable to the account owner) for testing.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Football Analytics Pro <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  const resend = new Resend(RESEND_API_KEY);

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 12px">Football Analytics Pro</h2>
    <p>Şifreni sıfırlamak için bir talep aldık. Aşağıdaki butona tıklayarak yeni şifreni belirleyebilirsin:</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Şifremi Sıfırla</a>
    </p>
    <p style="font-size:13px;color:#64748b">Bu bağlantı 1 saat içinde geçerliliğini yitirir. Eğer bu talebi sen yapmadıysan bu e-postayı yok sayabilirsin; hesabın güvende.</p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all">Buton çalışmıyorsa: ${resetUrl}</p>
  </div>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Şifre sıfırlama talebi — Football Analytics Pro',
    html,
    text: `Şifreni sıfırlamak için: ${resetUrl} (bağlantı 1 saat geçerlidir). Bu talebi sen yapmadıysan yok say.`,
  });
}

/**
 * Ödeme başarısız (past_due) hatırlatma e-postası.
 * Trial sonrası veya yenileme tahsilatı başarısız olunca kullanıcıyı
 * kartını güncellemeye yönlendirir. manageUrl: Stripe billing portal linki
 * (yoksa /pricing'e düşülür). Best-effort: Resend yoksa sessizce çıkar.
 */
export async function sendPaymentFailedEmail(to: string, manageUrl: string): Promise<void> {
  if (!RESEND_API_KEY) return; // best-effort — yapılandırılmamışsa atla
  const resend = new Resend(RESEND_API_KEY);

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 12px">Football Analytics Pro</h2>
    <p><strong>Ödemen alınamadı.</strong> Kartından tahsilat başarısız oldu, bu yüzden Pro erişimin geçici olarak durduruldu. Devam etmek için kartını güncellemen yeterli.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${manageUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Kartımı Güncelle</a>
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#475569"><strong>Payment failed.</strong> We couldn't charge your card, so your Pro access is paused. Update your payment method to continue.</p>
    <p style="text-align:center;margin:20px 0">
      <a href="${manageUrl}" style="color:#059669;font-weight:600">Update payment method →</a>
    </p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all">${manageUrl}</p>
  </div>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Ödemen alınamadı — kartını güncelle · Payment failed',
    html,
    text: `Ödemen alınamadı, Pro erişimin durduruldu. Kartını güncelle: ${manageUrl}\n\nPayment failed, your Pro access is paused. Update your card: ${manageUrl}`,
  });
}

/**
 * Dünya Kupası 2026 lansman kampanyası — kayıtlı üyelere geri-kazanım e-postası.
 * Yeni istatistik motorunu + 7 gün ücretsiz trial'ı tanıtır. TR + EN.
 * Footer'da zorunlu unsubscribe linki. Best-effort: Resend yoksa hata fırlatır
 * (runner yakalar ve loglar).
 */
export async function sendWorldCupCampaignEmail(
  to: string,
  opts: { ctaUrl: string; unsubscribeUrl: string; name?: string | null }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { ctaUrl, unsubscribeUrl } = opts;
  const hi = opts.name ? `${opts.name}, ` : '';

  const btn = (label: string) =>
    `<p style="text-align:center;margin:24px 0"><a href="${ctaUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">${label}</a></p>`;
  const divider = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 18px">The World Cup is here · Die WM ist da · Dünya Kupası başladı</p>

    <!-- EN -->
    <p>Hi ${hi}we <strong>rebuilt the platform from the ground up</strong>. Match probabilities are now computed by a real <strong>statistical engine (Dixon-Coles)</strong> that learns from historical results — not fabricated.</p>
    <p>🏆 <strong>The World Cup is the perfect time</strong>: try our improved prediction page free during the tournament. First <strong>7 days free</strong>, cancel anytime.</p>
    ${btn('Try it free during the World Cup →')}

    ${divider}
    <!-- DE -->
    <p>Hallo ${hi}wir haben die Plattform <strong>von Grund auf neu aufgebaut</strong>. Spielwahrscheinlichkeiten werden jetzt von einer echten <strong>statistischen Engine (Dixon-Coles)</strong> berechnet, die aus historischen Ergebnissen lernt — nicht erfunden.</p>
    <p>🏆 <strong>Die WM ist der perfekte Moment</strong>: Teste unsere verbesserte Prognoseseite während des Turniers kostenlos. Die ersten <strong>7 Tage gratis</strong>, jederzeit kündbar.</p>
    ${btn('Während der WM kostenlos testen →')}

    ${divider}
    <!-- TR -->
    <p>Merhaba ${hi}sistemimizi <strong>baştan yeniledik</strong>. Artık maç olasılıkları, geçmiş maçlardan öğrenen gerçek bir <strong>istatistik motoruyla (Dixon-Coles)</strong> hesaplanıyor — uydurma değil.</p>
    <p>🏆 <strong>Dünya Kupası tam zamanı</strong>: yeni, geliştirilmiş tahmin sayfamızı turnuvada ücretsiz dene. İlk <strong>7 gün ücretsiz</strong>, dilediğin an iptal.</p>
    ${btn('Dünya Kupası\'nda Ücretsiz Dene →')}

    ${divider}
    <p style="font-size:11px;color:#94a3b8">
      You received this because you signed up at footballanalytics.pro · Du erhältst diese E-Mail, weil du dich bei footballanalytics.pro registriert hast · Bu e-postayı footballanalytics.pro'ya kayıtlı olduğun için aldın.<br/>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe / Abmelden / Abonelikten çık</a>
    </p>
  </div>`;

  const text = `Football Analytics Pro — World Cup 2026

[EN] We rebuilt the platform from the ground up: match probabilities now come from a real statistical engine (Dixon-Coles) that learns from historical results. Try our improved prediction page free during the World Cup — first 7 days free, cancel anytime.
${ctaUrl}

[DE] Wir haben die Plattform von Grund auf neu aufgebaut: Spielwahrscheinlichkeiten kommen jetzt von einer echten statistischen Engine (Dixon-Coles). Teste unsere verbesserte Prognoseseite während der WM kostenlos — die ersten 7 Tage gratis, jederzeit kündbar.
${ctaUrl}

[TR] Sistemimizi baştan yeniledik: maç olasılıkları artık gerçek bir istatistik motoruyla (Dixon-Coles) hesaplanıyor. Dünya Kupası'nda yeni tahmin sayfamızı ücretsiz dene — ilk 7 gün ücretsiz, dilediğin an iptal.
${ctaUrl}

Unsubscribe / Abmelden / Abonelikten çık: ${unsubscribeUrl}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: '🏆 The World Cup is here — try our rebuilt prediction engine free',
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  });
}

/**
 * Hoşgeldin e-postası — yeni ücretsiz kayıtlılara. İngilizce (talep gereği).
 * DÜRÜST konumlandırma: free = günde 3 AI analizi (Claude + DeepSeek + istatistik);
 * Pro = Dixon-Coles/xG/ELO tahmin motoru + sınırsız (7 gün deneme). Koşmayan model
 * ismi (GPT/Gemini) VAAT EDİLMEZ. Footer'da zorunlu unsubscribe.
 */
export async function sendWelcomeEmail(
  to: string,
  opts: { ctaUrl: string; pricingUrl: string; unsubscribeUrl: string; name?: string | null }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { ctaUrl, pricingUrl, unsubscribeUrl } = opts;
  const hi = opts.name ? `${opts.name}, ` : '';

  const btn = (href: string, label: string) =>
    `<p style="text-align:center;margin:22px 0"><a href="${href}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">${label}</a></p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 18px">Welcome aboard — your free analyses are ready</p>

    <p>Hi ${hi}welcome to <strong>Football Analytics Pro</strong> — your account is all set. 🎉</p>
    <p>You've got <strong>3 free AI match analyses every day</strong>, starting right now. No credit card, no catch.</p>

    <p style="margin:18px 0 6px"><strong>Each analysis gives you:</strong></p>
    <ul style="margin:0 0 8px;padding-left:20px;color:#334155">
      <li>🤖 An <strong>AI-powered breakdown</strong> (Claude + DeepSeek) reading team form, stats and context</li>
      <li>📊 <strong>Statistical modeling</strong> for real probabilities — calculated, not guessed</li>
      <li>⚽ Match result, over/under 2.5, both-teams-to-score, and the most likely scoreline</li>
    </ul>
    ${btn(ctaUrl, 'Analyze your first match →')}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />

    <p><strong>Want more?</strong> Go <strong>Pro</strong> for <strong>unlimited analyses</strong> plus our daily <strong>prediction engine</strong> — a Dixon-Coles model with expected goals and club ELO across the top-5 leagues. <strong>7-day free trial</strong>, cancel anytime.</p>
    ${btn(pricingUrl, 'Start your 7-day free trial →')}

    <p style="font-size:12px;color:#64748b;text-align:center;margin:18px 0 0">Informational only — not betting advice.</p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">
      You received this because you signed up at footballanalytics.pro.<br/>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>
    </p>
  </div>`;

  const text = `Football Analytics Pro — welcome!

Your account is ready. You've got 3 free AI match analyses every day, starting now — no credit card needed.

Each analysis: an AI-powered breakdown (Claude + DeepSeek) + statistical modeling → match result, over/under 2.5, both-teams-to-score and the most likely score.

Analyze your first match: ${ctaUrl}

Want more? Go Pro for unlimited analyses plus our daily prediction engine (Dixon-Coles + expected goals + club ELO) across the top-5 leagues. 7-day free trial, cancel anytime: ${pricingUrl}

Informational only — not betting advice.
Unsubscribe: ${unsubscribeUrl}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: '⚽ Welcome — your 3 free match analyses are ready',
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  });
}

/**
 * Re-engagement (win-back) e-postası — kayıtlı ama abone olmayan kullanıcılara,
 * yenilenen siteyi tekrar denemeye çağırır. SADECE İngilizce (talep gereği).
 * Dürüst konumlandırma: gerçek istatistik motoru + şeffaf track record, "garanti" YOK.
 * Footer'da zorunlu unsubscribe. Best-effort: Resend yoksa hata fırlatır (runner yakalar).
 */
export async function sendReengagementEmail(
  to: string,
  opts: { ctaUrl: string; unsubscribeUrl: string; trackUrl: string; name?: string | null }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { ctaUrl, unsubscribeUrl, trackUrl } = opts;
  const hi = opts.name ? ` ${opts.name}` : '';

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 18px">We rebuilt the platform — worth another look</p>

    <!-- HERO (e-posta-güvenli, tablo-tabanlı görsel — bloklanmaz) -->
    <a href="${ctaUrl}" style="text-decoration:none;display:block">
    <div style="background:#0d0f14;border:1px solid #1e2430;border-radius:16px;padding:18px 18px 16px;margin:0 0 22px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td style="font-size:13px;font-weight:700;color:#e7eaf0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">⚽ Football<span style="color:#34d399">Analytics</span></td>
        <td align="right"><span style="font-size:10px;font-weight:700;color:#6ee7b7;background:#10271f;border:1px solid #1f5e49;padding:4px 9px;border-radius:999px">DIXON-COLES</span></td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;font-size:14px;font-weight:700;color:#e7eaf0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><tr>
        <td>Arsenal</td><td align="center" style="color:#646c7d;font-size:11px;font-weight:600">VS</td><td align="right">Chelsea</td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:12px 0 7px;border-radius:6px;overflow:hidden"><tr>
        <td width="54%" height="9" style="background:#10b981;font-size:0;line-height:0">&nbsp;</td>
        <td width="26%" height="9" style="background:#f59e0b;font-size:0;line-height:0">&nbsp;</td>
        <td width="20%" height="9" style="background:#38bdf8;font-size:0;line-height:0">&nbsp;</td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:11px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><tr>
        <td style="color:#6ee7b7">1 · 54%</td><td align="center" style="color:#fcd34d">X · 26%</td><td align="right" style="color:#7dd3fc">2 · 20%</td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:13px"><tr>
        <td width="33%" style="padding-right:5px"><div style="background:#12151c;border:1px solid #1e2430;border-radius:9px;padding:7px 4px;text-align:center"><div style="font-size:13px;font-weight:700;color:#e7eaf0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">61%</div><div style="font-size:9px;color:#9aa3b2">Over 2.5</div></div></td>
        <td width="33%" style="padding:0 3px"><div style="background:#12151c;border:1px solid #1e2430;border-radius:9px;padding:7px 4px;text-align:center"><div style="font-size:13px;font-weight:700;color:#e7eaf0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">58%</div><div style="font-size:9px;color:#9aa3b2">BTTS</div></div></td>
        <td width="33%" style="padding-left:5px"><div style="background:#12151c;border:1px solid #1e2430;border-radius:9px;padding:7px 4px;text-align:center"><div style="font-size:13px;font-weight:700;color:#e7eaf0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">2–1</div><div style="font-size:9px;color:#9aa3b2">Top score</div></div></td>
      </tr></table>
    </div>
    </a>

    <p>Hi${hi}, you signed up at footballanalytics.pro a while ago but never got to see the new version.</p>
    <p>We <strong>rebuilt the prediction engine from scratch</strong>. Match probabilities now come from a real <strong>statistical model (Dixon-Coles)</strong> trained on thousands of historical results — computed mathematically, not made up. No "guaranteed wins," just <strong>transparent, honest data</strong> with a public track record you can check yourself.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${ctaUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">Explore the new site →</a>
    </p>
    <p style="font-size:14px;color:#475569;text-align:center;margin:0 0 24px">
      Curious how accurate it really is? <a href="${trackUrl}" style="color:#059669;font-weight:600">See our honest track record →</a>
    </p>
    <p style="font-size:13px;color:#64748b">Your first <strong>7 days are free</strong>, cancel anytime. Informational only — not betting advice.</p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">
      You received this because you signed up at footballanalytics.pro.<br/>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>
    </p>
  </div>`;

  const text = `Football Analytics Pro — we rebuilt the platform

Hi${hi}, you signed up at footballanalytics.pro a while ago but never got to see the new version.

We rebuilt the prediction engine from scratch. Match probabilities now come from a real statistical model (Dixon-Coles) trained on thousands of historical results — computed mathematically, not made up. No "guaranteed wins," just transparent, honest data with a public track record.

Explore the new site: ${ctaUrl}
See our honest track record: ${trackUrl}

Your first 7 days are free, cancel anytime. Informational only — not betting advice.

Unsubscribe: ${unsubscribeUrl}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'We rebuilt Football Analytics — worth another look?',
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  });
}

export { SITE_URL };
