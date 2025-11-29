import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY || 'zEWnCOZJyy8fyfmu09FZOzCLSbLbiviuXUB3YgDbl3JCYjMIFHZg9K3TMrlA';

export async function GET() {
  try {
    // 1. Hesap bilgilerini kontrol et
    const myResponse = await fetch(
      `https://api.sportmonks.com/v3/my?api_token=${SPORTMONKS_API_KEY}`
    );
    const myData = await myResponse.json();
    
    // 2. Bugün ve önümüzdeki 3 günün maçlarını çek
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 3);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];
    
    // Fixtures with includes (teams, league, predictions, odds)
    const fixturesResponse = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=fixturesBetween:${dateFrom},${dateTo}&include=participants;league;predictions;odds`
    );
    const fixturesData = await fixturesResponse.json();
    
    // 3. Mevcut ligleri kontrol et
    const leaguesResponse = await fetch(
      `https://api.sportmonks.com/v3/football/leagues?api_token=${SPORTMONKS_API_KEY}`
    );
    const leaguesData = await leaguesResponse.json();
    
    return NextResponse.json({
      success: true,
      account: myData,
      fixtures: {
        count: fixturesData.data?.length || 0,
        data: fixturesData.data?.slice(0, 10) || [], // İlk 10 maç
        pagination: fixturesData.pagination
      },
      leagues: {
        count: leaguesData.data?.length || 0,
        available: leaguesData.data?.map((l: any) => ({
          id: l.id,
          name: l.name,
          country: l.country?.name
        })).slice(0, 20) || []
      },
      errors: {
        account: myData.error || null,
        fixtures: fixturesData.error || null,
        leagues: leaguesData.error || null
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
