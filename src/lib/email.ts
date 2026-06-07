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

export { SITE_URL };
