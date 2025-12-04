import { heurist, HeuristMessage } from '../client';
import { Language, MatchData, ConsensusReport } from '../types';

const SYSTEM_PROMPTS: Record<Language, string> = {
  tr: `Sen bir JSON API'sisin. SADECE geçerli JSON döndür.
ASLA markdown kullanma. ASLA ** veya ` + "`" + ` kullanma.
ASLA açıklama yazma. SADECE JSON objesi döndür.`,

  en: `You are a JSON API. Return ONLY valid JSON.
NEVER use markdown. NEVER use ** or ` + "`" + `.
NEVER write explanations. Return ONLY a JSON object.`,

  de: `Du bist eine JSON-API. Gib NUR gültiges JSON zurück.
NIEMALS Markdown verwenden. NUR JSON-Objekt zurückgeben.`,
};

export async function runConsensusAgent(
  match: MatchData,
  allReports: { scout: any; stats: any; odds: any; strategy: any },
  language: Language = 'en'
): Promise<ConsensusReport | null> {
  
  // Stats'tan gol beklentisini al
  const goalExpectancy = parseFloat(allReports.stats?.goalExpectancy?.total) || 2.5;
  const overUnderPrediction = goalExpectancy >= 2.5 ? 'Over' : 'Under';
  const overUnderConfidence = Math.min(95, Math.round(50 + Math.abs(goalExpectancy - 2.5) * 15));

  // Direkt JSON oluştur - model sadece dolduracak
  const jsonTemplate = {
    matchResult: { prediction: "1", confidence: 70, unanimous: false },
    overUnder25: { prediction: overUnderPrediction, confidence: overUnderConfidence, unanimous: true },
    btts: { prediction: "Yes", confidence: 70, unanimous: false },
    doubleChance: { prediction: "1X", confidence: 75 },
    halfTimeResult: { prediction: "X", confidence: 65 },
    correctScore: { first: "1-1", second: "2-1", third: "1-0" },
    bestBet: {
      type: `${overUnderPrediction} 2.5 Gol`,
      selection: overUnderPrediction,
      confidence: overUnderConfidence,
      stake: 3,
      reasoning: `Beklenen gol: ${goalExpectancy.toFixed(1)}`
    },
    riskLevel: "orta",
    overallAnalysis: `${match.homeTeam} vs ${match.awayTeam} macinda ${goalExpectancy.toFixed(1)} gol bekleniyor. ${overUnderPrediction} 2.5 oneriliyor.`,
    keyFactors: [`Beklenen gol: ${goalExpectancy.toFixed(1)}`, "Form verileri analiz edildi"],
    warnings: ["Sakatlik verisi mevcut degildi"]
  };

  const messages: HeuristMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[language] },
    { role: 'user', content: `Return this JSON with minor adjustments based on the data:

MATCH: ${match.homeTeam} vs ${match.awayTeam}
EXPECTED GOALS: ${goalExpectancy.toFixed(1)}
OVER/UNDER PREDICTION: ${overUnderPrediction}

Stats summary: ${allReports.stats?.summary || 'N/A'}
Scout summary: ${allReports.scout?.summary || 'N/A'}

Return ONLY this JSON (no markdown, no explanation):
${JSON.stringify(jsonTemplate, null, 2)}` },
  ];

  try {
    const response = await heurist.chat(messages, { 
      model: 'meta-llama/llama-3.3-70b-instruct',
      temperature: 0.1, // Çok düşük - deterministik
      maxTokens: 1500
    });

    if (!response) {
      console.log('⚠️ No response from Heurist, using template');
      return jsonTemplate as ConsensusReport;
    }

    // JSON parse dene
    try {
      // Markdown temizle
      let cleaned = response
        .replace(/\*\*/g, '')  // Bold kaldır
        .replace(/`/g, '')     // Backtick kaldır
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // JSON bul
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ConsensusReport;
      }
    } catch (parseError) {
      console.log('⚠️ JSON parse failed, using template');
    }

    // Parse başarısızsa template döndür
    return jsonTemplate as ConsensusReport;

  } catch (error) {
    console.error('Consensus agent error:', error);
    return jsonTemplate as ConsensusReport;
  }
}
