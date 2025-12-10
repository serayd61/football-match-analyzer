import { NextResponse } from 'next/server';
import {
  getAllFixtures,
  getComprehensiveMatchData,
  LEAGUES,
  type MatchAnalysisData
} from '@/lib/sportmonks';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const dynamic = 'force-dynamic';

interface MatchForAnalysis {
  id: number;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  competition: string;
  leagueId: number;
  date: string;
  matchData?: MatchAnalysisData;
}

interface CouponPrediction {
  match: string;
  prediction: string;
  confidence: number;
  odds?: number;
  reasoning: string;
  isConsensus?: boolean;
}

interface Coupon {
  type: 'safe' | 'risky';
  title: string;
  predictions: CouponPrediction[];
  totalOdds: number;
  strategy: string;
}

// Build analysis prompt for coupon generation
function buildCouponPrompt(matches: MatchForAnalysis[]): string {
  let prompt = `KUPON ANALİZİ İÇİN MAÇ VERİLERİ

Aşağıda ${matches.length} maçın detaylı verileri var. Bu verileri kullanarak 2 farklı kupon hazırla.

═══════════════════════════════════════════════════════════════
`;

  matches.forEach((match, index) => {
    const data = match.matchData;
    if (!data) {
      prompt += `\n${index + 1}. ${match.homeTeam} vs ${match.awayTeam} (${match.competition})\n`;
      prompt += `   Tarih: ${match.date}\n`;
      prompt += `   Detaylı veri yok\n`;
      return;
    }

    const { homeTeam, awayTeam, h2h, odds } = data;

    prompt += `
${index + 1}. ${match.homeTeam} vs ${match.awayTeam}
   Lig: ${match.competition}
   Tarih: ${match.date}

   EV SAHİBİ: ${homeTeam.position}. sıra | Form: ${homeTeam.form} | Gol Ort: ${homeTeam.avgGoalsScored}/${homeTeam.avgGoalsConceded}
   Ev Performansı: ${homeTeam.homeWon}G-${homeTeam.homeDrawn}B-${homeTeam.homeLost}M

   DEPLASMAN: ${awayTeam.position}. sıra | Form: ${awayTeam.form} | Gol Ort: ${awayTeam.avgGoalsScored}/${awayTeam.avgGoalsConceded}
   Deplasman Performansı: ${awayTeam.awayWon}G-${awayTeam.awayDrawn}B-${awayTeam.awayLost}M

   H2H: ${h2h.length} maç | Gol Ort: ${h2h.length > 0 ? (h2h.reduce((s, m) => s + m.homeScore + m.awayScore, 0) / h2h.length).toFixed(1) : 'N/A'}
`;

    if (odds) {
      prompt += `   Oranlar: MS(${odds.home.toFixed(2)}/${odds.draw.toFixed(2)}/${odds.away.toFixed(2)}) | Ü2.5: ${odds.over25.toFixed(2)} | KG: ${odds.bttsYes.toFixed(2)}
`;
    }
  });

  prompt += `
═══════════════════════════════════════════════════════════════

KUPON HAZIRLAMA TALİMATLARI:

1. GÜVENLİ KUPON (Düşük risk, tutarlı getiri)
   - 3-4 maç seç
   - SADECE MS 1, MS X, MS 2, Üst 2.5, Alt 2.5, KG Var, KG Yok gibi basit bahisler
   - Her tahminin güven oranı minimum %65 olmalı
   - Toplam oran hedefi: 2.00 - 5.00 arası
   - Form, sıralama ve ev/deplasman performansına öncelik ver

2. RİSKLİ KUPON (Yüksek kazanç potansiyeli)
   - 4-5 maç seç
   - Handikap, İY/MS, Skor tahmini gibi yüksek oranlı bahisler kullanabilirsin
   - Daha cesur tahminler yapabilirsin ama mantıklı gerekçeleri olmalı
   - Toplam oran hedefi: 10.00 - 50.00 arası

SADECE şu JSON formatında yanıt ver:
{
  "guvenli_kupon": {
    "maclar": [
      {
        "mac": "Ev Sahibi vs Deplasman",
        "tahmin": "MS 1" veya "Üst 2.5" gibi,
        "oran": sayı,
        "guven": 50-100,
        "gerekce": "Kısa açıklama"
      }
    ],
    "toplam_oran": sayı,
    "strateji": "Kupon stratejisi açıklaması"
  },
  "riskli_kupon": {
    "maclar": [
      {
        "mac": "Ev Sahibi vs Deplasman",
        "tahmin": "2-1 Skor" veya "1/1 İY/MS" gibi,
        "oran": sayı,
        "guven": 50-100,
        "gerekce": "Kısa açıklama"
      }
    ],
    "toplam_oran": sayı,
    "strateji": "Kupon stratejisi açıklaması"
  }
}`;

  return prompt;
}

// Parse AI coupon response
function parseAICouponResponse(text: string): any {
  try {
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Merge predictions from both AIs
function mergeCouponPredictions(claudeCoupon: any, openaiCoupon: any): {
  safeCoupon: Coupon | null;
  riskyCoupon: Coupon | null;
  consensus: any;
} {
  const result = {
    safeCoupon: null as Coupon | null,
    riskyCoupon: null as Coupon | null,
    consensus: {
      safeCouponAgreement: 0,
      riskyCouponAgreement: 0,
      commonSafePicks: [] as string[],
      commonRiskyPicks: [] as string[]
    }
  };

  // Process safe coupon
  const claudeSafe = claudeCoupon?.guvenli_kupon;
  const openaiSafe = openaiCoupon?.guvenli_kupon;

  if (claudeSafe?.maclar && openaiSafe?.maclar) {
    // Find common predictions
    const claudeSafeMatches = new Set<string>(claudeSafe.maclar.map((m: any) => `${m.mac}:${m.tahmin}`));
    const openaiSafeMatches = new Set<string>(openaiSafe.maclar.map((m: any) => `${m.mac}:${m.tahmin}`));

    const commonSafe = [...claudeSafeMatches].filter(x => openaiSafeMatches.has(x));
    result.consensus.commonSafePicks = commonSafe;
    result.consensus.safeCouponAgreement = commonSafe.length;

    // Prioritize common predictions, then add Claude's unique picks
    const prioritizedPicks: any[] = [];

    // First add common predictions
    claudeSafe.maclar.forEach((pick: any) => {
      const key = `${pick.mac}:${pick.tahmin}`;
      if (commonSafe.includes(key)) {
        const openaiPick = openaiSafe.maclar.find((m: any) => `${m.mac}:${m.tahmin}` === key);
        prioritizedPicks.push({
          match: pick.mac,
          prediction: pick.tahmin,
          confidence: Math.round(((pick.guven || 60) + (openaiPick?.guven || 60)) / 2),
          odds: pick.oran || openaiPick?.oran || 1.5,
          reasoning: `[Ortak] ${pick.gerekce}`,
          isConsensus: true
        });
      }
    });

    // Then add Claude's unique high-confidence picks if needed
    if (prioritizedPicks.length < 3) {
      claudeSafe.maclar.forEach((pick: any) => {
        const key = `${pick.mac}:${pick.tahmin}`;
        if (!commonSafe.includes(key) && (pick.guven || 60) >= 65 && prioritizedPicks.length < 4) {
          prioritizedPicks.push({
            match: pick.mac,
            prediction: pick.tahmin,
            confidence: pick.guven || 60,
            odds: pick.oran || 1.5,
            reasoning: pick.gerekce,
            isConsensus: false
          });
        }
      });
    }

    if (prioritizedPicks.length > 0) {
      result.safeCoupon = {
        type: 'safe',
        title: 'GÜVENLİ KUPON',
        predictions: prioritizedPicks,
        totalOdds: prioritizedPicks.reduce((acc, p) => acc * (p.odds || 1.5), 1),
        strategy: claudeSafe.strateji || 'Form ve sıralama bazlı güvenli seçimler'
      };
    }
  }

  // Process risky coupon
  const claudeRisky = claudeCoupon?.riskli_kupon;
  const openaiRisky = openaiCoupon?.riskli_kupon;

  if (claudeRisky?.maclar && openaiRisky?.maclar) {
    const claudeRiskyMatches = new Set<string>(claudeRisky.maclar.map((m: any) => `${m.mac}:${m.tahmin}`));
    const openaiRiskyMatches = new Set<string>(openaiRisky.maclar.map((m: any) => `${m.mac}:${m.tahmin}`));

    const commonRisky = [...claudeRiskyMatches].filter(x => openaiRiskyMatches.has(x));
    result.consensus.commonRiskyPicks = commonRisky;
    result.consensus.riskyCouponAgreement = commonRisky.length;

    const riskyPicks: any[] = [];

    // Add all Claude's risky picks (risky coupon is more individual)
    claudeRisky.maclar.forEach((pick: any) => {
      const key = `${pick.mac}:${pick.tahmin}`;
      const isCommon = commonRisky.includes(key);
      const openaiPick = isCommon ? openaiRisky.maclar.find((m: any) => `${m.mac}:${m.tahmin}` === key) : null;

      riskyPicks.push({
        match: pick.mac,
        prediction: pick.tahmin,
        confidence: isCommon ? Math.round(((pick.guven || 50) + (openaiPick?.guven || 50)) / 2) : (pick.guven || 50),
        odds: pick.oran || 3.0,
        reasoning: isCommon ? `[Ortak] ${pick.gerekce}` : pick.gerekce,
        isConsensus: isCommon
      });
    });

    if (riskyPicks.length > 0) {
      result.riskyCoupon = {
        type: 'risky',
        title: 'RİSKLİ KUPON',
        predictions: riskyPicks,
        totalOdds: riskyPicks.reduce((acc, p) => acc * (p.odds || 3.0), 1),
        strategy: claudeRisky.strateji || 'Yüksek oranlı cesur seçimler'
      };
    }
  }

  return result;
}

export async function GET() {
  try {
    // Get matches for next 3 days
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 3);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];

    // Fetch upcoming fixtures from Sportmonks
    const fixturesRes = await getAllFixtures(dateFrom, dateTo);

    if (!fixturesRes?.data || fixturesRes.data.length === 0) {
      return NextResponse.json({
        success: true,
        matchCount: 0,
        message: 'Bugün ve önümüzdeki 3 günde maç bulunamadı',
        safeCoupon: null,
        riskyCoupon: null
      });
    }

    // Format matches
    const matches: MatchForAnalysis[] = fixturesRes.data.map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      const league = Object.values(LEAGUES).find(l => l.id === match.league_id);

      return {
        id: match.id,
        homeTeam: home?.name || 'TBA',
        homeTeamId: home?.id || 0,
        awayTeam: away?.name || 'TBA',
        awayTeamId: away?.id || 0,
        competition: league?.name || match.league?.name || 'Unknown',
        leagueId: match.league_id,
        date: match.starting_at?.split('T')[0] || ''
      };
    });

    // Limit to 10 matches for analysis (API rate limits)
    const matchesForAnalysis = matches.slice(0, 10);

    // Fetch comprehensive data for each match (in parallel, max 5 at a time)
    const batchSize = 5;
    for (let i = 0; i < matchesForAnalysis.length; i += batchSize) {
      const batch = matchesForAnalysis.slice(i, i + batchSize);
      const dataPromises = batch.map(match =>
        getComprehensiveMatchData(
          match.homeTeamId,
          match.awayTeamId,
          match.leagueId,
          match.id
        )
      );

      const results = await Promise.all(dataPromises);
      results.forEach((data, idx) => {
        if (data) {
          matchesForAnalysis[i + idx].matchData = data;
        }
      });
    }

    // Filter matches with valid data
    const validMatches = matchesForAnalysis.filter(m => m.matchData);

    if (validMatches.length === 0) {
      return NextResponse.json({
        success: true,
        matchCount: matches.length,
        message: 'Maç verileri alınamadı',
        safeCoupon: null,
        riskyCoupon: null
      });
    }

    // Build prompt
    const couponPrompt = buildCouponPrompt(validMatches);

    const systemPrompt = `Sen profesyonel bir futbol analisti ve bahis uzmanısın.
Verilen maç verilerini analiz ederek mantıklı kupon önerileri hazırlıyorsun.
Tahminlerini SADECE verilen verilere dayandır.
SADECE istenen JSON formatında yanıt ver.`;

    // Call both AIs in parallel
    const [claudeRes, openaiRes] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: couponPrompt }],
          system: systemPrompt,
          temperature: 0.4
        })
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: couponPrompt }
          ],
          temperature: 0.4,
          max_tokens: 2000
        })
      })
    ]);

    const claudeData = await claudeRes.json();
    const openaiData = await openaiRes.json();

    const claudeText = claudeData.content?.[0]?.text || '{}';
    const openaiText = openaiData.choices?.[0]?.message?.content || '{}';

    const claudeCoupon = parseAICouponResponse(claudeText);
    const openaiCoupon = parseAICouponResponse(openaiText);

    // Merge predictions
    const { safeCoupon, riskyCoupon, consensus } = mergeCouponPredictions(claudeCoupon, openaiCoupon);

    // Format date
    const tarih = today.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build Telegram message
    let telegramMessage = `**GÜNLÜK KUPON ANALİZİ**\n`;
    telegramMessage += `${tarih}\n`;
    telegramMessage += `${validMatches.length} maç analiz edildi\n\n`;

    if (safeCoupon) {
      telegramMessage += `**${safeCoupon.title}**\n`;
      telegramMessage += `━━━━━━━━━━━━━━━━━━━━━\n`;
      safeCoupon.predictions.forEach((p, i) => {
        const consensusTag = p.isConsensus ? '[Ortak]' : '';
        telegramMessage += `${i + 1}. ${p.match}\n`;
        telegramMessage += `   ${p.prediction} @ ${p.odds?.toFixed(2)} ${consensusTag}\n`;
        telegramMessage += `   Güven: %${p.confidence}\n\n`;
      });
      telegramMessage += `Toplam Oran: ${safeCoupon.totalOdds.toFixed(2)}\n`;
      telegramMessage += `Strateji: ${safeCoupon.strategy}\n\n`;
    }

    if (riskyCoupon) {
      telegramMessage += `**${riskyCoupon.title}**\n`;
      telegramMessage += `━━━━━━━━━━━━━━━━━━━━━\n`;
      riskyCoupon.predictions.forEach((p, i) => {
        const consensusTag = p.isConsensus ? '[Ortak]' : '';
        telegramMessage += `${i + 1}. ${p.match}\n`;
        telegramMessage += `   ${p.prediction} @ ${p.odds?.toFixed(2)} ${consensusTag}\n`;
        telegramMessage += `   Güven: %${p.confidence}\n\n`;
      });
      telegramMessage += `Toplam Oran: ${riskyCoupon.totalOdds.toFixed(2)}\n`;
      telegramMessage += `Strateji: ${riskyCoupon.strategy}\n\n`;
    }

    telegramMessage += `━━━━━━━━━━━━━━━━━━━━━\n`;
    telegramMessage += `AI Konsensüs: Güvenli ${consensus.safeCouponAgreement}/${safeCoupon?.predictions.length || 0} | Riskli ${consensus.riskyCouponAgreement}/${riskyCoupon?.predictions.length || 0}\n`;
    telegramMessage += `*[Ortak] = Her iki AI'ın da önerdiği tahminler*\n\n`;
    telegramMessage += `*Dual AI Kupon Ajanı*\n`;
    telegramMessage += `*Bahis kararları sizin sorumluluğunuzdadır*`;

    return NextResponse.json({
      success: true,
      tarih,
      matchCount: validMatches.length,
      matches: validMatches.map(m => ({
        id: m.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        competition: m.competition,
        date: m.date,
        hasData: !!m.matchData
      })),
      safeCoupon,
      riskyCoupon,
      consensus,
      telegramMessage,
      debug: {
        claudeRaw: claudeCoupon,
        openaiRaw: openaiCoupon
      }
    });

  } catch (error: any) {
    console.error('N8N Kupon API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Bir hata oluştu'
    }, { status: 500 });
  }
}

