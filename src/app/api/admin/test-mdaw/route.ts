// ============================================================================
// TEST ENDPOINT - MDAW (Multi-Dimensional Adaptive Weighting)
// Yeni agent öğrenme sistemini test et
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  calculatePerformanceScore,
  calculatePerformanceMultiplier,
  calculateSpecializationBonus,
  calculateMomentumFactor,
  calculateCalibrationFactor,
  calculateWeightBounds,
  calculateAdvancedWeight,
  getAdvancedAgentWeights,
  getMarketSpecificWeights,
  analyzeAgentPerformance,
} from '@/lib/agent-learning/advanced-weighting';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league') || undefined;
    const agent = searchParams.get('agent') || 'stats';
    const testMode = searchParams.get('test') || 'full';

    console.log(`\n🧪 MDAW Test - Mode: ${testMode}, League: ${league || 'global'}, Agent: ${agent}`);

    const results: any = {
      success: true,
      timestamp: new Date().toISOString(),
      testMode,
      league: league || 'global',
      agent,
    };

    // Test 1: Formula Components
    if (testMode === 'full' || testMode === 'formulas') {
      console.log('\n📊 Testing MDAW Formula Components...');

      // Test Performance Score
      const testCases = [
        { accuracy: 70, calibration: 80, roi: 60 },
        { accuracy: 50, calibration: 50, roi: 50 },
        { accuracy: 30, calibration: 40, roi: 20 },
      ];

      results.formulaTests = testCases.map(tc => {
        const perfScore = calculatePerformanceScore(tc.accuracy, tc.calibration, tc.roi);
        const perfMult = calculatePerformanceMultiplier(perfScore);
        return {
          input: tc,
          performanceScore: perfScore.toFixed(2),
          performanceMultiplier: perfMult.toFixed(2),
        };
      });

      // Test Specialization Bonus
      results.specializationTests = [
        { league: 70, global: 50, market: 75 },
        { league: 50, global: 50, market: 50 },
        { league: 40, global: 60, market: 35 },
      ].map(tc => ({
        input: tc,
        bonus: calculateSpecializationBonus(tc.league, tc.global, tc.market).toFixed(2),
      }));

      // Test Momentum Factor
      results.momentumTests = [
        { recent: 80, historical: 50 },
        { recent: 50, historical: 50 },
        { recent: 30, historical: 60 },
      ].map(tc => ({
        input: tc,
        momentum: calculateMomentumFactor(tc.recent, tc.historical).toFixed(2),
      }));

      // Test Calibration Factor
      results.calibrationTests = [
        { confidence: 70, hitRate: 72 },
        { confidence: 80, hitRate: 60 },
        { confidence: 90, hitRate: 50 },
      ].map(tc => ({
        input: tc,
        factor: calculateCalibrationFactor(tc.confidence, tc.hitRate).toFixed(2),
      }));

      // Test Weight Bounds
      results.weightBoundsTests = [5, 20, 50, 100].map(matches => ({
        matches,
        bounds: calculateWeightBounds(matches),
      }));

      console.log('✅ Formula tests completed');
    }

    // Test 2: Real Agent Weights
    if (testMode === 'full' || testMode === 'weights') {
      console.log('\n📊 Testing Real Agent Weights...');

      // Single agent weight
      const singleWeight = await calculateAdvancedWeight(agent, league, 'matchResult');
      results.singleAgentWeight = singleWeight;

      // All agent weights
      const allWeights = await getAdvancedAgentWeights(league, 'matchResult');
      results.allAgentWeights = allWeights;

      // Market specific weights
      const marketWeights = await getMarketSpecificWeights(league);
      results.marketSpecificWeights = marketWeights;

      console.log('✅ Weight tests completed');
    }

    // Test 3: Agent Analysis
    if (testMode === 'full' || testMode === 'analysis') {
      console.log('\n📊 Testing Agent Analysis...');

      const analysis = await analyzeAgentPerformance(agent, league);
      results.agentAnalysis = analysis;

      console.log('✅ Analysis tests completed');
    }

    // Test 4: End-to-End Simulation
    if (testMode === 'simulation') {
      console.log('\n📊 Running End-to-End Simulation...');

      // Simüle edilmiş agent verileri
      const simulatedAgents = ['stats', 'odds', 'deepAnalysis', 'masterStrategist'];
      const simulationResults = [];

      for (const agentName of simulatedAgents) {
        const weight = await calculateAdvancedWeight(agentName, league, 'matchResult');
        simulationResults.push({
          agent: agentName,
          weight: weight.weight,
          performanceScore: weight.performanceScore,
          breakdown: weight.breakdown,
        });
      }

      // Ağırlıklı consensus simülasyonu
      const totalWeight = simulationResults.reduce((sum, r) => sum + r.weight, 0);
      const normalizedWeights = simulationResults.map(r => ({
        agent: r.agent,
        normalizedWeight: ((r.weight / totalWeight) * 100).toFixed(1) + '%',
        rawWeight: r.weight.toFixed(2),
      }));

      results.simulation = {
        agents: simulationResults,
        normalizedWeights,
        totalWeight: totalWeight.toFixed(2),
      };

      console.log('✅ Simulation completed');
    }

    results.duration = Date.now() - startTime;

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('❌ MDAW Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Test failed',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
