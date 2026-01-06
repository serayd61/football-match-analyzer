import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createCheckoutSession, PLANS } from '@/lib/stripe';

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

    // Free tier subscription kaydı oluştur
    await supabaseAdmin.from('subscriptions').insert({
      user_id: newUser.id,
      status: 'free',
      plan: 'free',
    });

    // Free tier profile oluştur
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7); // 7 gün sonra upgrade teşviki
    
    await supabaseAdmin.from('profiles').insert({
      email: email.toLowerCase(),
      subscription_status: 'free',
      trial_start_date: new Date().toISOString(),
      trial_ends_at: trialEnds.toISOString(), // Upgrade reminder için
      analyses_today: 0,
    });

    return NextResponse.json({
      success: true,
      message: 'Hesap oluşturuldu! Ücretsiz plan ile başlıyorsun.',
      redirectTo: '/dashboard',
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}
