import { aiClient } from '../../ai-client';
import { MatchData } from '../types';

// ============================================================================
// DEVIL'S ADVOCATE AGENT - Risk ve Tuzak Analizi
// ============================================================================
// ROL: Diğer ajanların gözden kaçırabileceği riskleri tespit etmek
// ODAK: Tuzak maçlar, favori hataları, regresyon riskleri
// ============================================================================

export interface DevilsAdvocateResult {
    contrarianView: string;
    risks: string[];
    trapMatchIndicators: string[];
    whyFavoriteMightFail: string;
    matchResult: string;
    confidence: number; // 0-100 arası (standart)
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    trapScore: number; // 0-100 (tuzak maç olasılığı)
    agentSummary: string;
}

const PROMPTS = {
    tr: `Sen "ŞEYTANIN AVUKATI" - riskleri ve tuzakları tespit eden bir analist.

## GÖREV
Diğer analistlerin göremeyeceği riskleri bul. ASLA popüler görüşe katılma - her zaman karşı argüman üret.

## ANALİZ ADIMLARI

### 1. FAVORİ ANALİZİ
- Oranlardan favoriyi belirle (en düşük oran = favori)
- Favorinin son 5 maçtaki performansını değerlendir
- Aşırı performans (overperformance) var mı? Regresyon riski?

### 2. TUZAK MAÇ BELİRTİLERİ (Trap Match)
Şu durumlar varsa TUZAK SKORU yüksek:
- Favori son 3+ maç kazandı ama rakipleri zayıftı (+15 puan)
- Favori önceki hafta büyük maç oynadı (yorgunluk) (+20 puan)
- Underdog küme düşme/şampiyonluk mücadelesinde (+25 puan)
- Favori deplasmanda, ev sahibi sert savunma yapıyor (+15 puan)
- Oranlar son 24 saatte favori aleyhine hareket etti (+20 puan)

### 3. RİSK TESPİTİ
Her risk için somut kanıt göster:
- Yorgunluk: "X takımı 4 günde 3. maçına çıkıyor"
- Motivasyon: "Lig ortasında, hedefsiz"
- Sakatlık: "Y oyuncu eksik, alternatifi zayıf"
- Psikoloji: "Son derbide 4-0 kaybettiler"

### 4. KONTRARİAN TAHMİN
- Eğer tuzak skoru > 50 ise: Beraberlik veya Underdog öner
- Eğer tuzak skoru > 70 ise: Kesinlikle favoriye karşı bahis öner
- Güven seviyesi: Kanıt sayısına göre (her somut kanıt +10)

## ÇIKTI FORMATI (SADECE JSON)
{
  "contrarianView": "Favorinin neden kazanamayacağına dair 2-3 cümle",
  "risks": ["Somut risk 1", "Somut risk 2", "Somut risk 3"],
  "trapMatchIndicators": ["Tuzak belirtisi 1", "Tuzak belirtisi 2"],
  "whyFavoriteMightFail": "Ana sebep (tek cümle)",
  "matchResult": "1 veya X veya 2",
  "confidence": 40-85 arası sayı,
  "riskLevel": "low/medium/high/critical",
  "trapScore": 0-100 arası tuzak skoru,
  "agentSummary": "👹 [Kısa özet]"
}`,

    en: `You are the "DEVIL'S ADVOCATE" - an analyst who detects risks and traps.

## MISSION
Find risks that other analysts miss. NEVER agree with the popular view - always produce counter-arguments.

## ANALYSIS STEPS

### 1. FAVORITE ANALYSIS
- Identify the favorite from odds (lowest odds = favorite)
- Evaluate favorite's last 5 match performance
- Is there overperformance? Regression risk?

### 2. TRAP MATCH INDICATORS
Higher TRAP SCORE if:
- Favorite won 3+ games but opponents were weak (+15 pts)
- Favorite played a big game last week (fatigue) (+20 pts)
- Underdog in relegation/title fight (+25 pts)
- Favorite away, home team has solid defense (+15 pts)
- Odds moved against favorite in last 24h (+20 pts)

### 3. RISK DETECTION
Show concrete evidence for each risk:
- Fatigue: "X team playing 3rd game in 4 days"
- Motivation: "Mid-table, nothing to play for"
- Injury: "Y player out, backup is weak"
- Psychology: "Lost 4-0 in last derby"

### 4. CONTRARIAN PREDICTION
- If trap score > 50: Recommend Draw or Underdog
- If trap score > 70: Strongly recommend against favorite
- Confidence: Based on evidence count (+10 per concrete evidence)

## OUTPUT FORMAT (JSON ONLY)
{
  "contrarianView": "2-3 sentences on why favorite might not win",
  "risks": ["Concrete risk 1", "Concrete risk 2", "Concrete risk 3"],
  "trapMatchIndicators": ["Trap indicator 1", "Trap indicator 2"],
  "whyFavoriteMightFail": "Main reason (one sentence)",
  "matchResult": "1 or X or 2",
  "confidence": number 40-85,
  "riskLevel": "low/medium/high/critical",
  "trapScore": 0-100 trap score,
  "agentSummary": "👹 [Short summary]"
}`
};

export async function runDevilsAdvocateAgent(
    matchData: MatchData,
    language: 'tr' | 'en' | 'de' = 'en'
): Promise<DevilsAdvocateResult | null> {
    console.log('\n👹 DEVIL\'S ADVOCATE AGENT STARTING');
    console.log('═'.repeat(50));

    const startTime = Date.now();

    try {
        const prompt = PROMPTS[language === 'de' ? 'en' : language];

        // Favoriyi belirle (en düşük oran)
        const homeOdds = matchData.odds?.matchWinner?.home || 2.5;
        const awayOdds = matchData.odds?.matchWinner?.away || 2.5;
        const drawOdds = matchData.odds?.matchWinner?.draw || 3.3;

        let favorite = 'balanced';
        let favoriteTeam = '';
        if (homeOdds < awayOdds && homeOdds < drawOdds) {
            favorite = 'home';
            favoriteTeam = matchData.homeTeam;
        } else if (awayOdds < homeOdds && awayOdds < drawOdds) {
            favorite = 'away';
            favoriteTeam = matchData.awayTeam;
        }

        // Form analizi
        const homeForm = matchData.homeForm?.form || '';
        const awayForm = matchData.awayForm?.form || '';
        const homeWins = (homeForm.match(/W/g) || []).length;
        const awayWins = (awayForm.match(/W/g) || []).length;

        // Tuzak skoru ön hesaplama
        let trapScore = 0;

        // Favori çok kazanıyor ama rakipler zayıf olabilir
        if (favorite === 'home' && homeWins >= 3) trapScore += 15;
        if (favorite === 'away' && awayWins >= 3) trapScore += 15;

        // Odds çok düşük (aşırı favori) = risk
        if (homeOdds < 1.4 || awayOdds < 1.4) trapScore += 20;

        // Deplasman favorisi = ekstra risk
        if (favorite === 'away') trapScore += 10;

        // Prepare match context with more data
        const context = `
## MAÇ BİLGİSİ
${matchData.homeTeam} vs ${matchData.awayTeam}
Lig: ${matchData.league}
Tarih: ${matchData.date}

## FAVORİ ANALİZİ
Favori: ${favoriteTeam || 'Dengeli maç'}
Ev Oranı: ${homeOdds} | Beraberlik: ${drawOdds} | Deplasman: ${awayOdds}

## FORM VERİLERİ
${matchData.homeTeam}: ${homeForm} (${matchData.homeForm?.points || 0} puan, son 10 maç)
  - Atılan: ${matchData.homeForm?.avgGoals || 0} gol/maç
  - Yenilen: ${matchData.homeForm?.avgConceded || 0} gol/maç

${matchData.awayTeam}: ${awayForm} (${matchData.awayForm?.points || 0} puan, son 10 maç)
  - Atılan: ${matchData.awayForm?.avgGoals || 0} gol/maç
  - Yenilen: ${matchData.awayForm?.avgConceded || 0} gol/maç

## KAFA KAFAYA
${matchData.h2h ? `Son ${matchData.h2h.totalMatches} maç: Ev ${matchData.h2h.homeWins} - ${matchData.h2h.draws} Beraberlik - ${matchData.h2h.awayWins} Deplasman
Ortalama gol: ${matchData.h2h.avgGoals}` : 'H2H verisi yok'}

## ÖN HESAPLAMA
Tuzak Skoru (Başlangıç): ${trapScore}/100
`;

        console.log(`   🎯 Analyzing as Devil's Advocate...`);
        console.log(`   📊 Pre-calculated trap score: ${trapScore}`);

        const response = await aiClient.callClaude([
            { role: 'system', content: prompt },
            { role: 'user', content: `Bu maçı Şeytanın Avukatı olarak analiz et:\n${context}` }
        ], {
            model: 'claude',
            temperature: 0.4, // Biraz yaratıcılık ama tutarlı
            maxTokens: 1000,
            timeout: 25000 // 25 saniye
        });

        if (!response) {
            console.log('   ❌ No response from AI');
            return createFallbackResult(matchData, trapScore, language);
        }

        // Extract JSON
        const jsonStr = response.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonStr) {
            console.log('   ⚠️ Could not extract JSON, using fallback');
            return createFallbackResult(matchData, trapScore, language);
        }

        const result = JSON.parse(jsonStr) as DevilsAdvocateResult;

        // Confidence'ı 0-100 aralığına normalize et
        result.confidence = Math.max(40, Math.min(85, result.confidence || 60));

        // Trap score yoksa hesapla
        if (!result.trapScore) {
            result.trapScore = trapScore + (result.risks?.length || 0) * 10;
        }

        // Risk level yoksa belirle
        if (!result.riskLevel) {
            if (result.trapScore >= 70) result.riskLevel = 'critical';
            else if (result.trapScore >= 50) result.riskLevel = 'high';
            else if (result.trapScore >= 30) result.riskLevel = 'medium';
            else result.riskLevel = 'low';
        }

        const elapsed = Date.now() - startTime;
        console.log(`   ✅ Devil's Advocate completed in ${elapsed}ms`);
        console.log(`   👹 Contrarian pick: ${result.matchResult}`);
        console.log(`   ⚠️ Trap Score: ${result.trapScore}/100 (${result.riskLevel})`);
        console.log(`   📊 Confidence: ${result.confidence}%`);
        console.log('═'.repeat(50));

        return result;

    } catch (error) {
        console.error('❌ Devil\'s Advocate Agent failed:', error);
        return createFallbackResult(matchData, 50, language);
    }
}

function createFallbackResult(
    matchData: MatchData,
    trapScore: number,
    language: 'tr' | 'en' | 'de'
): DevilsAdvocateResult {
    const homeOdds = matchData.odds?.matchWinner?.home || 2.5;
    const awayOdds = matchData.odds?.matchWinner?.away || 2.5;

    // Favori değilse beraberlik öner
    let matchResult = 'X';
    if (homeOdds < awayOdds && homeOdds < 1.8) {
        matchResult = '2'; // Underdog
    } else if (awayOdds < homeOdds && awayOdds < 1.8) {
        matchResult = '1'; // Underdog
    }

    const messages = {
        tr: {
            view: 'Favori takımın formu aldatıcı olabilir. Rakip motivasyonunu hafife almayın.',
            risks: ['Favori son maçlarda zorlandı', 'Deplasman/ev dezavantajı', 'Motivasyon eksikliği riski'],
            trap: ['Oranlar gerçek gücü yansıtmıyor olabilir'],
            fail: 'Aşırı güven ve rakibi küçümseme',
            summary: '👹 Dikkatli olun, bu maçta sürpriz olabilir'
        },
        en: {
            view: 'The favorite\'s form might be deceiving. Don\'t underestimate the opponent\'s motivation.',
            risks: ['Favorite struggled in recent matches', 'Home/away disadvantage', 'Motivation risk'],
            trap: ['Odds might not reflect true strength'],
            fail: 'Overconfidence and underestimating opponent',
            summary: '👹 Be careful, upset potential in this match'
        },
        de: {
            view: 'Die Form des Favoriten könnte täuschen. Unterschätzen Sie die Motivation des Gegners nicht.',
            risks: ['Favorit hatte Probleme in letzten Spielen', 'Heim/Auswärtsnachteil', 'Motivationsrisiko'],
            trap: ['Quoten spiegeln möglicherweise nicht die wahre Stärke wider'],
            fail: 'Überheblichkeit und Unterschätzung des Gegners',
            summary: '👹 Vorsicht, Überraschungspotential in diesem Spiel'
        }
    };

    const msg = messages[language] || messages.en;

    return {
        contrarianView: msg.view,
        risks: msg.risks,
        trapMatchIndicators: msg.trap,
        whyFavoriteMightFail: msg.fail,
        matchResult,
        confidence: 55,
        riskLevel: trapScore >= 50 ? 'high' : 'medium',
        trapScore: Math.min(100, trapScore + 20),
        agentSummary: msg.summary
    };
}
