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

export { SITE_URL };
