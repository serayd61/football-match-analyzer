// ============================================================================
// API: Test Claude API Connection
// Claude API'nin çalışıp çalışmadığını test eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Claude API...');
    
    // Check if API key exists
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY environment variable is missing',
        details: {
          hasKey: false,
          keyPrefix: null
        }
      }, { status: 400 });
    }

    const keyPrefix = ANTHROPIC_API_KEY.substring(0, 10) + '...';
    console.log(`   ✅ API Key found: ${keyPrefix}`);

    // Test with a simple prompt
    const testPrompt = 'Say "Hello" and respond with just the word "OK"';

    console.log('   📤 Sending test request to Claude...');
    const startTime = Date.now();
    
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: testPrompt }]
      })
    });

    const duration = Date.now() - startTime;
    const status = res.status;
    const statusText = res.statusText;

    console.log(`   📥 Response status: ${status} ${statusText} (${duration}ms)`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`   ❌ Claude API error:`, errorText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }

      return NextResponse.json({
        success: false,
        error: `Claude API returned error: ${status} ${statusText}`,
        details: {
          hasKey: true,
          keyPrefix,
          status,
          statusText,
          error: errorDetails,
          duration
        }
      }, { status: 500 });
    }

    const data = await res.json();
    const responseText = data.content?.[0]?.text || '';
    
    console.log(`   ✅ Claude responded: "${responseText}"`);

    return NextResponse.json({
      success: true,
      message: 'Claude API is working correctly!',
      details: {
        hasKey: true,
        keyPrefix,
        status,
        statusText,
        response: responseText,
        duration,
        model: 'claude-3-5-haiku-20241022',
        tokensUsed: {
          input: data.usage?.input_tokens || 0,
          output: data.usage?.output_tokens || 0
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: {
        hasKey: !!ANTHROPIC_API_KEY,
        keyPrefix: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 10) + '...' : null,
        exception: error.toString(),
        stack: error.stack
      }
    }, { status: 500 });
  }
}

