// src/app/api/admin/professional-markets/route.ts
// Professional Betting Markets Stats API
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProfessionalMarketStats } from '@/lib/admin/enhanced-service';

// Admin emails
const ADMIN_EMAILS = ['serayd61@hotmail.com', 'info@swissdigital.life'];

// ═══════════════════════════════════════════════════════════════════════════
// GET - Fetch Professional Market Stats
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Fetching professional market stats...');

    const stats = await getProfessionalMarketStats();

    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Professional Markets API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

