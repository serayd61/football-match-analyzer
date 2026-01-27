// ============================================================================
// API VERIFICATION ENDPOINT
// Test all configured data sources and API keys
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface VerificationResult {
  service: string;
  status: 'ok' | 'error' | 'warning' | 'unconfigured';
  message: string;
  details?: any;
}

/**
 * GET /api/v3/test/verify
 * 
 * Verifies all API keys and data sources are configured correctly
 */
export async function GET(request: NextRequest) {
  const results: VerificationResult[] = [];
  let allOk = true;

  // Check 1: Sportmonks
  const sportmonksKey = process.env.SPORTMONKS_API_KEY;
  if (sportmonksKey) {
    try {
      const response = await fetch(
        `https://api.sportmonks.com/v3/football/fixtures?api_token=${sportmonksKey}&per_page=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (response.ok) {
        results.push({
          service: 'Sportmonks',
          status: 'ok',
          message: 'API key valid and responding',
        });
      } else if (response.status === 401) {
        results.push({
          service: 'Sportmonks',
          status: 'error',
          message: 'Invalid API key (401 Unauthorized)',
        });
        allOk = false;
      } else {
        results.push({
          service: 'Sportmonks',
          status: 'warning',
          message: `API returned status ${response.status}`,
        });
      }
    } catch (error: any) {
      results.push({
        service: 'Sportmonks',
        status: 'error',
        message: `Connection failed: ${error.message}`,
      });
      allOk = false;
    }
  } else {
    results.push({
      service: 'Sportmonks',
      status: 'error',
      message: 'SPORTMONKS_API_KEY environment variable not set',
    });
    allOk = false;
  }

  // Check 2: AI Models
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let aiConfigured = false;

  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        results.push({
          service: 'OpenAI',
          status: 'ok',
          message: 'API key valid',
        });
        aiConfigured = true;
      } else if (response.status === 401) {
        results.push({
          service: 'OpenAI',
          status: 'error',
          message: 'Invalid API key',
        });
      }
    } catch (error: any) {
      results.push({
        service: 'OpenAI',
        status: 'warning',
        message: `Connection timeout (may be network issue)`,
      });
    }
  }

  if (anthropicKey && !aiConfigured) {
    // Just check if key exists and isn't placeholder
    if (anthropicKey.startsWith('sk-ant-')) {
      results.push({
        service: 'Anthropic',
        status: 'ok',
        message: 'API key configured',
      });
      aiConfigured = true;
    } else {
      results.push({
        service: 'Anthropic',
        status: 'error',
        message: 'Invalid API key format',
      });
    }
  }

  if (geminiKey && !aiConfigured) {
    if (geminiKey.length > 20) {
      results.push({
        service: 'Google Gemini',
        status: 'ok',
        message: 'API key configured',
      });
      aiConfigured = true;
    } else {
      results.push({
        service: 'Google Gemini',
        status: 'error',
        message: 'Invalid API key',
      });
    }
  }

  if (!aiConfigured) {
    results.push({
      service: 'AI Model (OpenAI/Anthropic/Gemini)',
      status: 'error',
      message: 'No AI API key configured - analysis endpoint will not work',
    });
    allOk = false;
  }

  // Check 3: System Health
  results.push({
    service: 'System',
    status: 'ok',
    message: 'Football analyzer system is running',
    details: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    }
  });

  return NextResponse.json({
    success: allOk,
    status: allOk ? 'production-ready' : 'configuration-needed',
    verificationResults: results,
    summary: {
      passed: results.filter(r => r.status === 'ok').length,
      failed: results.filter(r => r.status === 'error').length,
      warnings: results.filter(r => r.status === 'warning').length,
    },
    nextSteps: allOk
      ? [
          'System is ready for production',
          'Test endpoint: GET /api/v3/test/live-fixture',
          'Analysis endpoint: POST /api/v3/analyze'
        ]
      : [
          'Configure missing API keys in .env.local',
          'Restart development server',
          'Run verification again'
        ],
    timestamp: new Date().toISOString()
  });
}
