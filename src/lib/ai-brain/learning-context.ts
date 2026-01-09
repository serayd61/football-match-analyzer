
import { getSupabaseAdmin } from '../supabase';

/**
 * Generates a dynamic learning context string based on past performance for the given league and team.
 * This context helps agents self-correct based on historical accuracy.
 */
export async function getLearningContext(
    league: string,
    homeTeam: string,
    awayTeam: string,
    language: 'tr' | 'en' | 'de' = 'en'
): Promise<string> {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch recent finished matches for this league to check agent accuracy
        // We look at the last 20 matches in this league that are finished
        const { data: recentMatches, error } = await supabase
            .from('predictions')
            .select(`
        final_match_result_correct,
        final_over_under_correct,
        final_btts_correct,
        deep_match_result_correct,
        stats_match_result_correct,
        odds_match_result_correct,
        raw_data,
        match_date
      `)
            .eq('league', league)
            .eq('match_finished', true)
            .order('match_date', { ascending: false })
            .limit(20);

        if (error || !recentMatches || recentMatches.length === 0) {
            return ''; // No data, no context
        }

        // Calculate accuracies
        const total = recentMatches.length;
        let statsCorrect = 0;
        let oddsCorrect = 0;
        let deepCorrect = 0;
        let devilsCorrect = 0;
        let consensusCorrect = 0;

        recentMatches.forEach(m => {
            if (m.stats_match_result_correct) statsCorrect++;
            if (m.odds_match_result_correct) oddsCorrect++;
            if (m.deep_match_result_correct) deepCorrect++;
            if (m.final_match_result_correct) consensusCorrect++;

            // Devil's Advocate accuracy from raw_data
            if (m.raw_data?.devils_advocate_match_result_correct === true) devilsCorrect++;
        });

        const statsAcc = Math.round((statsCorrect / total) * 100);
        const oddsAcc = Math.round((oddsCorrect / total) * 100);
        const deepAcc = Math.round((deepCorrect / total) * 100);
        const devilsAcc = Math.round((devilsCorrect / total) * 100);
        const consensusAcc = Math.round((consensusCorrect / total) * 100);

        // Identify the best performing agent in this league
        const agents = [
            { name: 'Stats Agent', acc: statsAcc },
            { name: 'Odds Agent', acc: oddsAcc },
            { name: 'Deep Analysis', acc: deepAcc },
            { name: 'Devil\'s Advocate', acc: devilsAcc }
        ].sort((a, b) => b.acc - a.acc);

        const bestAgent = agents[0];
        const worstAgent = agents[agents.length - 1];

        // Build the context string
        let context = '';

        if (language === 'tr') {
            context += `
═══════════════════════════════════════════════════════════════════════════════
📚 ÖĞRENME MODÜLÜ (Learning Context) - ${league}
═══════════════════════════════════════════════════════════════════════════════
Bu ligde son ${total} maçtaki performans analizine göre:
1. 🏆 EN İYİ AJAN: ${bestAgent.name} (%${bestAgent.acc} başarı) -> Onun tahminlerine DAHA FAZLA güven.
2. ⚠️ EN ZAYIF AJAN: ${worstAgent.name} (%${worstAgent.acc} başarı) -> Onun tahminlerine DAHA AZ güven.
3. Genel Konsensüs Başarısı: %${consensusAcc}.

GENEL STRATEJİ:
`;
            if (bestAgent.name === 'Odds Agent') {
                context += `- Bu ligde "Oran ve Piyasa Analizi" (Odds Agent) istatistiklerden daha iyi çalışıyor. Value bet ve sharp money sinyallerine öncelik ver.\n`;
            } else if (bestAgent.name === 'Stats Agent') {
                context += `- Bu ligde "İstatistiksel Veriler" (Stats Agent) çok güvenilir. Form grafiği ve xG verilerine sadık kal.\n`;
            }

            if (consensusAcc < 50) {
                context += `- ⚠️ DİKKAT: Bu ligde standart tahminler sık sık yanılıyor (Sürpriz oranı yüksek). Daha cesur ve sürpriz tahminlere yönel.\n`;
            }

        } else {
            context += `
═══════════════════════════════════════════════════════════════════════════════
📚 LEARNING MODULE (Historical Performance) - ${league}
═══════════════════════════════════════════════════════════════════════════════
Based on the last ${total} matches in this league:
1. 🏆 BEST AGENT: ${bestAgent.name} (${bestAgent.acc}% accuracy) -> Trust this agent MORE.
2. ⚠️ WORST AGENT: ${worstAgent.name} (${worstAgent.acc}% accuracy) -> Trust this agent LESS.
3. Overall Consensus Accuracy: ${consensusAcc}%.

STRATEGIC ADVICE:
`;
            if (bestAgent.name === 'Odds Agent') {
                context += `- In this league, "Market Analysis" (Odds Agent) outperforms raw stats. Prioritize sharp money and value signals.\n`;
            } else if (bestAgent.name === 'Stats Agent') {
                context += `- In this league, "Statistical Data" (Stats Agent) is highly reliable. Stick to form and xG patterns.\n`;
            }

            if (consensusAcc < 50) {
                context += `- ⚠️ WARNING: Standard predictions often fail in this league (High surprise rate). Be more bold and contrarian.\n`;
            }
        }

        context += `═══════════════════════════════════════════════════════════════════════════════\n`;

        return context;

    } catch (err) {
        console.error('Error generating learning context:', err);
        return ''; // Fail silently
    }
}
