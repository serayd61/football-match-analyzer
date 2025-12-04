import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ScoutReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `🔍 SEN VERİ ANALİZ AJANISIN.

⚠️ KRİTİK KURALLAR:
1. SADECE sana verilen verileri analiz et
2. Sakatlık/haber verisi YOKSA, "Veri mevcut değil" de
3. ASLA oyuncu ismi veya haber UYDURMA
4. Bilmediğin şeyi YAZMA

Eğer sakatlık verisi verilmediyse:
- injuries: [] (BOŞ ARRAY)
- suspensions: [] (BOŞ ARRAY)
- news: [] (BOŞ ARRAY)

Türkçe yanıt ver. SADECE JSON döndür.`,

  en: `🔍 YOU ARE A DATA ANALYSIS AGENT.

⚠️ CRITICAL RULES:
1. ONLY analyze data that is PROVIDED to you
2. If injury/news data is NOT provided, say "Data not available"
3. NEVER make up player names or news
4. DO NOT write things you don't know

If injury data is not provided:
- injuries: [] (EMPTY ARRAY)
- suspensions: [] (EMPTY ARRAY)
- news: [] (EMPTY ARRAY)

Respond in English. Return ONLY JSON.`,

  de: `🔍 DU BIST EIN DATENANALYSE-AGENT.
ERFINDE KEINE Spielernamen oder Nachrichten.
Auf Deutsch antworten. NUR JSON zurückgeben.`,
};

export async function runScoutAgent(
  match: MatchData,
  language: Language = 'en'
): Promise<ScoutReport | null> {
  
  // Gerçek sakatlık verisi var mı kontrol et
  // Gerçek sakatlık verisi var mı kontrol et
  const hasRealInjuryData = (match as any).injuries && Array.isArray((match as any).injuries) && (match as any).injuries.length > 0;
  const hasRealNews = (match as any).news && Array.isArray((match as any).news) && (match as any).news.length > 0;

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `
🏟️ MAÇ: ${match.homeTeam} vs ${match.awayTeam}
🏆 LİG: ${match.league || 'Bilinmiyor'}

📊 VERİLEN VERİLER:
${hasRealInjuryData ? `Sakatlıklar: ${JSON.stringify((match as any).injuries)}` : '⚠️ Sakatlık verisi MEVCUT DEĞİL - UYDURMA!'}
${hasRealNews ? `Haberler: ${JSON.stringify((match as any).news)}` : '⚠️ Haber verisi MEVCUT DEĞİL - UYDURMA!'}

📈 FORM VERİLERİ (BUNLARI KULLAN):
- ${match.homeTeam}: Form=${match.homeForm?.form || 'N/A'}, Gol Ort=${match.homeForm?.avgGoals || 'N/A'}
- ${match.awayTeam}: Form=${match.awayForm?.form || 'N/A'}, Gol Ort=${match.awayForm?.avgGoals || 'N/A'}

⚔️ H2H: ${match.h2h?.totalMatches || 0} maç

🎯 JSON FORMAT:
{
  "injuries": ${hasRealInjuryData ? 'VERİLEN VERİYİ KULLAN' : '[]'},
  "suspensions": [],
  "news": ${hasRealNews ? 'VERİLEN VERİYİ KULLAN' : '[]'},
  "lineupChanges": [],
  "weather": {"condition": "Bilinmiyor", "impact": "Veri yok"},
  "summary": "Form verilerine dayalı kısa özet. ${match.homeTeam} form: ${match.homeForm?.form || 'N/A'}. ${match.awayTeam} form: ${match.awayForm?.form || 'N/A'}. Sakatlık/haber verisi mevcut değil."
}

⚠️ VERİ YOKSA BOŞ ARRAY KULLAN! UYDURMA!` },
  ];

  return await heurist.chatJSON<ScoutReport>(messages, { 
    model: 'meta-llama/llama-3.3-70b-instruct',
    temperature: 0.3, // Daha deterministik
    maxTokens: 1500
  });
}
