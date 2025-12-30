// ============================================================================
// BRIGHT DATA MCP TEST ENDPOINT
// Bright Data MCP entegrasyonunu test etmek için
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { dataProviderManager } from '@/lib/data-providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST: Direkt Bright Data API test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, zone = 'web_unlocker1', format = 'json' } = body;
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }
    
    const apiKey = process.env.BRIGHT_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'BRIGHT_DATA_API_KEY not set'
      }, { status: 500 });
    }
    
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone,
        url,
        format,
        method: 'GET',
        country: 'us'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `API Error ${response.status}`,
        details: errorText.substring(0, 500)
      }, { status: response.status });
    }
    
    let data;
    if (format === 'raw' || format === 'html') {
      const text = await response.text();
      data = { html: text, length: text.length };
    } else {
      data = await response.json();
    }
    
    return NextResponse.json({
      success: true,
      zone,
      format,
      url,
      data,
      responseSize: format === 'raw' || format === 'html' ? data.length : JSON.stringify(data).length
    });
    
  } catch (error: any) {
    console.error('Bright Data API test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');
    const teamId = searchParams.get('teamId');
    const testType = searchParams.get('type') || 'fixture';
    const directTest = searchParams.get('direct') === 'true';
    
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
    
    // Direkt API test (test URL ile)
    if (directTest) {
      const apiKey = process.env.BRIGHT_DATA_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          success: false,
          error: 'BRIGHT_DATA_API_KEY not set'
        }, { status: 500 });
      }
      
      try {
        const response = await fetch('https://api.brightdata.com/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zone: 'web_unlocker1',
            url: 'https://geo.brdtest.com/welcome.txt?product=unlocker&method=api',
            format: 'json'
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({
            success: false,
            error: `API Error ${response.status}`,
            details: errorText.substring(0, 500)
          }, { status: response.status });
        }
        
        const data = await response.json();
        return NextResponse.json({
          success: true,
          test: 'direct_api_test',
          zone: 'web_unlocker1',
          url: 'https://geo.brdtest.com/welcome.txt?product=unlocker&method=api',
          data
        });
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }
    
    // Provider listesi
    return NextResponse.json({
      success: true,
      message: 'Bright Data Test Endpoint',
      providers: dataProviderManager.getProviders().map(p => ({
        name: p.name,
        priority: p.priority
      })),
      usage: {
        testFixture: '/api/bright-data-test?fixtureId=12345&type=fixture',
        testTeam: '/api/bright-data-test?teamId=123&type=team',
        directApiTest: '/api/bright-data-test?direct=true',
        listProviders: '/api/bright-data-test',
        postTest: 'POST /api/bright-data-test with { url, zone, format }'
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

