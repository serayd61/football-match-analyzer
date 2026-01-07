// ============================================================================
// TEAM MOTIVATION ANALYZER - Gemini API ile Gelişmiş Motivasyon Analizi
// %50 Performans (Form) + %50 Takım İçi Motivasyon (Haberler, Sakatlıklar)
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

export interface TeamMotivationAnalysis {
  performanceScore: number; // 0-100 (Form bazlı - referans için)
  teamMotivationScore: number; // 0-100 (Agent'ın oluşturduğu skor)
  finalScore: number; // 0-100 (Agent'ın oluşturduğu final skor - aynı değer)
  trend: 'improving' | 'declining' | 'stable';
  reasoning: string; // Agent'ın açıklaması
  formGraph: string;
  injuries: string[];
  squadIssues: string[];
  newsImpact: string;
  motivationFactors: string[];
}

/**
 * Gemini API ile takım hakkında sakatlıklar, kadro dışı oyuncular, haberler analiz eder
 * 3 VERİYİ DEĞERLENDİRİP TEK MOTİVASYON SKORU oluşturur
 */
async function analyzeTeamContextWithGemini(
  teamName: string,
  league: string,
  language: 'tr' | 'en' | 'de' = 'tr',
  formString: string = '',
  points: number = 0,
  trend: 'improving' | 'declining' | 'stable' = 'stable'
): Promise<{
  injuries: string[];
  squadIssues: string[];
  newsImpact: string;
  motivationFactors: string[];
  motivationScore: number; // 0-100 (Agent'ın oluşturduğu final skor)
  reasoning: string;
}> {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ Gemini API key not found, using fallback');
    return {
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: [],
      motivationScore: 50,
      reasoning: 'Gemini API key bulunamadı, fallback kullanıldı'
    };
  }

  const prompts = {
    tr: `Sen bir futbol analisti ve takım motivasyon uzmanısın. ${teamName} takımı için 3 VERİYİ DEĞERLENDİR ve TEK BİR MOTİVASYON SKORU (0-100) oluştur:

═══════════════════════════════════════════════════════════════════════════════
📊 VERİ 1: PERFORMANS (Form Analizi)
═══════════════════════════════════════════════════════════════════════════════
Son 10 maç formu: ${formString || 'N/A'}
Form puanı: ${points || 0}/30
Trend: ${trend || 'stable'}

═══════════════════════════════════════════════════════════════════════════════
🏥 VERİ 2: SAKATLIKLAR & KADRO DURUMU
═══════════════════════════════════════════════════════════════════════════════
Takım hakkında güncel sakatlık, kadro dışı oyuncu, cezalı oyuncu ve transfer durumlarını araştır.

═══════════════════════════════════════════════════════════════════════════════
📰 VERİ 3: HABERLER & TAKIM İÇİ DURUM
═══════════════════════════════════════════════════════════════════════════════
Son 1-2 haftadaki önemli haberler: Hoca baskısı, takım içi sorunlar, başarı/hayal kırıklığı, transfer dedikoduları, taraftar tepkisi.

═══════════════════════════════════════════════════════════════════════════════
🎯 GÖREV: Bu 3 VERİYİ DEĞERLENDİR ve TEK BİR MOTİVASYON SKORU (0-100) oluştur
═══════════════════════════════════════════════════════════════════════════════

Hesaplama Mantığı:
- Performans (Form): 0-100 arası (form puanına göre)
- Sakatlıklar & Kadro: -20 (kritik oyuncu sakat) ile +10 (kadro tam) arası
- Haberler & Durum: -20 (çok olumsuz) ile +20 (çok olumlu) arası

FİNAL SKOR = Performans + Sakatlık/Kadro Etkisi + Haber Etkisi
(0-100 arası normalize et)

SADECE JSON formatında döndür:
{
  "motivationScore": 65,
  "reasoning": "Kısa açıklama: Performans X, sakatlıklar Y, haberler Z → Final skor 65",
  "injuries": ["Önemli sakatlıklar (max 3)"],
  "squadIssues": ["Kadro sorunları (max 2)"],
  "newsImpact": "Haberlerin kısa özeti (1 cümle)"
}

ÖNEMLİ: Sadece motivationScore ve reasoning'e odaklan. Detaylar opsiyonel.`,

    en: `You are a football analyst and team motivation expert. Evaluate 3 DATA POINTS for ${teamName} and create a SINGLE MOTIVATION SCORE (0-100):

═══════════════════════════════════════════════════════════════════════════════
📊 DATA 1: PERFORMANCE (Form Analysis)
═══════════════════════════════════════════════════════════════════════════════
Last 10 matches form: ${formString || 'N/A'}
Form points: ${points || 0}/30
Trend: ${trend || 'stable'}

═══════════════════════════════════════════════════════════════════════════════
🏥 DATA 2: INJURIES & SQUAD STATUS
═══════════════════════════════════════════════════════════════════════════════
Research current injuries, suspended players, transfer situations for this team.

═══════════════════════════════════════════════════════════════════════════════
📰 DATA 3: NEWS & TEAM SITUATION
═══════════════════════════════════════════════════════════════════════════════
Important news from last 1-2 weeks: Coach pressure, team issues, success/disappointment, transfer rumors, fan reactions.

═══════════════════════════════════════════════════════════════════════════════
🎯 TASK: Evaluate these 3 DATA POINTS and create a SINGLE MOTIVATION SCORE (0-100)
═══════════════════════════════════════════════════════════════════════════════

Calculation Logic:
- Performance (Form): 0-100 based on form points
- Injuries & Squad: -20 (critical player injured) to +10 (full squad)
- News & Situation: -20 (very negative) to +20 (very positive)

FINAL SCORE = Performance + Injury/Squad Impact + News Impact
(Normalize to 0-100)

Return ONLY JSON format:
{
  "motivationScore": 65,
  "reasoning": "Brief explanation: Performance X, injuries Y, news Z → Final score 65",
  "injuries": ["Important injuries (max 3)"],
  "squadIssues": ["Squad issues (max 2)"],
  "newsImpact": "Brief news summary (1 sentence)"
}

IMPORTANT: Focus on motivationScore and reasoning. Details are optional.`,

    de: `Du bist ein Fußballanalyst und Team-Motivationsexperte. Bewerte 3 DATENPUNKTE für ${teamName} und erstelle einen EINZIGEN MOTIVATIONSSKOR (0-100):

═══════════════════════════════════════════════════════════════════════════════
📊 DATEN 1: LEISTUNG (Form-Analyse)
═══════════════════════════════════════════════════════════════════════════════
Letzte 10 Spiele Form: ${formString || 'N/A'}
Form-Punkte: ${points || 0}/30
Trend: ${trend || 'stable'}

═══════════════════════════════════════════════════════════════════════════════
🏥 DATEN 2: VERLETZUNGEN & KADERSTATUS
═══════════════════════════════════════════════════════════════════════════════
Recherchiere aktuelle Verletzungen, gesperrte Spieler, Transfer-Situationen.

═══════════════════════════════════════════════════════════════════════════════
📰 DATEN 3: NACHRICHTEN & TEAM-SITUATION
═══════════════════════════════════════════════════════════════════════════════
Wichtige Nachrichten der letzten 1-2 Wochen: Trainer-Druck, Team-Probleme, Erfolg/Enttäuschung, Transfer-Gerüchte.

═══════════════════════════════════════════════════════════════════════════════
🎯 AUFGABE: Bewerte diese 3 DATENPUNKTE und erstelle einen EINZIGEN MOTIVATIONSSKOR (0-100)
═══════════════════════════════════════════════════════════════════════════════

Berechnungslogik:
- Leistung (Form): 0-100 basierend auf Form-Punkten
- Verletzungen & Kader: -20 (kritischer Spieler verletzt) bis +10 (voller Kader)
- Nachrichten & Situation: -20 (sehr negativ) bis +20 (sehr positiv)

FINALER SKOR = Leistung + Verletzung/Kader-Auswirkung + Nachrichten-Auswirkung
(Normalisiere auf 0-100)

Nur JSON-Format zurückgeben:
{
  "motivationScore": 65,
  "reasoning": "Kurze Erklärung: Leistung X, Verletzungen Y, Nachrichten Z → Finaler Skor 65",
  "injuries": ["Wichtige Verletzungen (max 3)"],
  "squadIssues": ["Kaderprobleme (max 2)"],
  "newsImpact": "Kurze Nachrichtenzusammenfassung (1 Satz)"
}`
  };

  try {
    console.log(`   🔍 Gemini API çağrısı başlatılıyor: ${teamName} (${league})`);
    
    // Timeout ile fetch (10 saniye)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
        }),
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`❌ Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
        return {
          injuries: [],
          squadIssues: [],
          newsImpact: '',
          motivationFactors: [],
          motivationScore: 50,
          reasoning: `Gemini API hatası (${response.status}), fallback kullanıldı`
        };
      }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.warn('⚠️ Gemini API boş response döndü');
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50,
        reasoning: 'Gemini API boş response, fallback kullanıldı'
      };
    }

    console.log(`   ✅ Gemini API response alındı (${text.length} karakter)`);

    // JSON extract
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ Gemini response is not JSON, using fallback');
        console.warn(`   Response preview: ${text.substring(0, 200)}...`);
        return {
          injuries: [],
          squadIssues: [],
          newsImpact: '',
          motivationFactors: [],
          motivationScore: 50,
          reasoning: 'Gemini response JSON değil, fallback kullanıldı'
        };
      }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const motivationScore = Math.min(100, Math.max(0, parsed.motivationScore || 50));
      console.log(`   ✅ Gemini Agent skor: ${motivationScore}/100 - ${parsed.reasoning?.substring(0, 100) || 'N/A'}...`);
      
      return {
        injuries: parsed.injuries || [],
        squadIssues: parsed.squadIssues || [],
        newsImpact: parsed.newsImpact || '',
        motivationFactors: parsed.motivationFactors || [],
        motivationScore,
        reasoning: parsed.reasoning || `Agent analizi: ${motivationScore}/100`
      };
    } catch (e) {
      console.error('❌ Failed to parse Gemini JSON:', e);
      console.error(`   JSON preview: ${jsonMatch[0].substring(0, 300)}...`);
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50,
        reasoning: 'Agent analizi başarısız (JSON parse hatası), fallback kullanıldı'
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏱️ Gemini API timeout (10 saniye)');
      return {
        injuries: [],
        squadIssues: [],
        newsImpact: '',
        motivationFactors: [],
        motivationScore: 50,
        reasoning: 'Gemini API timeout, fallback kullanıldı'
      };
    }
    console.error('❌ Gemini API error:', error?.message || error);
    return {
      injuries: [],
      squadIssues: [],
      newsImpact: '',
      motivationFactors: [],
      motivationScore: 50,
      reasoning: `Gemini API exception: ${error?.message || 'Bilinmeyen hata'}, fallback kullanıldı`
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
 * Ana fonksiyon: Agent 3 veriyi değerlendirip tek motivasyon skoru oluşturur
 */
export async function analyzeTeamMotivation(
  teamName: string,
  formString: string,
  points: number,
  league: string,
  language: 'tr' | 'en' | 'de' = 'tr'
): Promise<TeamMotivationAnalysis> {
  // Performans skoru hesapla (form bazlı)
  const performance = calculatePerformanceScore(formString, points);

  // Agent'a 3 veriyi gönder ve tek motivasyon skoru al
  const agentResult = await analyzeTeamContextWithGemini(
    teamName,
    league,
    language,
    formString,
    points,
    performance.trend
  );

  // Agent'ın verdiği skor final skor (Agent 3 veriyi değerlendirip tek skor oluşturdu)
  const finalScore = agentResult.motivationScore;

  // Agent'ın reasoning'i kullan (3 veriyi nasıl değerlendirdiğini açıklar)
  const reasoning = agentResult.reasoning || `${performance.reasoning}. Agent analizi: ${finalScore}/100`;

  return {
    performanceScore: performance.score, // Referans için (form bazlı)
    teamMotivationScore: agentResult.motivationScore, // Agent'ın oluşturduğu skor (3 veriyi değerlendirerek)
    finalScore, // Agent'ın oluşturduğu final skor (aynı değer)
    trend: performance.trend,
    reasoning, // Agent'ın açıklaması: "Performans X, sakatlıklar Y, haberler Z → Final skor 65"
    formGraph: performance.formGraph,
    injuries: agentResult.injuries || [],
    squadIssues: agentResult.squadIssues || [],
    newsImpact: agentResult.newsImpact || '',
    motivationFactors: agentResult.motivationFactors || []
  };
}

