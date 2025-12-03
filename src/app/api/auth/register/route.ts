import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email ve şifre gerekli' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Şifre en az 8 karakter olmalı' }, { status: 400 });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Bu email zaten kullanılıyor' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (userError) {
      return NextResponse.json({ error: 'Kullanıcı oluşturulamadı' }, { status: 500 });
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    await supabaseAdmin.from('subscriptions').insert({
      user_id: newUser.id,
      status: 'trialing',
      plan: 'pro',
      trial_start: new Date().toISOString(),
      trial_end: trialEnd.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Hesap oluşturuldu!',
    });

  } catch (error) {
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}
