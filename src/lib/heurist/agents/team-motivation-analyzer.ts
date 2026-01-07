// ============================================================================
// TEAM MOTIVATION ANALYZER - Gemini API ile Gelişmiş Motivasyon Analizi
// %50 Performans (Form) + %50 Takım İçi Motivasyon (Haberler, Sakatlıklar)
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

export interface TeamMotivationAnalysis {
  performanceScore: number; // 0-100 (Form bazlı)
  teamMotivationScore: number; // 0-100 (Haberler, sakatlıklar, kadro bazlı)
  finalScore: number; // 0-100 (%50 performans + %50 motivasyon)
  trend: 'improving' | 'declining' | 'stable';
  reasoning: string;
  formGraph: string;
  injuries: string[];
  squadIssues: string[];
  newsImpact: string;
  motivationFactors: string[];
}

/**
 * Gemini API ile takım hakkında sakatlıklar, kadro dışı oyuncular, haberler analiz eder
 */
async function analyzeTeamContextWithGemini(
  teamName: string,
  league: string,
  language: 'tr' | 'en' | 'de' = 'tr'
): Promise<{
  injuries: string[];
  squadIssues: string[];
  newsImpact: string;
  motivationFactors: string[];
  motivationScore: number; // 0-100
}> {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ Gemini API key not found, using fallback');
    return {
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: [],
      motivationScore: 50
    };
  }

  const prompts = {
    tr: `Sen bir futbol analisti ve takım motivasyon uzmanısın. ${teamName} takımı hakkında şu bilgileri analiz et:

1. SAKATLIKLAR: Hangi önemli oyuncular sakat? (Yıldız oyuncular, golcüler, defans liderleri)
2. KADRO DURUMU: Kadro dışı oyuncular, cezalı oyuncular, transfer durumları
3. HABERLER: Son 1-2 haftadaki önemli haberler (hoca baskısı, transfer dedikoduları, takım içi sorunlar, başarı/hayal kırıklığı)
4. MOTİVASYON FAKTÖRLERİ: Takımın motivasyonunu artıran/azaltan faktörler

SADECE JSON formatında döndür:
{
  "injuries": ["Oyuncu 1 (pozisyon) - sakatlık tipi", "Oyuncu 2..."],
  "squadIssues": ["Kadro sorunu 1", "Kadro sorunu 2..."],
  "newsImpact": "Son haberlerin takım motivasyonuna etkisi (2-3 cümle)",
  "motivationFactors": ["Faktör 1", "Faktör 2", "Faktör 3"],
  "motivationScore": 65
}

motivationScore: 0-100 arası (0=çok kötü, 100=mükemmel motivasyon)
- Yıldız oyuncu sakatlığı: -15 puan
- Kadro sorunları: -10 puan
- Olumsuz haberler: -10 puan
- Olumlu haberler: +10 puan
- Transfer dedikoduları: -5 puan
- Hoca baskısı: -10 puan
- Başarı haberi: +15 puan`,

    en: `You are a football analyst and team motivation expert. Analyze ${teamName} team:

1. INJURIES: Which key players are injured? (Star players, scorers, defensive leaders)
2. SQUAD STATUS: Suspended players, transfer situations, squad issues
3. NEWS: Important news from last 1-2 weeks (coach pressure, transfer rumors, team issues, success/disappointment)
4. MOTIVATION FACTORS: Factors increasing/decreasing team motivation

Return ONLY JSON format:
{
  "injuries": ["Player 1 (position) - injury type", "Player 2..."],
  "squadIssues": ["Squad issue 1", "Squad issue 2..."],
  "newsImpact": "Impact of recent news on team motivation (2-3 sentences)",
  "motivationFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "motivationScore": 65
}

motivationScore: 0-100 (0=very bad, 100=excellent motivation)
- Star player injury: -15 points
- Squad issues: -10 points
- Negative news: -10 points
- Positive news: +10 points
- Transfer rumors: -5 points
- Coach pressure: -10 points
- Success news: +15 points`,

    de: `Du bist ein Fußballanalyst und Team-Motivationsexperte. Analysiere ${teamName} Team:

1. VERLETZUNGEN: Welche Schlüsselspieler sind verletzt?
2. KADERSTATUS: Gesperrte Spieler, Transfer-Situationen
3. NACHRICHTEN: Wichtige Nachrichten der letzten 1-2 Wochen
4. MOTIVATIONSFAKTOREN: Faktoren, die die Team-Motivation beeinflussen

Nur JSON-Format zurückgeben:
{
  "injuries": ["Spieler 1 (Position) - Verletzungstyp"],
  "squadIssues": ["Kaderproblem 1"],
  "newsImpact": "Auswirkung der Nachrichten auf Team-Motivation",
  "motivationFactors": ["Faktor 1", "Faktor 2"],
  "motivationScore": 65
}`
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompts[language] }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      console.error(`❌ Gemini API error: ${response.status}`);
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON extract
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ Gemini response is not JSON, using fallback');
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        injuries: parsed.injuries || [],
        squadIssues: parsed.squadIssues || [],
        newsImpact: parsed.newsImpact || '',
        motivationFactors: parsed.motivationFactors || [],
        motivationScore: Math.min(100, Math.max(0, parsed.motivationScore || 50))
      };
    } catch (e) {
      console.error('❌ Failed to parse Gemini JSON:', e);
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50
      };
    }
  } catch (error) {
    console.error('❌ Gemini API error:', error);
    return {
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: [],
      motivationScore: 50
    };
  }
}

/**
 * Performans skoru hesapla (Form bazlı - %50)
 */
function calculatePerformanceScore(
  formString: string,
  points: number
): {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  formGraph: string;
  reasoning: string;
} {
  if (!formString || formString.length === 0) {
    return {
      score: 50,
      trend: 'stable',
      formGraph: 'N/A',
      reasoning: 'Form verisi yetersiz'
    };
  }

  const last10Form = formString.slice(-10).split('').reverse();
  const formGraph = last10Form.join(' → ');

  const formPoints = last10Form.map((r: string) => {
    if (r === 'W') return 3;
    if (r === 'D') return 1;
    return 0;
  });

  const recent3Matches = formPoints.slice(0, 3);
  const previous3Matches = formPoints.slice(3, 6);
  
  const recentAvg = recent3Matches.reduce((a: number, b: number) => a + b, 0) / recent3Matches.length;
  const previousAvg = previous3Matches.length > 0 
    ? previous3Matches.reduce((a: number, b: number) => a + b, 0) / previous3Matches.length 
    : recentAvg;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > previousAvg + 0.3) trend = 'improving';
  else if (recentAvg < previousAvg - 0.3) trend = 'declining';

  const totalFormPoints = formPoints.reduce((a: number, b: number) => a + b, 0);
  const maxPossible = 10 * 3;
  const baseScore = (totalFormPoints / maxPossible) * 100; // 0-100

  let trendBonus = 0;
  if (trend === 'improving') {
    trendBonus = Math.min(15, (recentAvg - previousAvg) * 10);
  } else if (trend === 'declining') {
    trendBonus = Math.max(-15, (recentAvg - previousAvg) * 10);
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, baseScore + trendBonus)));

  const wins = last10Form.filter((r: string) => r === 'W').length;
  const draws = last10Form.filter((r: string) => r === 'D').length;
  const losses = last10Form.filter((r: string) => r === 'L').length;
  
  let reasoning = `Son 10 maç: ${wins}G-${draws}B-${losses}M (${totalFormPoints}/${maxPossible} puan)`;
  if (trend === 'improving') {
    reasoning += `. Son haftalarda performans artıyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else if (trend === 'declining') {
    reasoning += `. Son haftalarda performans düşüyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else {
    reasoning += `. Performans stabil (${recentAvg.toFixed(1)} puan/maç)`;
  }

  return {
    score: finalScore,
    trend,
    formGraph,
    reasoning
  };
}

/**
 * Ana fonksiyon: %50 Performans + %50 Takım İçi Motivasyon
 */
export async function analyzeTeamMotivation(
  teamName: string,
  formString: string,
  points: number,
  league: string,
  language: 'tr' | 'en' | 'de' = 'tr'
): Promise<TeamMotivationAnalysis> {
  // %50: Performans skoru (Form bazlı)
  const performance = calculatePerformanceScore(formString, points);

  // %50: Takım içi motivasyon skoru (Gemini API ile)
  const teamContext = await analyzeTeamContextWithGemini(teamName, league, language);

  // Final skor: %50 performans + %50 motivasyon
  const finalScore = Math.round(
    (performance.score * 0.5) + (teamContext.motivationScore * 0.5)
  );

  // Reasoning birleştir
  let reasoning = `${performance.reasoning}. `;
  if (teamContext.injuries.length > 0) {
    reasoning += `Sakatlıklar: ${teamContext.injuries.join(', ')}. `;
  }
  if (teamContext.squadIssues.length > 0) {
    reasoning += `Kadro sorunları: ${teamContext.squadIssues.join(', ')}. `;
  }
  if (teamContext.newsImpact) {
    reasoning += `Haberler: ${teamContext.newsImpact}`;
  }

  return {
    performanceScore: performance.score,
    teamMotivationScore: teamContext.motivationScore,
    finalScore,
    trend: performance.trend,
    reasoning,
    formGraph: performance.formGraph,
    injuries: teamContext.injuries,
    squadIssues: teamContext.squadIssues,
    newsImpact: teamContext.newsImpact,
    motivationFactors: teamContext.motivationFactors
  };
}

