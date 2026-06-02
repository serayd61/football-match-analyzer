export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendPasswordResetEmail, isEmailConfigured, SITE_URL } from '@/lib/email';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  // Generic response — never reveal whether an email exists (anti-enumeration).
  const ok = NextResponse.json({
    success: true,
    message: 'Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi.',
  });

  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') return ok;
    const normalized = email.toLowerCase().trim();

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('email', normalized)
      .maybeSingle();

    // Only send if the user exists and email is configured.
    if (user && isEmailConfigured()) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

      const { error: insertError } = await supabase.from('password_reset_tokens').insert({
        email: normalized,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      if (!insertError) {
        const resetUrl = `${SITE_URL}/reset-password?token=${rawToken}`;
        try {
          await sendPasswordResetEmail(normalized, resetUrl);
        } catch (mailErr) {
          console.error('[forgot-password] email send failed:', mailErr);
        }
      } else {
        console.error('[forgot-password] token insert failed:', insertError);
      }
    } else if (user && !isEmailConfigured()) {
      console.warn('[forgot-password] RESEND_API_KEY not configured — cannot send reset email');
    }

    return ok;
  } catch (error) {
    console.error('[forgot-password] error:', error);
    return ok; // still generic
  }
}
