// ============================================================================
// BRIGHT DATA MCP TEST ENDPOINT
// Bright Data MCP entegrasyonunu test etmek için
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { dataProviderManager } from '@/lib/data-providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');
    const teamId = searchParams.get('teamId');
    const testType = searchParams.get('type') || 'fixture';
    
    if (testType === 'fixture' && fixtureId) {
      const result = await dataProviderManager.getFixture(parseInt(fixtureId));
      return NextResponse.json({
        success: true,
        test: 'getFixture',
        fixtureId: parseInt(fixtureId),
        result,
        providers: dataProviderManager.getProviders().map(p => ({
          name: p.name,
          priority: p.priority
        }))
      });
    }
    
    if (testType === 'team' && teamId) {
      const result = await dataProviderManager.getTeamStats(parseInt(teamId));
      return NextResponse.json({
        success: true,
        test: 'getTeamStats',
        teamId: parseInt(teamId),
        result,
        providers: dataProviderManager.getProviders().map(p => ({
          name: p.name,
          priority: p.priority
        }))
      });
    }
    
    // Provider listesi
    return NextResponse.json({
      success: true,
      message: 'Bright Data MCP Test Endpoint',
      providers: dataProviderManager.getProviders().map(p => ({
        name: p.name,
        priority: p.priority
      })),
      usage: {
        testFixture: '/api/bright-data-test?fixtureId=12345&type=fixture',
        testTeam: '/api/bright-data-test?teamId=123&type=team',
        listProviders: '/api/bright-data-test'
      }
    });
    
  } catch (error: any) {
    console.error('Bright Data test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

