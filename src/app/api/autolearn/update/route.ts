// ============================================================================
// POST /api/autolearn/update
// Yeni settled maclarla modeli incremental gunceller
// Settlement sonrasi otomatik cagrilir
// ============================================================================

import { NextResponse } from 'next/server';
import { updateModel } from '@/lib/autolearn/model';
import { serviceOnlyGuard } from '@/lib/api/dev-only';

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = serviceOnlyGuard(request);
  if (denied) return denied;
  try {
    console.log('🧠 AutoLearn: Update API called');

    let fixtureIds: number[] | undefined;

    try {
      const body = await request.json();
      fixtureIds = body.fixtureIds;
    } catch {
      // Body bos olabilir
    }

    const result = await updateModel(fixtureIds);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Model guncellendi! ${result.updated} mac islendi.`
    });
  } catch (error: any) {
    console.error('❌ AutoLearn Update Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Update failed'
    }, { status: 500 });
  }
}
