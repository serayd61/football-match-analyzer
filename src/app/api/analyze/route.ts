import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate } = body;
    
    // AGGRESSIVE DATA FETCHING - 8 parallel API calls
    const [
      homeTeamRes,
      awayTeamRes,
      h2hRes,
      homeFormRes,
      awayFormRes,
      homeSquadRes,
      awaySquadRes,
      leagueStandingsRes
    ] = await Promise.all([
      // Team details
      fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics;venue;coaches`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics;venue;coaches`),
      // Head to head - last 10 matches
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores;statistics&per_page=10`),
      // Home team last 10 matches
      fetch(`https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=teamId:${homeTeamId};status:FT&include=participants;scores;statistics&per_page=10&order=starting_at&sort=desc`),
      // Away team last 10 matches  
      fetch(`https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=teamId:${awayTeamId};status:FT&include=participants;scores;statistics&per_page=10&order=starting_at&sort=desc`),
      // Home team squad with injuries
      fetch(`https://api.sportmonks.com/v3/football/squads/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;position`),
      // Away team squad with injuries
      fetch(`https://api.sportmonks.com/v3/football/squads/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;position`),
      // League standings
      fetch(`https://api.sportmonks.com/v3/football/standings/seasons/25583?api_token=${SPORTMONKS_API_KEY}`)
    ]);

    const [homeTeam, awayTeam, h2h, homeForm, awayForm, homeSquad, awaySquad, standings] = await Promise.all([
      homeTeamRes.json(),
      awayTeamRes.json(),
      h2hRes.json(),
      homeFormRes.json(),
      awayFormRes.json(),
      homeSquadRes.json(),
      awaySquadRes.json(),
      leagueStandingsRes.json()
    ]);

    // Process H2H data
    const h2hAnalysis = (h2h.data || []).map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      return {
        date: match.starting_at,
        home: home?.name,
        away: away?.name,
        score: `${homeScore}-${awayScore}`,
        totalGoals: homeScore + awayScore
      };
    });

    // Calculate H2H stats
    let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;
    h2hAnalysis.forEach((m: any) => {
      const [hg, ag] = m.score.split('-').map(Number);
      if (m.home === homeTeamName) {
        if (hg > ag) homeWins++;
        else if (hg < ag) awayWins++;
        else draws++;
      } else {
        if (ag > hg) homeWins++;
        else if (ag < hg) awayWins++;
        else draws++;
      }
      totalGoals += m.totalGoals;
    });
    const avgGoalsH2H = h2hAnalysis.length > 0 ? (totalGoals / h2hAnalysis.length).toFixed(2) : 0;

    // Process form data
    const processForm = (matches: any[], teamId: number) => {
      let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
      let homeWins = 0, homeDraws = 0, homeLosses = 0;
      let awayWins = 0, awayDraws = 0, awayLosses = 0;
      let cleanSheets = 0, failedToScore = 0;
      let over25 = 0, btts = 0;
      
      (matches || []).forEach((match: any) => {
        const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
        const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        
        const teamGoals = isHome ? homeScore : awayScore;
        const oppGoals = isHome ? awayScore : homeScore;
        
        goalsFor += teamGoals;
        goalsAgainst += oppGoals;
        
        if (teamGoals > oppGoals) {
          wins++;
          if (isHome) homeWins++; else awayWins++;
        } else if (teamGoals < oppGoals) {
          losses++;
          if (isHome) homeLosses++; else awayLosses++;
        } else {
          draws++;
          if (isHome) homeDraws++; else awayDraws++;
        }
        
        if (oppGoals === 0) cleanSheets++;
        if (teamGoals === 0) failedToScore++;
        if (homeScore + awayScore > 2) over25++;
        if (homeScore > 0 && awayScore > 0) btts++;
      });
      
      const total = matches?.length || 1;
      return {
        wins, draws, losses,
        goalsFor, goalsAgainst,
        avgGoalsFor: (goalsFor / total).toFixed(2),
        avgGoalsAgainst: (goalsAgainst / total).toFixed(2),
        homeRecord: `${homeWins}W-${homeDraws}D-${homeLosses}L`,
        awayRecord: `${awayWins}W-${awayDraws}D-${awayLosses}L`,
        cleanSheets,
        failedToScore,
        over25Pct: ((over25 / total) * 100).toFixed(0),
        bttsPct: ((btts / total) * 100).toFixed(0),
        form: (matches || []).slice(0, 5).map((m: any) => {
          const isHome = m.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
          const homeScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
          const awayScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
          const teamGoals = isHome ? homeScore : awayScore;
          const oppGoals = isHome ? awayScore : homeScore;
          if (teamGoals > oppGoals) return 'W';
          if (teamGoals < oppGoals) return 'L';
          return 'D';
        }).join('')
      };
    };

    const homeStats = processForm(homeForm.data, homeTeamId);
    const awayStats = processForm(awayForm.data, awayTeamId);

    // Find league positions
    let homePosition = 'N/A', awayPosition = 'N/A';
    const standingsData = standings.data || [];
    standingsData.forEach((s: any) => {
      if (s.participant_id === homeTeamId) homePosition = s.position;
      if (s.participant_id === awayTeamId) awayPosition = s.position;
    });

    // Build SUPER DETAILED prompt
    const analysisPrompt = `🔥 DETAYLI FUTBOL MAÇ ANALİZİ 🔥

═══════════════════════════════════════
📌 MAÇ BİLGİSİ
═══════════════════════════════════════
Maç: ${homeTeamName} vs ${awayTeamName}
Lig: ${competition}
Tarih: ${matchDate}

═══════════════════════════════════════
🏠 EV SAHİBİ: ${homeTeamName}
═══════════════════════════════════════
📍 Şehir: ${homeTeam.data?.city || 'Bilinmiyor'}
🏟️ Stadyum: ${homeTeam.data?.venue?.name || 'Bilinmiyor'} (Kapasite: ${homeTeam.data?.venue?.capacity || 'N/A'})
📊 Lig Sırası: ${homePosition}. sıra
👔 Teknik Direktör: ${homeTeam.data?.coaches?.[0]?.common_name || 'Bilinmiyor'}

📈 SON 10 MAÇ FORMU:
- Form: ${homeStats.form} (Son 5 maç)
- Galibiyet/Beraberlik/Mağlubiyet: ${homeStats.wins}W-${homeStats.draws}D-${homeStats.losses}L
- Evdeki Performans: ${homeStats.homeRecord}
- Atılan Gol Ortalaması: ${homeStats.avgGoalsFor} gol/maç
- Yenilen Gol Ortalaması: ${homeStats.avgGoalsAgainst} gol/maç
- Gol Yemeden Bitirilen Maç: ${homeStats.cleanSheets}
- Gol Atamadan Bitirilen Maç: ${homeStats.failedToScore}
- 2.5 Üst Oranı: %${homeStats.over25Pct}
- KG Var Oranı: %${homeStats.bttsPct}

═══════════════════════════════════════
✈️ DEPLASMAN: ${awayTeamName}
═══════════════════════════════════════
📍 Şehir: ${awayTeam.data?.city || 'Bilinmiyor'}
📊 Lig Sırası: ${awayPosition}. sıra
👔 Teknik Direktör: ${awayTeam.data?.coaches?.[0]?.common_name || 'Bilinmiyor'}

📈 SON 10 MAÇ FORMU:
- Form: ${awayStats.form} (Son 5 maç)
- Galibiyet/Beraberlik/Mağlubiyet: ${awayStats.wins}W-${awayStats.draws}D-${awayStats.losses}L
- Deplasman Performansı: ${awayStats.awayRecord}
- Atılan Gol Ortalaması: ${awayStats.avgGoalsFor} gol/maç
- Yenilen Gol Ortalaması: ${awayStats.avgGoalsAgainst} gol/maç
- Gol Yemeden Bitirilen Maç: ${awayStats.cleanSheets}
- Gol Atamadan Bitirilen Maç: ${awayStats.failedToScore}
- 2.5 Üst Oranı: %${awayStats.over25Pct}
- KG Var Oranı: %${awayStats.bttsPct}

═══════════════════════════════════════
⚔️ KARŞILAŞMA GEÇMİŞİ (H2H) - Son 10 Maç
═══════════════════════════════════════
${homeTeamName} Galibiyetleri: ${homeWins}
${awayTeamName} Galibiyetleri: ${awayWins}
Beraberlikler: ${draws}
Ortalama Gol: ${avgGoalsH2H} gol/maç

Son Karşılaşmalar:
${h2hAnalysis.slice(0, 5).map((m: any) => `- ${m.date?.split(' ')[0]}: ${m.home} ${m.score} ${m.away}`).join('\n')}

═══════════════════════════════════════
🎯 ANALİZ TALİMATLARI
═══════════════════════════════════════
Yukarıdaki TÜM verileri analiz et ve şu kriterlere göre tahmin yap:

1. FORM ANALİZİ: Son 10 maçtaki performans, ev/deplasman farkı
2. GOL ANALİZİ: Gol ortalamaları, 2.5 üst/alt eğilimi, KG var/yok eğilimi
3. H2H ANALİZİ: Geçmiş karşılaşmalardaki üstünlük
4. TAKTİKSEL ANALİZ: Teknik direktör tarzı, takım güçlü/zayıf yönleri
5. MOTİVASYON: Lig sırası, hedefler, psikolojik faktörler

SADECE şu formatta JSON yanıt ver:
{
  "ms_tahmini": "1" veya "X" veya "2",
  "ms_guven": 50-100 arası sayı,
  "gol_tahmini": "ALT" veya "UST",
  "gol_guven": 50-100 arası sayı,
  "skor": "X-X" formatında,
  "kg_var_mi": "VAR" veya "YOK",
  "kg_guven": 50-100 arası sayı,
  "iy_ms": "1/1" veya "1/X" veya "1/2" veya "X/1" veya "X/X" veya "X/2" veya "2/1" veya "2/X" veya "2/2",
  "iy_ms_guven": 50-100 arası sayı,
  "toplam_korner": "9.5 ALT" veya "9.5 UST",
  "korner_guven": 50-100 arası sayı,
  "aciklama": "Detaylı 2-3 cümlelik analiz açıklaması"
}`;

    // Call all 3 AIs in parallel
    const [claudeRes, openaiRes, geminiRes] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: analysisPrompt }],
          system: 'Sen dünya çapında ünlü bir futbol analisti ve profesyonel bahis uzmanısın. Verilen istatistikleri derinlemesine analiz ederek yüksek isabetle tahminler yapıyorsun. SADECE JSON formatında yanıt ver.'
        })
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Sen dünya çapında ünlü bir futbol analisti ve profesyonel bahis uzmanısın. Verilen istatistikleri derinlemesine analiz ederek yüksek isabetle tahminler yapıyorsun. SADECE JSON formatında yanıt ver.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      }),
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `Sen dünya çapında ünlü bir futbol analisti ve profesyonel bahis uzmanısın. SADECE JSON formatında yanıt ver.\n\n${analysisPrompt}` 
            }] 
          }],
          generationConfig: { 
            temperature: 0.3, 
            maxOutputTokens: 1500,
            responseMimeType: "application/json"
          }
        })
      })
    ]);

    const claudeData = await claudeRes.json();
    const openaiData = await openaiRes.json();
    const geminiData = await geminiRes.json();

    let claudePrediction, openaiPrediction, geminiPrediction;
    
    try {
      const claudeText = claudeData.content?.[0]?.text || '{}';
      claudePrediction = JSON.parse(claudeText.replace(/```json\n?|\n?```/g, '').trim());
    } catch { claudePrediction = null; }
    
    try {
      const openaiText = openaiData.choices?.[0]?.message?.content || '{}';
      openaiPrediction = JSON.parse(openaiText.replace(/```json\n?|\n?```/g, '').trim());
    } catch { openaiPrediction = null; }

    try {
      const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (geminiText) {
        const jsonMatch = geminiText.match(/\{[\s\S]*?\}/);
        geminiPrediction = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } else {
        geminiPrediction = null;
      }
    } catch { geminiPrediction = null; }

    const predictions = [claudePrediction, openaiPrediction, geminiPrediction].filter(p => p !== null);
    
    // Enhanced consensus calculation
    const calculateConsensus = (key: string, predictions: any[]) => {
      const votes: Record<string, number> = {};
      const guvens: Record<string, number[]> = {};
      predictions.forEach(p => {
        if (p?.[key]) {
          votes[p[key]] = (votes[p[key]] || 0) + 1;
          if (!guvens[p[key]]) guvens[p[key]] = [];
          guvens[p[key]].push(p[`${key.replace('_tahmini', '_guven').replace('_var_mi', '_guven')}`] || 50);
        }
      });
      for (const [val, count] of Object.entries(votes)) {
        if (count >= 2) {
          return { 
            value: val, 
            count, 
            guven: Math.round(guvens[val].reduce((a, b) => a + b, 0) / guvens[val].length) 
          };
        }
      }
      return null;
    };

    const msConsensus = calculateConsensus('ms_tahmini', predictions);
    const golConsensus = calculateConsensus('gol_tahmini', predictions);
    const kgConsensus = calculateConsensus('kg_var_mi', predictions);
    const iyMsConsensus = calculateConsensus('iy_ms', predictions);
    const kornerConsensus = calculateConsensus('toplam_korner', predictions);

    // Build enhanced analysis text
    let analysisText = `🤖 **3'LÜ AI DETAYLI ANALİZ**\n`;
    analysisText += `📊 ${homeTeamName} vs ${awayTeamName}\n\n`;

    // Stats summary
    analysisText += `📈 **FORM KARŞILAŞTIRMASI**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🏠 ${homeTeamName}: ${homeStats.form} | Sıra: ${homePosition}\n`;
    analysisText += `✈️ ${awayTeamName}: ${awayStats.form} | Sıra: ${awayPosition}\n`;
    analysisText += `⚔️ H2H: ${homeWins}-${draws}-${awayWins} | Ort: ${avgGoalsH2H} gol\n\n`;

    if (msConsensus || golConsensus || kgConsensus) {
      analysisText += `✅ **ORTAK TAHMİNLER**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      
      if (msConsensus) {
        const msText = msConsensus.value === '1' ? homeTeamName : msConsensus.value === '2' ? awayTeamName : 'Beraberlik';
        const emoji = msConsensus.count === 3 ? '🎯🎯🎯' : '🎯🎯';
        analysisText += `${emoji} **MS:** ${msText} (${msConsensus.value}) - %${msConsensus.guven} [${msConsensus.count}/3]\n`;
      }
      
      if (golConsensus) {
        const emoji = golConsensus.count === 3 ? '⚽⚽⚽' : '⚽⚽';
        analysisText += `${emoji} **2.5 Gol:** ${golConsensus.value} - %${golConsensus.guven} [${golConsensus.count}/3]\n`;
      }
      
      if (kgConsensus) {
        const emoji = kgConsensus.count === 3 ? '🥅🥅🥅' : '🥅🥅';
        analysisText += `${emoji} **KG:** ${kgConsensus.value} - %${kgConsensus.guven} [${kgConsensus.count}/3]\n`;
      }

      if (iyMsConsensus) {
        const emoji = iyMsConsensus.count === 3 ? '⏱️⏱️⏱️' : '⏱️⏱️';
        analysisText += `${emoji} **İY/MS:** ${iyMsConsensus.value} - %${iyMsConsensus.guven} [${iyMsConsensus.count}/3]\n`;
      }

      if (kornerConsensus) {
        const emoji = kornerConsensus.count === 3 ? '🚩🚩🚩' : '🚩🚩';
        analysisText += `${emoji} **Korner:** ${kornerConsensus.value} - %${kornerConsensus.guven} [${kornerConsensus.count}/3]\n`;
      }
      
      analysisText += `\n`;
    }

    // Disagreements
    const disagreements = [];
    if (!msConsensus) disagreements.push(`MS: C=${claudePrediction?.ms_tahmini || '-'}, O=${openaiPrediction?.ms_tahmini || '-'}, G=${geminiPrediction?.ms_tahmini || '-'}`);
    if (!golConsensus) disagreements.push(`Gol: C=${claudePrediction?.gol_tahmini || '-'}, O=${openaiPrediction?.gol_tahmini || '-'}, G=${geminiPrediction?.gol_tahmini || '-'}`);
    if (!kgConsensus) disagreements.push(`KG: C=${claudePrediction?.kg_var_mi || '-'}, O=${openaiPrediction?.kg_var_mi || '-'}, G=${geminiPrediction?.kg_var_mi || '-'}`);

    if (disagreements.length > 0) {
      analysisText += `⚠️ **UZLAŞI YOK**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      disagreements.forEach(d => { analysisText += `❌ ${d}\n`; });
      analysisText += `\n`;
    }

    analysisText += `📈 **SKOR TAHMİNLERİ**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🟠 Claude: ${claudePrediction?.skor || '-'}\n`;
    analysisText += `🟢 OpenAI: ${openaiPrediction?.skor || '-'}\n`;
    analysisText += `🔵 Gemini: ${geminiPrediction?.skor || '-'}\n\n`;

    analysisText += `📝 **AI ANALİZLERİ**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🟠 ${claudePrediction?.aciklama || '-'}\n\n`;
    analysisText += `🟢 ${openaiPrediction?.aciklama || '-'}\n\n`;
    analysisText += `🔵 ${geminiPrediction?.aciklama || '-'}\n\n`;

    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `💡 *3/3 = Çok Güvenilir | 2/3 = Güvenilir | Uzlaşı Yok = Riskli*\n`;
    analysisText += `📊 *${(predictions.length * 8)} veri noktası analiz edildi*`;

    return NextResponse.json({ 
      success: true, 
      analysis: analysisText, 
      stats: { homeStats, awayStats, h2hAnalysis, homePosition, awayPosition },
      claudePrediction, 
      openaiPrediction, 
      geminiPrediction 
    });
    
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
