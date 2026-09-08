import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createCheckoutSession, PLANS } from '@/lib/stripe';

// Yanıt metinleri istemcinin diliyle (login sayfası data.error'ı doğrudan gösterir).
const MSG = {
  tr: { required: 'E-posta ve şifre gerekli', short: 'Şifre en az 8 karakter olmalı', exists: 'Bu e-posta zaten kayıtlı', failed: 'Hesap oluşturulamadı', created: 'Hesap oluşturuldu! İlk 7 gün her şey açık.', generic: 'Bir hata oluştu' },
  en: { required: 'Email and password are required', short: 'The password must be at least 8 characters', exists: 'This email is already registered', failed: 'Could not create the account', created: 'Account created. Everything is open for the first 7 days.', generic: 'Something went wrong' },
  de: { required: 'E-Mail und Passwort sind erforderlich', short: 'Das Passwort muss mindestens 8 Zeichen haben', exists: 'Diese E-Mail ist bereits registriert', failed: 'Konto konnte nicht erstellt werden', created: 'Konto erstellt. Die ersten 7 Tage ist alles offen.', generic: 'Etwas ist schiefgelaufen' },
} as const;

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, lang } = await request.json();
    const L = lang === 'en' ? MSG.en : lang === 'de' ? MSG.de : MSG.tr;

    if (!email || !password) {
      return NextResponse.json({ error: L.required }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: L.short }, { status: 400 });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: L.exists }, { status: 400 });
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
      return NextResponse.json({ error: L.failed }, { status: 500 });
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
      message: L.created,
      redirectTo: '/dashboard',
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: MSG.tr.generic }, { status: 500 });
  }
}
