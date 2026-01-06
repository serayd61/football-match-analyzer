// ============================================================================
// API: Get User Access Status
// GET /api/user/access-status
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    // Check access
    const access = await checkUserAccess(session.user.email, ip);

    return NextResponse.json({
      success: true,
      access
    });
    
  } catch (error: any) {
    console.error('Access status API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

