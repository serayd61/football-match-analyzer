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

export { SITE_URL };
