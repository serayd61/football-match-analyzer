// src/app/api/debug/[fixtureId]/route.ts
import { fetchCompleteMatchData, fetchMatchDataByFixtureId } from '@/lib/heurist/sportmonks-data';

export async function GET(
  request: Request,
  { params }: { params: { fixtureId: string } }
) {
  const fixtureId = parseInt(params.fixtureId);
  
  try {
    const data = await fetchMatchDataByFixtureId(fixtureId);
    
    if (!data) {
      return Response.json({ error: 'Fixture not found' }, { status: 404 });
    }
    
    return Response.json({
      fixture: fixtureId,
      homeTeam: {
        name: data.homeTeam,
        id: data.homeTeamId,
        form: data.homeForm.form,
        record: data.homeForm.record,
        avgGoals: data.homeForm.avgGoalsScored,
        matches: data.homeForm.matchDetails.map(m => ({
          vs: m.opponent,
          score: m.score,
          result: m.result
        }))
      },
      awayTeam: {
        name: data.awayTeam,
        id: data.awayTeamId,
        form: data.awayForm.form,
        record: data.awayForm.record,
        avgGoals: data.awayForm.avgGoalsScored,
        matches: data.awayForm.matchDetails.map(m => ({
          vs: m.opponent,
          score: m.score,
          result: m.result
        }))
      },
      h2h: {
        total: data.h2h.totalMatches,
        homeWins: data.h2h.homeWins,
        awayWins: data.h2h.awayWins,
        draws: data.h2h.draws
      }
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
