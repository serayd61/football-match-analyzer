import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate, aiProvider } = body;
    
    // 1. Get team statistics from Sportmonks
    const [homeTeamRes, awayTeamRes, h2hRes] = await Promise.all([
      fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics;venue`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics;venue`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=5`)
    ]);
    
    const homeTeam = await homeTeamRes.json();
    const awayTeam = await awayTeamRes.json();
    const h2h = await h2hRes.json();
    
    // Format H2H data
    const h2hMatches = (h2h.data || []).map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      return `${home?.name} ${homeScore}-${awayScore} ${away?.name}`;
    }).join(', ');
    
    // Build analysis prompt
    const prompt = `Futbol Maç Analizi:

**Maç:** ${homeTeamName} vs ${awayTeamName}
**Lig:** ${competition}
**Tarih:** ${matchDate}

**Ev Sahibi: ${homeTeamName}**
- Şehir: ${homeTeam.data?.city || 'Bilinmiyor'}
- Stadyum: ${homeTeam.data?.venue?.name || 'Bilinmiyor'} (Kapasite: ${homeTeam.data?.venue?.capacity || 'Bilinmiyor'})
- Kuruluş: ${homeTeam.data?.founded || 'Bilinmiyor'}

**Deplasman: ${awayTeamName}**
- Şehir: ${awayTeam.data?.city || 'Bilinmiyor'}
- Kuruluş: ${awayTeam.data?.founded || 'Bilinmiyor'}

**Son Karşılaşmalar (H2H):**
${h2hMatches || 'Veri yok'}

---

Bu maç için detaylı analiz yap:
1. **Maç Önizlemesi** - Her iki takımın genel durumu
2. **Güçlü/Zayıf Yönler** - Taktiksel analiz
3. **Tahmin** - MS sonucu, gol beklentisi (Üst/Alt 2.5)
4. **Bahis Önerisi** - En değerli bahis seçeneği ve güven yüzdesi
5. **Skor Tahmini** - Muhtemel skor

Türkçe ve detaylı yanıt ver.`;

    // Call OpenAI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Sen profesyonel bir futbol analisti ve bahis uzmanısın. Sportmonks verilerini kullanarak detaylı maç analizleri yapıyorsun. Her zaman Türkçe yanıt ver.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Analiz yapılamadı';
    
    return NextResponse.json({
      success: true,
      analysis,
      homeTeam: homeTeam.data,
      awayTeam: awayTeam.data,
      h2h: h2h.data
    });
    
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
