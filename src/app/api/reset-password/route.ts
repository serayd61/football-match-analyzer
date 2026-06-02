export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Confirm a password reset using a single-use, time-limited token that was
// emailed to the user by /api/forgot-password.
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Geçersiz veya eksik bağlantı.' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Şifre en az 8 karakter olmalı.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(token);

    const { data: row } = await supabase
      .from('password_reset_tokens')
      .select('id,email,expires_at,used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir sıfırlama isteyin.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updErr } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('email', row.email);

    if (updErr) {
      console.error('[reset-password] update error:', updErr);
      return NextResponse.json({ error: 'Şifre güncellenemedi.' }, { status: 500 });
    }

    // Single-use: mark token used and invalidate any other outstanding tokens.
    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('email', row.email)
      .is('used_at', null);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[reset-password] error:', error);
    return NextResponse.json({ error: 'Bir hata oluştu.' }, { status: 500 });
  }
}
