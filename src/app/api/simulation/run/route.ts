
import { NextRequest, NextResponse } from 'next/server';
import { runAgentAnalysis } from '@/lib/agent-analyzer';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFullFixtureData } from '@/lib/sportmonks/index';
import { savePrediction, updatePredictionResult } from '@/lib/predictions';

// Set timeout to 5 minutes for simulation
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fixtureId, simulateDate, saveToLearning = false } = body;

        if (!fixtureId) {
            return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
        }

        console.log(`🧪 SIMULATION STARTED: Fixture ${fixtureId}`);

        // 1. Fetch fixture data (Real data)
        // We assume this brings the "finished" state data if the match is done
        const fullData = await getFullFixtureData(fixtureId);

        if (!fullData) {
            return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
        }

        // 2. MASKING THE FUTURE (Hiding the result from Agents)
        // We must ensure agents don't see the final score in the prompt
        // The agent-analyzer logic might need an update to handle "simulationMode"
        // For this MVP, we will rely on the fact that agents analyze "Form" and "Stats" 
        // which are historical relative to the match start, mostly.
        // However, we must explicitly ensure current match score is not fed as "current score"

        // 3. Run Analysis
        // We inject a flag or used a clone of data to ensure no "future leaking"
        // Note: runAgentAnalysis calls Sportmonks internally. To do this properly, 
        // we would need to mock the data fetching or pass the data in.
        // For now, we will run it as is, but we'll compare the result.

        const result = await runAgentAnalysis(fixtureId, fullData.homeTeam.id, fullData.awayTeam.id, 'en');

        if (!result) {
            return NextResponse.json({ error: 'Agent analysis failed to produce a result' }, { status: 500 });
        }

        let accuracyReport = null;

        // 4. If match is actually finished, calculate accuracy immediately
        // 4. If match is actually finished, calculate accuracy immediately
        // Check rawData state/status
        const currentState = fullData.rawData?.state?.state;
        const currentStatus = fullData.rawData?.status;
        const resultInfo = fullData.rawData?.result_info;

        // Log for debugging
        console.log(`🔍 Fixture Status Check: state=${currentState}, status=${currentStatus}, resultInfo=${resultInfo}`);

        const isFinished =
            currentState === 'FT' ||
            currentState === 'AET' ||
            currentState === 'FT_PEN' ||
            currentState === 'FINISHED' ||
            currentStatus === 'FT' ||
            currentStatus === 'FINISHED' ||
            (resultInfo && resultInfo.includes('FT'));

        if (isFinished) {
            const scores = fullData.rawData?.scores || [];
            // Prioritize score with description "FT" (Full Time), fallback to "CURRENT"
            const homeScoreObj = scores.find((s: any) => s.description === 'FT' && s.score?.participant === 'home')
                || scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home');
            const awayScoreObj = scores.find((s: any) => s.description === 'FT' && s.score?.participant === 'away')
                || scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away');

            const homeGoals = homeScoreObj?.score?.goals ?? 0;
            const awayGoals = awayScoreObj?.score?.goals ?? 0;

            // Calculate Verification
            const prediction = result.matchResult?.prediction; // 1, X, 2 (or matchResult: 2 for away win)
            // Normalize prediction for comparison
            let normalizedPred = prediction?.toLowerCase() === 'away' ? '2' : prediction?.toLowerCase() === 'home' ? '1' : prediction;
            if (normalizedPred === '1' || normalizedPred === 'home') normalizedPred = '1';
            if (normalizedPred === '2' || normalizedPred === 'away') normalizedPred = '2';

            let actual = 'X';
            if (homeGoals > awayGoals) actual = '1';
            else if (awayGoals > homeGoals) actual = '2';

            const isCorrect = normalizedPred === actual;

            accuracyReport = {
                fixtureId,
                match: `${fullData.homeTeam.name} vs ${fullData.awayTeam.name}`,
                prediction,
                actual,
                isCorrect,
                confidence: result.matchResult?.confidence
            };

            console.log(`🧪 SIMULATION RESULT: ${isCorrect ? 'SUCCESS ✅' : 'FAILURE ❌'} (Pred: ${prediction}, Actual: ${actual})`);

            // 5. Save to Learning Context (Feedback Loop)
            if (saveToLearning) {
                // Here we would upsert into a "simulation_logs" table or update agent weights
                // For MVP, we use the standard prediction table but mark it as simulation if needed
                // Or we just rely on the existing 'predictions' table which stores accuracy
                // Let's assume we update the existing prediction record for this fixture
                await savePrediction({
                    fixtureId,
                    matchDate: fullData.rawData?.starting_at,
                    homeTeam: fullData.homeTeam.name,
                    awayTeam: fullData.awayTeam.name,
                    league: fullData.league.name,
                    reports: result.agents,
                    // ... map other fields
                } as any);

                await updatePredictionResult(fixtureId, homeGoals, awayGoals);
            }
        }

        return NextResponse.json({
            success: true,
            data: result,
            verification: accuracyReport,
            debug: {
                matchState: currentState || currentStatus,
                rawState: fullData.rawData?.state,
                resultInfo: resultInfo,
                scores: fullData.rawData?.scores
            }
        });

    } catch (error: any) {
        console.error('❌ Simulation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
