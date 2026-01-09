import { aiClient } from '../../ai-client';
import { MatchData } from '../types';

export interface DevilsAdvocateResult {
    contrarianView: string;
    risks: string[];
    trapMatchIndicators: string[];
    whyFavoriteMightFail: string;
    matchResult: string; // Contrarian prediction (usually X or the underdog)
    confidence: number;
    agentSummary: string;
}

const PROMPTS = {
    tr: `Sen "ŞEYTANIN AVUKATI" (Devil's Advocate) isimli, dünyaca ünlü bir bahis stratejistisin. Görevin, herkesin hemfikir olduğu durumlarda "neden hatalı olabiliriz?" sorusuna yanıt bulmaktır.

Sana bir futbol maçıyla ilgili veriler verilecek. Senin görevi:
1.  **Favoriyi Sorgula**: Eğer bir takım istatistiksel olarak favori görünüyorsa, onun neden kaybedebileceğine dair en az 3 gerçekçi senaryo üret.
2.  **Tuzak Tespiti**: Oranlar ve veriler arasındaki tutarsızlıkları (Trap Match) yakala.
3.  **Kör Noktaları Bul**: Diğer analistlerin (Stats, Odds agents) görmezden gelebileceği riskleri (yorgunluk, motivasyon düşüklüğü, aşırı güven, regresyon riski) vurgula.
4.  **Kontrarian Tahmin**: Eğer favori çok barizse ama risk yüksekse, "Beraberlik" veya "Sürpriz" tarafına odaklanan bir analiz yap.

SADECE JSON DÖNDÜR:
{
  "contrarianView": "Favorinin neden kazanamayacağına dair genel bakış",
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "trapMatchIndicators": ["Tuzak belirtisi 1", "Tuzak belirtisi 2"],
  "whyFavoriteMightFail": "Favorinin tökezleme sebebi",
  "matchResult": "1/X/2 (Kontrarian seçim)",
  "confidence": 50-80 arası bir sayı,
  "agentSummary": "👹 ŞEYTANIN AVUKATI: [Kısa özet]"
}`,
    en: `You are the "DEVIL'S ADVOCATE" - a world-renowned betting strategist. Your job is to challenge the consensus and find reasons why the obvious prediction might be wrong.

You will be given match data. Your task:
1.  **Challenge the Favorite**: If one team looks like a clear favorite, generate at least 3 realistic scenarios where they fail.
2.  **Trap Detection**: Identify inconsistencies between odds and data (Trap Match indicators).
3.  **Find Blind Spots**: Highlight risks that other analysts (Stats, Odds agents) might ignore (fatigue, complacency, over-performance regression, etc.).
4.  **Contrarian Prediction**: Focus on the Draw or the Underdog if the risk is high.

RETURN ONLY JSON:
{
  "contrarianView": "Overview of why the favorite might not win",
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "trapMatchIndicators": ["Indicator 1", "Indicator 2"],
  "whyFavoriteMightFail": "Main reason for the favorite to stumble",
  "matchResult": "1/X/2 (Contrarian pick)",
  "confidence": number between 50-80,
  "agentSummary": "👹 DEVIL'S ADVOCATE: [Short summary]"
}`
};

export async function runDevilsAdvocateAgent(
    matchData: MatchData,
    language: 'tr' | 'en' | 'de' = 'en'
): Promise<DevilsAdvocateResult | null> {
    try {
        const prompt = PROMPTS[language === 'de' ? 'en' : language];

        // Prepare match context
        const context = `
Match: ${matchData.homeTeam} vs ${matchData.awayTeam}
League: ${matchData.league}
Date: ${matchData.date}

Home Form: ${matchData.homeForm?.form} (${matchData.homeForm?.points} pts)
Away Form: ${matchData.awayForm?.form} (${matchData.awayForm?.points} pts)

Home Goals (Scored/Conceded): ${matchData.homeForm?.avgGoals} / ${matchData.homeForm?.avgConceded}
Away Goals (Scored/Conceded): ${matchData.awayForm?.avgGoals} / ${matchData.awayForm?.avgConceded}

H2H: ${matchData.h2h ? `${matchData.h2h.totalMatches} matches (H: ${matchData.h2h.homeWins}, A: ${matchData.h2h.awayWins}, D: ${matchData.h2h.draws}), Avg Goals: ${matchData.h2h.avgGoals}` : 'No recent H2H'}

Odds:
Home: ${matchData.odds?.matchWinner?.home}
Draw: ${matchData.odds?.matchWinner?.draw}
Away: ${matchData.odds?.matchWinner?.away}
    `;

        const response = await aiClient.chat([
            { role: 'system', content: prompt },
            { role: 'user', content: `Analyze this match as a Devil's Advocate:\n${context}` }
        ]);

        if (!response) return null;

        // Extract JSON
        const jsonStr = response.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonStr) return null;

        return JSON.parse(jsonStr) as DevilsAdvocateResult;
    } catch (error) {
        console.error('❌ Devil\'s Advocate Agent failed:', error);
        return null;
    }
}
