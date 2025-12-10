import { NextResponse } from 'next/server';

const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const COMPETITIONS: { [key: string]: string } = {
  'PL': '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'PD': '🇪🇸 La Liga',
  'SA': '🇮🇹 Serie A',
  'BL1': '🇩🇪 Bundesliga',
  'FL1': '🇫🇷 Ligue 1',
  'CL': '🏆 Champions League',
  'EL': '🥇 Europa League'
};

export async function GET() {
  try {
    // 1. Maçları çek (bugün + 3 gün)
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 3);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];
    
    const matchesResponse = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&competitions=PL,PD,SA,BL1,FL1,CL,EL`,
      {
        headers: {
          'X-Auth-Token': FOOTBALL_API_KEY || '',
        },
        next: { revalidate: 300 } // 5 dakika cache
      }
    );
    
    if (!matchesResponse.ok) {
      throw new Error('Football API error');
    }
    
    const matchesData = await matchesResponse.json();
    const matches = matchesData.matches || [];
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        matchCount: 0,
        message: 'Bugün ve önümüzdeki 3 günde maç bulunamadı',
        guvenliKupon: null,
        riskliKupon: null
      });
    }
    
    // 2. Maçları formatla
    const formattedMatches = matches.map((m: any) => ({
      id: m.id,
      competition: COMPETITIONS[m.competition.code] || m.competition.name,
      competitionCode: m.competition.code,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      date: m.utcDate,
      matchday: m.matchday
    }));
    
    // 3. AI Analiz
    const matchList = formattedMatches.map((m: any) => 
      `${m.competition}: ${m.homeTeam} vs ${m.awayTeam} (${m.date.split('T')[0]})`
    ).join('\n');
    
    const prompt = `Bugün ve önümüzdeki 3 günün maçları:

${matchList}

Bana 2 FARKLI KUPON hazırla:

🏆 *GÜVENLİ KUPON* (Yüksek tutma şansı)
- 3-4 maç seç
- Sadece MS1, MS2 veya Üst/Alt 2.5 gibi basit bahisler
- Tahmini toplam oran: 2.00-4.00 arası
- Her maç için: Maç, Tahmin, Oran, Güven %

🎰 *RİSKLİ KUPON* (Yüksek kazanç potansiyeli)
- 4-5 maç seç
- Handikap, İY/MS, Skor tahmini gibi yüksek oranlı bahisler
- Tahmini toplam oran: 10.00-30.00 arası
- Her maç için: Maç, Tahmin, Oran, Risk analizi

Her kupon için toplam oran ve kısa strateji açıklaması yaz.`;

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
            content: 'Sen profesyonel futbol analisti ve bahis uzmanısın. Maçları analiz edip detaylı kupon önerileri sun. Türkçe yanıt ver.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Analiz yapılamadı';
    
    // 4. Tarih bilgisi
    const tarih = today.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return NextResponse.json({
      success: true,
      tarih,
      matchCount: formattedMatches.length,
      matches: formattedMatches,
      analysis,
      telegramMessage: `⚽ *GÜNLÜK KUPON ANALİZİ*
📅 ${tarih}
📊 ${formattedMatches.length} maç analiz edildi

━━━━━━━━━━━━━━━

${analysis}

━━━━━━━━━━━━━━━
🤖 _AI Kupon Ajanı_
🌐 _football-match-analyzer.vercel.app_
⚠️ _Bahis kararları sizin sorumluluğunuzdadır_`
    });
    
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Bir hata oluştu'
    }, { status: 500 });
  }
}

