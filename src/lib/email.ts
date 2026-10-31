// ============================================================================
// Email sending via Resend
// ============================================================================
import { Resend } from 'resend';
import { SITE_URL } from '@/lib/seo';
import { PLAN_PRICES } from '@/lib/site/plans';
import { buildPlayLaunchEmail } from '@/lib/email-play-launch';

// Fiyat metinleri tek kaynaktan (lib/site/plans.ts); e-postalarda sabit yazma.
const MONTHLY_PRICE = `$${PLAN_PRICES.monthly.amount.toFixed(2)}`;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Use a verified domain sender in production; falls back to Resend's shared
// onboarding sender (only deliverable to the account owner) for testing.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Football Analytics Pro <onboarding@resend.dev>';
// Destek kutusu: ImprovMX ile serayd6161@gmail.com'a yönlendirilir (DNS: MX mx1/mx2.improvmx.com, 2026-10-31).
export const SUPPORT_EMAIL = 'support@footballanalytics.pro';

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

const RESET_COPY = {
  tr: {
    subject: 'Şifre sıfırlama talebi — Football Analytics Pro',
    intro: 'Şifreni sıfırlamak için bir talep aldık. Aşağıdaki butona tıklayarak yeni şifreni belirleyebilirsin:',
    button: 'Şifremi Sıfırla',
    expiry: 'Bu bağlantı 1 saat içinde geçerliliğini yitirir. Eğer bu talebi sen yapmadıysan bu e-postayı yok sayabilirsin; hesabın güvende.',
    fallback: 'Buton çalışmıyorsa:',
    text: (url: string) => `Şifreni sıfırlamak için: ${url} (bağlantı 1 saat geçerlidir). Bu talebi sen yapmadıysan yok say.`,
  },
  en: {
    subject: 'Password reset request — Football Analytics Pro',
    intro: 'We received a request to reset your password. Click the button below to choose a new one:',
    button: 'Reset my password',
    expiry: 'This link expires in 1 hour. If you did not request this, you can ignore this email; your account is safe.',
    fallback: 'If the button does not work:',
    text: (url: string) => `Reset your password: ${url} (the link is valid for 1 hour). If you did not request this, ignore this email.`,
  },
  de: {
    subject: 'Passwort zurücksetzen — Football Analytics Pro',
    intro: 'Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button, um ein neues Passwort festzulegen:',
    button: 'Passwort zurücksetzen',
    expiry: 'Dieser Link ist 1 Stunde gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren; dein Konto ist sicher.',
    fallback: 'Falls der Button nicht funktioniert:',
    text: (url: string) => `Passwort zurücksetzen: ${url} (der Link ist 1 Stunde gültig). Falls du das nicht angefordert hast, ignoriere diese E-Mail.`,
  },
} as const;

export async function sendPasswordResetEmail(to: string, resetUrl: string, lang: 'tr' | 'en' | 'de' = 'tr'): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  const resend = new Resend(RESEND_API_KEY);
  const c = RESET_COPY[lang] || RESET_COPY.en;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 12px">Football Analytics Pro</h2>
    <p>${c.intro}</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">${c.button}</a>
    </p>
    <p style="font-size:13px;color:#64748b">${c.expiry}</p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all">${c.fallback} ${resetUrl}</p>
  </div>`;

  // Resend hata dönerse (alan doğrulanmamış, alıcı kısıtı vb.) fırlat: çağıran loglar.
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: c.subject,
    html,
    text: c.text(resetUrl),
  });
  if (error) throw new Error(`Resend: ${error.name || ''} ${error.message || JSON.stringify(error)}`);
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

  // Dil bilinmiyor (Stripe webhook): İngilizce önde, Türkçe kısa blok altta (31 Eki — önce TR başlıyordu).
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 12px">Football Analytics Pro</h2>
    <p><strong>Payment failed.</strong> We couldn't charge your card, so your Pro access is paused. Update your payment method to continue.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${manageUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Update payment method</a>
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#475569"><strong>Ödemen alınamadı.</strong> Kartından tahsilat başarısız oldu, bu yüzden Pro erişimin geçici olarak durduruldu. Devam etmek için kartını güncellemen yeterli.</p>
    <p style="text-align:center;margin:20px 0">
      <a href="${manageUrl}" style="color:#059669;font-weight:600">Kartımı güncelle →</a>
    </p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all">${manageUrl}</p>
  </div>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Payment failed — update your card · Ödemen alınamadı',
    html,
    text: `Payment failed, your Pro access is paused. Update your card: ${manageUrl}\n\nÖdemen alınamadı, Pro erişimin durduruldu. Kartını güncelle: ${manageUrl}`,
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
 * Kayıt = 7 gün tam erişim (2026-09-08 kararı); sonrası Pro. Koşmayan model
 * ismi VAAT EDİLMEZ. Footer'da zorunlu unsubscribe. Play rozeti (2026-10-31).
 */
export async function sendWelcomeEmail(
  to: string,
  opts: { ctaUrl: string; pricingUrl: string; unsubscribeUrl: string; name?: string | null; playUrl?: string; trialDays?: number }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { ctaUrl, pricingUrl, unsubscribeUrl } = opts;
  const days = opts.trialDays ?? 7;
  const hi = opts.name ? `${opts.name}, ` : '';

  const btn = (href: string, label: string) =>
    `<p style="text-align:center;margin:22px 0"><a href="${href}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">${label}</a></p>`;

  // 2026-10-31: metin ürünle hizalandı — kayıt = 7 gün TAM erişim (Eylül kararı),
  // "günde 3 ücretsiz analiz" değil. Model adı vaat edilmez ("AI opinion").
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 18px">Welcome — your ${days}-day full-access trial has started</p>

    <p>Hi ${hi}welcome to <strong>Football Analytics Pro</strong> — your account is all set.</p>
    <p>For the next <strong>${days} days everything is open</strong>: every rated match, the goal markets, the value radar and the public track record. No card on file, nothing to cancel.</p>

    <p style="margin:18px 0 6px"><strong>Every match page gives you:</strong></p>
    <ul style="margin:0 0 8px;padding-left:20px;color:#334155">
      <li>📊 <strong>Probabilities from a statistical model</strong> — match result, over/under 2.5, both teams to score — calculated, not guessed</li>
      <li>🎯 <strong>Confidence and risk</strong>: how often the same call landed before, in the same league and probability band</li>
      <li>🤖 An <strong>AI opinion</strong> on the matches that fit the record, written from the model's numbers</li>
    </ul>
    ${btn(ctaUrl, 'Open your dashboard →')}
    <p style="font-size:13px;color:#64748b;text-align:center;margin:-8px 0 0">The card at the top picks today's strongest call — start there.</p>

    ${trialPlay(opts.playUrl)}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />

    <p><strong>After the trial:</strong> Pro keeps everything open for <strong>${MONTHLY_PRICE}/month</strong>, cancel any time. Not for you? The account simply drops to the free view — the public record stays open.</p>
    ${btn(pricingUrl, 'See plans →')}

    <p style="font-size:12px;color:#64748b;text-align:center;margin:18px 0 0">Predictions are probabilities, not guarantees. 18+. Nothing here is betting advice.</p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">
      You received this because you signed up at footballanalytics.pro.<br/>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>
    </p>
  </div>`;

  const text = `Football Analytics Pro — welcome!

Your account is ready and your ${days}-day full-access trial has started: every rated match, the goal markets, the value radar and the public track record. No card on file.

Every match page: probabilities from a statistical model (match result, over/under 2.5, both teams to score), confidence and risk from the record, and an AI opinion on matches that fit the record.

Open your dashboard — the card at the top picks today's strongest call: ${ctaUrl}${opts.playUrl ? `\nAndroid app on Google Play: ${opts.playUrl}` : ''}

After the trial, Pro keeps everything open for ${MONTHLY_PRICE}/month, cancel any time: ${pricingUrl}

Predictions are probabilities, not guarantees. 18+. Not betting advice.
Unsubscribe: ${unsubscribeUrl}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Welcome — your ${days}-day full-access trial has started`,
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  });
  if (error) throw new Error(error.message);
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
    <p style="font-size:13px;color:#64748b">Your first <strong>7 days are free</strong>, then Pro is ${MONTHLY_PRICE}/month — cancel anytime. Informational only — not betting advice.</p>

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

Your first 7 days are free, then Pro is ${MONTHLY_PRICE}/month — cancel anytime. Informational only — not betting advice.

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

/**
 * ÖDEME TEKRAR DENEME — checkout'ta düşmüş kullanıcılar için.
 *
 * Neden dürüst bir kampanya: bu kişiler zaten ödemeye ÇALIŞMIŞ ve düşmüşlerdi.
 * Sebep bizdeydi — checkout'ta `request_three_d_secure: 'any'` zorunlu 3DS'i
 * tetikliyor, gerçek kartları reddettiriyordu (8 denemeden 6'sı başarısız).
 * 4 Ağustos 2026'da 'automatic'e çevrildi ve sonrasındaki ilk deneme başarılı
 * oldu. Yani söyleyecek gerçek bir şeyimiz var.
 *
 * ⚠️ İSABET/KARNE İDDİASI YOK — sezon başı rakamları bunu taşımıyor (bkz.
 * motor-kapsam-kalibrasyon). Mail tek bir şey vaat eder: ödeme artık çalışıyor.
 */
// ---------------------------------------------------------------------------
// YARIM KALAN KAYIT ("unfinished signup")
// Hedef: Ara 2025 – Oca 2026 arasında Pro'ya başlayıp checkout'u bitirmemiş 49
// kişi. Veri kontrolü (2026-08-25): bu satırların HİÇBİRİNDE
// stripe_customer_id / stripe_subscription_id / trial_end yok → Stripe'a hiç
// ulaşılmamış, yani kimseden PARA ÇEKİLMEDİ ve kimsenin kartı REDDEDİLMEDİ.
// Bu yüzden metin "ödemen başarısız oldu / bizim hatamızdı" DEMEZ (o hata —
// zorunlu 3DS — 29 Haz 2026'da doğdu, 4 Ağu'da kapandı; bu gruptan 6 ay
// SONRA). İsabet iddiası da taşımaz.
// ---------------------------------------------------------------------------
export async function sendUnfinishedSignupEmail(
  to: string,
  opts: {
    pricingUrl: string;
    dashboardUrl: string;
    unsubscribeUrl: string;
    name?: string | null;
  }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { pricingUrl, dashboardUrl, unsubscribeUrl } = opts;
  const hi = opts.name ? ` ${opts.name}` : '';

  const subject = 'You never finished signing up — and the price dropped since';

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px">You started a Pro signup a while back and never finished it.</p>

    <p>Hi${hi} — you began upgrading to Pro at footballanalytics.pro and stopped before checkout completed.
    <strong>Nothing was ever charged</strong>, and there is no subscription sitting on your account.</p>

    <div style="background:#0d0f14;border:1px solid #1e2430;border-radius:16px;padding:20px;margin:22px 0">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase">What changed since</div>
      <div style="font-size:14px;color:#cbd3e1;margin-top:12px;line-height:1.7">
        • Pro is now <strong>${MONTHLY_PRICE}/month</strong>, charged only when you subscribe — no trial card hold.<br/>
        • Predictions are now limited to the leagues our model is actually fitted on
          (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie, Championship and more),
          instead of padding the list with lower divisions.<br/>
        • Confidence numbers are recalibrated weekly against how those calls actually landed —
          so a "72%" means 72% of the time, not marketing.
      </div>
    </div>

    <p style="text-align:center;margin:28px 0 10px">
      <a href="${pricingUrl}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">Pick up where you left off — ${MONTHLY_PRICE}/month →</a>
    </p>
    <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 24px">Monthly is ${MONTHLY_PRICE}. Cancel anytime.</p>

    <p style="font-size:14px;color:#475569;text-align:center;margin:0 0 24px">
      Not ready to pay? Your free account gives you <strong>3 AI match analyses every day</strong> —
      <a href="${dashboardUrl}" style="color:#059669;font-weight:600">use them here →</a>
    </p>

    <p style="font-size:12px;color:#94a3b8">Probabilities come from a statistical model (Dixon-Coles + xG + ELO). Informational only — not betting advice. No outcome is guaranteed.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:11px;color:#94a3b8">
      You received this because you started a Pro signup at footballanalytics.pro.<br/>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>
    </p>
  </div>`;

  const text = `Football Analytics Pro — you never finished signing up

Hi${hi} — you began upgrading to Pro at footballanalytics.pro and stopped before checkout completed. Nothing was ever charged, and there is no subscription on your account.

What changed since:
- Pro is now ${MONTHLY_PRICE}/month, charged only when you subscribe.
- Predictions are limited to the leagues our model is actually fitted on (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie, Championship and more) instead of padding the list with lower divisions.
- Confidence numbers are recalibrated weekly against how those calls actually landed.

Pick up where you left off: ${pricingUrl}
Monthly is ${MONTHLY_PRICE}. Cancel anytime.

Not ready to pay? Your free account gives you 3 AI match analyses every day: ${dashboardUrl}

Informational only — not betting advice. No outcome is guaranteed.

Unsubscribe: ${unsubscribeUrl}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  });
}

export { SITE_URL };

// ============================================================================
// Deneme dönemi e-postaları (2026-09-26) — lib/site/trial-emails.ts seçer,
// api/cron/trial-emails gönderir. İngilizce (diğer kampanyalarla tutarlı).
// ============================================================================
export interface TrialEmailOpts {
  name?: string | null;
  daysLeft: number;
  /** son 7 günün vitrin karnesi; <10 örnek → gösterilmez */
  stats: { n: number; won: number } | null;
  predictionsUrl: string;
  pricingUrl: string;
  unsubscribeUrl: string;
  fullPrice: number;
  /** panel (first) */
  dashboardUrl?: string;
  /** Google Play (2026-10-30): tüm deneme maillerinde rozet */
  playUrl?: string;
  /** güçlü pazarlar (strong): pazar → en iyi ligler */
  strong?: Array<{ market: string; rows: Array<{ name: string; won: number; n: number }> }> | null;
}

function trialShell(title: string, sub: string, body: string, unsubscribeUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 6px">⚽ Football Analytics Pro</h2>
    <p style="font-size:13px;color:#64748b;margin:0 0 18px">${sub}</p>
    <h3 style="margin:0 0 14px;font-size:20px">${title}</h3>
    ${body}
    <p style="font-size:12px;color:#94a3b8;margin-top:28px">Predictions are probabilities, not guarantees. 18+. Nothing here is betting advice.<br>
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a></p>
  </div>`;
}
const trialBtn = (href: string, label: string) =>
  `<p style="text-align:center;margin:22px 0"><a href="${href}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;display:inline-block">${label}</a></p>`;
const trialPlay = (playUrl?: string) => playUrl
  ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:6px 0 18px"><tr><td align="center">
      <a href="${playUrl}" style="display:inline-block;background:#0d0f14;color:#e7eaf0;text-decoration:none;border:1px solid #1e2430;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600">▶&nbsp; Now on Google Play — get the Android app</a>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px">Same account, same predictions, kick-off reminders on your phone.</div>
    </td></tr></table>` : '';
const trialStats = (stats: { n: number; won: number } | null) => stats && stats.n >= 10
  ? `<div style="background:#0d0f14;border:1px solid #1e2430;border-radius:16px;padding:20px;margin:0 0 22px;text-align:center">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase">Last 7 days — public record</div>
      <div style="font-size:34px;font-weight:800;color:#e7eaf0;margin:8px 0 2px">${stats.won} / ${stats.n}</div>
      <div style="font-size:13px;color:#9aa3b2">showcase picks correct · ${Math.round((stats.won / stats.n) * 100)}%</div>
      <div style="font-size:11px;color:#646c7d;margin-top:8px">Wins and losses published daily — nothing hidden.</div>
    </div>` : '';

export async function sendTrialMidEmail(to: string, o: TrialEmailOpts): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const hi = o.name ? ` ${o.name}` : '';
  const subject = o.stats && o.stats.n >= 10
    ? `This week's record: ${o.stats.won} of ${o.stats.n} picks correct — ${o.daysLeft} trial days left`
    : `${o.daysLeft} trial days left — today's predictions are ready`;
  const body = `
    <p>Hi${hi}, you're ${o.daysLeft} days from the end of your free trial. Here is what the model actually did this week, with the misses included:</p>
    ${trialStats(o.stats)}
    <p>Every match page shows where the pick sits in our own track record — the same probability bucket, the same league, how often it landed before. Use the rest of your trial to check the goal markets (Over 2.5, Both teams to score): that's where the record is strongest.</p>
    ${trialBtn(o.predictionsUrl, "See today's predictions →")}
    ${trialPlay(o.playUrl)}
    <p style="font-size:13px;color:#64748b;text-align:center">Keep full access after the trial ($${o.fullPrice.toFixed(2)}/month, cancel any time): <a href="${o.pricingUrl}" style="color:#059669">Pro plans</a></p>`;
  const html = trialShell('Your trial, day by day', `Trial check-in · ${o.daysLeft} days left`, body, o.unsubscribeUrl);
  const text = `Hi${hi}, ${o.daysLeft} trial days left.${o.stats && o.stats.n >= 10 ? ` Last 7 days: ${o.stats.won}/${o.stats.n} showcase picks correct.` : ''}
Today's predictions: ${o.predictionsUrl}${o.playUrl ? `\nAndroid app on Google Play: ${o.playUrl}` : ''}
Pro plans ($${o.fullPrice.toFixed(2)}/month, cancel any time): ${o.pricingUrl}
Unsubscribe: ${o.unsubscribeUrl}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>` } });
  if (error) throw new Error(error.message);
}

export async function sendTrialEndingEmail(to: string, o: TrialEmailOpts): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const hi = o.name ? ` ${o.name}` : '';
  const when = o.daysLeft <= 1 ? 'tomorrow' : `in ${o.daysLeft} days`;
  const subject = `Your trial ends ${when} — keep full access`;
  const body = `
    <p>Hi${hi}, your free trial ends <strong>${when}</strong>. After that the predictions, the goal-model details and the value radar close for your account; the public track record stays open.</p>
    ${trialStats(o.stats)}
    <p>Pro is <strong>$${o.fullPrice.toFixed(2)}/month</strong>, cancel any time.</p>
    ${trialBtn(o.pricingUrl, 'Keep full access →')}
    ${trialPlay(o.playUrl)}
    <p style="font-size:13px;color:#64748b;text-align:center">Not for you? No action needed — the account simply drops to the free view.</p>`;
  const html = trialShell(`Your trial ends ${when}`, 'Trial ending', body, o.unsubscribeUrl);
  const text = `Hi${hi}, your free trial ends ${when}.${o.stats && o.stats.n >= 10 ? ` Last 7 days: ${o.stats.won}/${o.stats.n} showcase picks correct.` : ''}
Pro is $${o.fullPrice.toFixed(2)}/month, cancel any time. Keep access: ${o.pricingUrl}${o.playUrl ? `\nAndroid app on Google Play: ${o.playUrl}` : ''}
Unsubscribe: ${o.unsubscribeUrl}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>` } });
  if (error) throw new Error(error.message);
}

// Gün 1 (2026-10-30): tek iş — ilk maç sayfasını aç. Kayıttan sonra geri gelen 0 idi.
export async function sendTrialFirstEmail(to: string, o: TrialEmailOpts): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const hi = o.name ? ` ${o.name}` : '';
  const dash = o.dashboardUrl || o.predictionsUrl;
  const subject = `Your first match breakdown is waiting — ${o.daysLeft} trial days left`;
  const body = `
    <p>Hi${hi}, your trial is open for ${o.daysLeft} more days and the panel has one job for you today: <strong>open one match</strong>.</p>
    <p>At the top of your dashboard there is a card called <em>Start with today's strongest call</em>. It picks the single match where the model is most confident, and the page behind it shows the probabilities, the goal markets, how often the same call landed before, and an AI opinion.</p>
    ${trialBtn(dash, 'Open the match breakdown →')}
    ${trialStats(o.stats)}
    ${trialPlay(o.playUrl)}
    <p style="font-size:13px;color:#64748b;text-align:center">Everything stays unlocked during your trial. No card on file, nothing to cancel.</p>`;
  const html = trialShell('One match, fully explained', `Day 1 of your trial · ${o.daysLeft} days left`, body, o.unsubscribeUrl);
  const text = `Hi${hi}, ${o.daysLeft} trial days left. Open one match today: ${dash}${o.playUrl ? `\nAndroid app on Google Play: ${o.playUrl}` : ''}
Unsubscribe: ${o.unsubscribeUrl}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>` } });
  if (error) throw new Error(error.message);
}

// Gün 5 (2026-10-30): güçlü pazarlar — lig/pazar karnesi ≥%70 (dashboard "Market record" bloğu).
export async function sendTrialStrongEmail(to: string, o: TrialEmailOpts): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const hi = o.name ? ` ${o.name}` : '';
  const label: Record<string, string> = { x12: 'Match result (1X2)', ou25: 'Over 2.5 goals', under25: 'Under 2.5 goals', btts: 'Both teams to score' };
  const rows = (o.strong || []).flatMap((b) => b.rows.slice(0, 2).map((r) => `<tr><td style="padding:6px 0;border-bottom:1px solid #1e2430;color:#9aa3b2;font-size:12px">${label[b.market] || b.market}</td><td style="padding:6px 0;border-bottom:1px solid #1e2430;color:#e7eaf0;font-size:13px">${r.name}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #1e2430;color:#6ee7b7;font-size:13px;font-weight:700">${r.won}/${r.n} · ${Math.round((r.won / r.n) * 100)}%</td></tr>`));
  const table = rows.length
    ? `<div style="background:#0d0f14;border:1px solid #1e2430;border-radius:16px;padding:16px 18px;margin:0 0 22px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#6ee7b7;text-transform:uppercase;margin-bottom:8px">Strongest league–market pairs · last 180 days</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows.join('')}</table>
        <div style="font-size:11px;color:#646c7d;margin-top:8px">A pair counts as strong at ≥70% over at least 15 matches. Not a guarantee — a record of what happened in the same situation.</div>
      </div>`
    : trialStats(o.stats);
  const subject = `Where the model is strongest — ${o.daysLeft} trial days left`;
  const body = `
    <p>Hi${hi}, two days left on your trial. Most people look at the big 1X2 call; the record says the edge is somewhere else.</p>
    <p>These are the league–market pairs where the model has hit at least 70% over the last six months. When today's pick falls into one of these zones, the match page and your dashboard flag it as a <strong>strong zone</strong>.</p>
    ${table}
    ${trialBtn(o.predictionsUrl, "See today's strong-zone matches →")}
    ${trialPlay(o.playUrl)}
    <p style="font-size:13px;color:#64748b;text-align:center">Keep full access after the trial ($${o.fullPrice.toFixed(2)}/month, cancel any time): <a href="${o.pricingUrl}" style="color:#059669">Pro plans</a></p>`;
  const html = trialShell('Where the model is strongest', `Day 5 of your trial · ${o.daysLeft} days left`, body, o.unsubscribeUrl);
  const text = `Hi${hi}, ${o.daysLeft} trial days left. Strongest league-market pairs (180 days):
${(o.strong || []).flatMap((b) => b.rows.slice(0, 2).map((r) => `- ${label[b.market] || b.market}: ${r.name} ${r.won}/${r.n}`)).join('\n') || '(see the dashboard)'}
Today's predictions: ${o.predictionsUrl}${o.playUrl ? `\nAndroid app on Google Play: ${o.playUrl}` : ''}
Pro plans ($${o.fullPrice.toFixed(2)}/month): ${o.pricingUrl}
Unsubscribe: ${o.unsubscribeUrl}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>` } });
  if (error) throw new Error(error.message);
}

/**
 * Google Play lansman duyurusu (2026-10-30) — kayıtlı üyelere tek seferlik.
 * Şablon: src/lib/email-play-launch.ts (yalnızca İngilizce, QR + mağaza düğmesi).
 */
export async function sendPlayLaunchEmail(
  to: string,
  opts: { unsubscribeUrl: string; name?: string | null }
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { subject, html, text } = buildPlayLaunchEmail({
    playUrl: 'https://play.google.com/store/apps/details?id=pro.footballanalytics&utm_source=email&utm_medium=campaign&utm_campaign=play_launch',
    appPageUrl: `${SITE_URL}/en/app?utm_source=email&utm_medium=campaign&utm_campaign=play_launch`,
    qrImageUrl: `${SITE_URL}/images/app/google-play-qr.png`,
    iconUrl: `${SITE_URL}/images/app/app-icon-192.png`,
    unsubscribeUrl: opts.unsubscribeUrl,
    name: opts.name,
  });
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    // Yanıtlar gerçek bir kutuya düşsün (ImprovMX → Gmail, 2026-10-31); noreply'a cevap kaybolmasın.
    replyTo: SUPPORT_EMAIL,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${opts.unsubscribeUrl}>`,
      // RFC 8058: Gmail/Outlook tek tıkla abonelikten çıkma düğmesi (spam yerine unsubscribe → itibar korunur).
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Telegram tanıtımı (2026-10-31): yeni kayıtlara günlük seçimlerin kanalda
// otomatik yayınlandığını anlatan tek e-posta. İngilizce (site varsayılanı).
// ---------------------------------------------------------------------------
export async function sendTelegramIntroEmail(
  to: string,
  o: { telegramUrl: string; dashboardUrl: string; unsubscribeUrl: string; name?: string | null; playUrl?: string },
): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const hi = o.name ? ` ${o.name}` : '';
  const subject = 'Daily picks, posted automatically on Telegram';
  const body = `
    <p>Hi${hi}, one thing many members miss: the day's picks also go out on our <strong>Telegram channel</strong>, every morning, automatically.</p>
    <ul style="padding-left:18px;margin:0 0 16px;line-height:1.6">
      <li><strong>Coupon of the day</strong> — the two legs the validated rule selects, with odds.</li>
      <li><strong>Strong markets</strong> — league–market pairs with a ≥70% record over the last 180 days.</li>
      <li><strong>Results</strong> — every coupon is settled publicly, hit or miss, with the running record.</li>
    </ul>
    <p>No login needed, nothing to check manually: join once and the posts arrive. Posts are compact and visual; the picks and odds read the same in any language.</p>
    ${trialBtn(o.telegramUrl, 'Join the Telegram channel →')}
    <p style="font-size:13px;color:#64748b;text-align:center">Prefer the full breakdown? Your dashboard has every match: <a href="${o.dashboardUrl}" style="color:#059669">open the dashboard</a>.</p>
    ${trialPlay(o.playUrl)}`;
  const html = trialShell('Daily picks on Telegram', 'Free channel · posted every morning', body, o.unsubscribeUrl);
  const text = `Hi${hi}, the day's picks are posted automatically every morning on our Telegram channel: ${o.telegramUrl}
Coupon of the day (2 legs with odds), strong markets (>=70% record, 180 days) and public results.
Dashboard: ${o.dashboardUrl}${o.playUrl ? `\nAndroid app on Google Play: ${o.playUrl}` : ''}
Unsubscribe: ${o.unsubscribeUrl}`;
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, headers: { 'List-Unsubscribe': `<${o.unsubscribeUrl}>` } });
  if (error) throw new Error(error.message);
}

// Ops raporu (2026-10-31): site sahibine iç rapor; şablon ops-report.ts'te hazır gelir.
export async function sendOpsReportEmail(to: string, o: { subject: string; html: string; text: string }): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject: o.subject, html: o.html, text: o.text });
  if (error) throw new Error(error.message);
}
