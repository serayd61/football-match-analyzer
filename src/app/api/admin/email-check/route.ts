// Admin-only e-posta teşhisi (2026-09-08): şifre sıfırlama e-postaları
// "gönderildi" görünüyor ama gelmiyor şikayeti üzerine. Resend'in ham
// yanıtını ve gönderen adresi döner; yanlış alan / alıcı kısıtı burada görünür.
// Koruma: middleware (/api/admin/* → admin oturumu ya da Bearer ADMIN/CRON secret).
// Kullanım: GET /api/admin/email-check?to=adres@ornek.com
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to') || '';
  const from = process.env.EMAIL_FROM || 'Football Analytics Pro <onboarding@resend.dev>';
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, configured: false, from, error: 'RESEND_API_KEY missing' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ ok: false, configured: true, from, error: 'to= gerekli' }, { status: 400 });

  const resend = new Resend(key);
  const started = Date.now();
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: 'E-posta teşhisi — Football Analytics Pro',
      text: `Bu bir teşhis e-postasıdır (${new Date().toISOString()}). Gördüysen gönderim çalışıyor.`,
    });
    return NextResponse.json({ ok: !error, configured: true, from, to, ms: Date.now() - started, data, error });
  } catch (e: any) {
    return NextResponse.json({ ok: false, configured: true, from, to, ms: Date.now() - started, thrown: e?.message || String(e) });
  }
}
