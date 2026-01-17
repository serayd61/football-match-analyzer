// ============================================================================
// SOCCERDATA TEST ENDPOINT
// Python script'i test et (eğer çalışıyorsa)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/test-soccerdata
 * 
 * Python script'inin çalışıp çalışmadığını test et
 * 
 * Not: Python script şu an ayrı bir servis olarak çalışmalı
 * Örnek: Flask/FastAPI servisi localhost:5000'de çalışıyor olmalı
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pythonServiceUrl = searchParams.get('url') || 'http://localhost:5000';

    const results: any = {
      timestamp: new Date().toISOString(),
      pythonServiceUrl,
      tests: {}
    };

    // Test 1: Python servisinin çalışıp çalışmadığını kontrol et
    try {
      const healthCheck = await fetch(`${pythonServiceUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 saniye timeout
      });

      if (healthCheck.ok) {
        const healthData = await healthCheck.json();
        results.tests.health = {
          success: true,
          status: healthData.status || 'ok',
          message: 'Python service is running'
        };
      } else {
        results.tests.health = {
          success: false,
          status: healthCheck.status,
          message: 'Python service responded but with error'
        };
      }
    } catch (error: any) {
      results.tests.health = {
        success: false,
        error: error.message,
        message: 'Python service is not running or not accessible',
        note: 'Make sure Python script is running as a service (Flask/FastAPI)'
      };
    }

    // Test 2: Fixtures endpoint'i test et
    if (results.tests.health?.success) {
      try {
        const fixturesResponse = await fetch(
          `${pythonServiceUrl}/api/fixtures/premier-league/2023-2024`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000) // 10 saniye timeout
          }
        );

        if (fixturesResponse.ok) {
          const fixturesData = await fixturesResponse.json();
          results.tests.fixtures = {
            success: true,
            count: fixturesData.length || 0,
            source: 'soccerdata',
            sample: fixturesData.slice(0, 3)
          };
        } else {
          results.tests.fixtures = {
            success: false,
            status: fixturesResponse.status,
            message: 'Fixtures endpoint returned error'
          };
        }
      } catch (error: any) {
        results.tests.fixtures = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 3: xG data test
    if (results.tests.health?.success) {
      try {
        const xgResponse = await fetch(
          `${pythonServiceUrl}/api/xg/premier-league/2023-2024`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
          }
        );

        if (xgResponse.ok) {
          const xgData = await xgResponse.json();
          results.tests.xg = {
            success: true,
            count: xgData.length || 0,
            source: 'soccerdata',
            sample: xgData.slice(0, 2)
          };
        } else {
          results.tests.xg = {
            success: false,
            status: xgResponse.status
          };
        }
      } catch (error: any) {
        results.tests.xg = {
          success: false,
          error: error.message
        };
      }
    }

    // Summary
    results.summary = {
      pythonServiceRunning: results.tests.health?.success || false,
      soccerDataAvailable: results.tests.fixtures?.success || false,
      recommendation: results.tests.health?.success
        ? 'Python service is running. SoccerData integration is active.'
        : 'Python service is not running. Start the Python script as a service (see docs/HYBRID_DATA_USAGE.md)'
    };

    return NextResponse.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('❌ SoccerData test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
