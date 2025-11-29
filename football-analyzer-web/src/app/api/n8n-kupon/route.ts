import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TOP_LEAGUES = [8, 82, 564, 384, 301, 72, 462];

export async function GET() {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 3);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];
    
    const fixturesResponse = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=fixturesBetween:${dateFrom},${dateTo};leagues:${TOP_LEAGUES.join(',')}&include=participants;league&per_page=50`
    );
    const fixturesData = await fixturesResponse.json();
    const matches = fixturesData.data || [];
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true, matchCount: 0,
        telegramMessage: '⚽ Bugün ve önümüzdeki 3 günde büyük liglerde maç yok.'
      });
    }
    
    const formattedMatches = matches.map((m: any) => {
      const home = m.participants?.find((p: any) => p.meta?.location === 'home');
      const away = m.participants?.find((p: any) => p.meta?.location === 'away');
      return {
        league: m.league?.name || 'Unknown',
        homeTeam: home?.name || 'TBA',
        awayTeam: away?.name || 'TBA',
        date: m.starting_at
      };
    });
    
    const matchList = formattedMatches.map((m: any) => 
      `${m.league}: ${m.homeTeam} vs ${m.awayTeam} (${m.date?.split('T')[0]})`
    ).join('\n');
    
    const prompt = `Maçlar:\n${matchList}\n\n2 KUPON hazırla:\n🏆 GÜVENLİ (3-4 maç, oran 2-4)\n🎰 RİSKLİ (4-5 maç, oran 10-30)\nHer maç için tahmin, oran ve analiz yaz.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Sen profesyonel futbol analisti ve bahis uzmanısın. Türkçe yanıt ver.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Analiz yapılamadı';
    
    const tarih = today.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    return NextResponse.json({
      success: true,
      tarih,
      matchCount: formattedMatches.length,
      matches: formattedMatches,
      telegramMessage: `⚽ *GÜNLÜK KUPON*\n📅 ${tarih}\n📊 ${formattedMatches.length} maç (Sportmonks)\n\n━━━━━━━━━━━━━━━\n\n${analysis}\n\n━━━━━━━━━━━━━━━\n🤖 _AI Kupon Ajanı_\n📊 _Sportmonks Pro_`
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
