// ============================================================================
// PUBLIC — Abonelikten çık (unsubscribe)
// İmzalı token ile e-postayı email_unsubscribes'a ekler. Tüm kampanyalar atlar.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from '@/lib/campaign';

export const dynamic = 'force-dynamic';

let sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase credentials yok');
    sb = createClient(url, key);
  }
  return sb;
}

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title></head>
  <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <div style="max-width:440px;padding:32px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">⚽</div>
      <h1 style="color:#10b981;font-size:20px;margin:0 0 12px">${title}</h1>
      <p style="color:#94a3b8;line-height:1.6">${body}</p>
      <a href="https://footballanalytics.pro" style="display:inline-block;margin-top:20px;color:#10b981">footballanalytics.pro →</a>
    </div>
  </body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').toLowerCase().trim();
  const token = searchParams.get('token') || '';

  if (!email || !verifyUnsubscribeToken(email, token)) {
    return page(
      'Geçersiz bağlantı · Invalid link',
      'Bu abonelikten çıkma bağlantısı geçersiz veya süresi dolmuş. · This unsubscribe link is invalid.'
    );
  }

  try {
    const supabase = getSupabase();
    await supabase.from('email_unsubscribes').upsert({ email }, { onConflict: 'email' });
  } catch {
    // best-effort
  }

  return page(
    'Abonelikten çıktın · Unsubscribed',
    `<strong>${email}</strong> artık pazarlama e-postası almayacak. Fikrini değiştirirsen footballanalytics.pro'dan tekrar başlayabilirsin.<br/><br/>You will no longer receive marketing emails.`
  );
}
