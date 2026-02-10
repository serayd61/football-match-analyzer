import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}
const supabase = new Proxy({} as SupabaseClient, { get(_, p) { return (getSupabase() as any)[p]; } });

// Email gönderimi için Resend API veya SMTP kullanılabilir
// Şimdilik Supabase'e kayıt + webhook bildirimi kullanıyoruz

interface ContactBody {
  name: string;
  email: string;
  subject: string;
  type: string;
  message: string;
  rating: number;
}

export async function POST(request: Request) {
  try {
    const body: ContactBody = await request.json();
    const { name, email, subject, type, message, rating } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Supabase'e kaydet
    const { data: savedContact, error: saveError } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email,
        subject,
        type: type || 'general',
        message,
        rating: rating || null,
        status: 'new',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving contact:', saveError);
      // Tablo yoksa bile email göndermeye devam et
    }

    // Email gönder (Resend API)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (RESEND_API_KEY) {
      try {
        const typeEmojiMap: Record<string, string> = {
          general: '💬',
          bug: '🐛',
          feature: '💡',
          complaint: '😔',
          praise: '⭐',
        };
        const typeEmoji = typeEmojiMap[type] || '📬';

        const ratingStars = rating ? '⭐'.repeat(rating) : 'Belirtilmedi';

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⚽ Football AI - Yeni Mesaj</h1>
            </div>
            
            <div style="padding: 32px; color: #e2e8f0;">
              <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h2 style="color: #60a5fa; margin: 0 0 16px 0; font-size: 18px;">${typeEmoji} ${type === 'general' ? 'Genel Soru' : type === 'bug' ? 'Hata Bildirimi' : type === 'feature' ? 'Özellik Önerisi' : type === 'complaint' ? 'Şikayet' : 'Övgü'}</h2>
                <p style="margin: 0; color: #94a3b8;"><strong>Konu:</strong> ${subject}</p>
              </div>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155;">
                    <span style="color: #94a3b8;">👤 Gönderen</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155; text-align: right;">
                    <span style="color: #f1f5f9; font-weight: 600;">${name}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155;">
                    <span style="color: #94a3b8;">📧 E-posta</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155; text-align: right;">
                    <a href="mailto:${email}" style="color: #60a5fa; text-decoration: none;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155;">
                    <span style="color: #94a3b8;">⭐ Puanlama</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #334155; text-align: right;">
                    <span style="color: #fbbf24;">${ratingStars}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #94a3b8;">📅 Tarih</span>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <span style="color: #f1f5f9;">${new Date().toLocaleString('tr-TR')}</span>
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 24px; background: #1e293b; border-radius: 12px; padding: 20px;">
                <h3 style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 16px;">📝 Mesaj</h3>
                <p style="color: #cbd5e1; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              
              <div style="margin-top: 24px; text-align: center;">
                <a href="mailto:${email}?subject=Re: ${subject}" 
                   style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">
                  ↩️ Yanıtla
                </a>
              </div>
            </div>
            
            <div style="background: #0f172a; padding: 16px; text-align: center; border-top: 1px solid #334155;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">Football Match Analyzer © 2024</p>
            </div>
          </div>
        `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Football AI <onboarding@resend.dev>',
            to: ['info@swissdigital.life'],
            subject: `${typeEmoji} [Football AI] ${type === 'general' ? 'Yeni Mesaj' : type === 'bug' ? 'Hata Bildirimi' : type === 'feature' ? 'Özellik Önerisi' : type === 'complaint' ? 'Şikayet' : 'Övgü'}: ${subject}`,
            html: emailHtml,
            reply_to: email,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error('Resend error:', errorText);
        } else {
          console.log('Email sent successfully via Resend');
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Email hatası olsa bile başarılı dönüyoruz, mesaj kaydedildi
      }
    } else {
      // Resend API key yoksa, sadece Supabase'e kayıt yapılıyor
      console.log('RESEND_API_KEY not configured, message saved to database only');
      
      // Alternatif: Webhook ile bildirim gönder
      const WEBHOOK_URL = process.env.CONTACT_WEBHOOK_URL;
      if (WEBHOOK_URL) {
        try {
          await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🆕 Yeni İletişim Mesajı!\n\n👤 ${name}\n📧 ${email}\n📝 ${type}: ${subject}\n\n${message}`,
              name,
              email,
              subject,
              type,
              message,
              rating,
            }),
          });
        } catch (webhookError) {
          console.error('Webhook error:', webhookError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message received successfully',
      id: savedContact?.id || null,
    });

  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint - Admin için mesajları listele
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: data || [],
      count: data?.length || 0,
    });

  } catch (error) {
    console.error('Contact GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

