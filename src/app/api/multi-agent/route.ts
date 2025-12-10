import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Agent yapıları
interface AgentPrediction {
  agent: string;
  ms: string;
  gol: string;
  kg: string;
  skor: string;
  guven: number;
  reasoning: string;
}

interface DebateMessage {
  from: string;
  to: string;
  message: string;
  round: number;
}

// Claude Agent
async function claudeAgent(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      system: systemPrompt
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// OpenAI Agent
async function openaiAgent(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 2000
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Gemini Agent
async function geminiAgent(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2000 }
    })
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Maç verilerini çek
async function fetchMatchData(matches: any[]) {
  const matchDataPromises = matches.map(async (match) => {
    const [h2hRes, homeFormRes, awayFormRes] = await Promise.all([
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${match.homeTeamId}/${match.awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=5`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=teamId:${match.homeTeamId};status:FT&include=participants;scores&per_page=5&sort=desc`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=teamId:${match.awayTeamId};status:FT&include=participants;scores&per_page=5&sort=desc`)
    ]);

    const [h2h, homeForm, awayForm] = await Promise.all([
      h2hRes.json(),
      homeFormRes.json(),
      awayFormRes.json()
    ]);

    return {
      ...match,
      h2h: h2h.data || [],
      homeForm: homeForm.data || [],
      awayForm: awayForm.data || []
    };
  });

  return Promise.all(matchDataPromises);
}

// Form hesapla
function calculateForm(matches: any[], teamId: number) {
  let form = '';
  let goalsFor = 0, goalsAgainst = 0;
  
  matches.slice(0, 5).forEach((m: any) => {
    const isHome = m.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
    const homeScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
    const awayScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
    
    const teamGoals = isHome ? homeScore : awayScore;
    const oppGoals = isHome ? awayScore : homeScore;
    
    goalsFor += teamGoals;
    goalsAgainst += oppGoals;
    
    if (teamGoals > oppGoals) form += 'W';
    else if (teamGoals < oppGoals) form += 'L';
    else form += 'D';
  });

  return { form, avgGoals: (goalsFor / 5).toFixed(1), avgConceded: (goalsAgainst / 5).toFixed(1) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matches } = body; // Array of matches to analyze

    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: 'Maç listesi boş' }, { status: 400 });
    }

    // 1. Maç verilerini çek
    const matchesWithData = await fetchMatchData(matches);

    // 2. Her maç için özet oluştur
    const matchSummaries = matchesWithData.map((m: any) => {
      const homeForm = calculateForm(m.homeForm, m.homeTeamId);
      const awayForm = calculateForm(m.awayForm, m.awayTeamId);
      
      return `
📌 ${m.homeTeam} vs ${m.awayTeam}
   🏠 ${m.homeTeam}: Form ${homeForm.form} | Ort Gol: ${homeForm.avgGoals} | Ort Yenilen: ${homeForm.avgConceded}
   ✈️ ${m.awayTeam}: Form ${awayForm.form} | Ort Gol: ${awayForm.avgGoals} | Ort Yenilen: ${awayForm.avgConceded}
   ⚔️ H2H: Son ${m.h2h.length} maç mevcut`;
    }).join('\n');

    // 3. ROUND 1: Her agent bağımsız analiz yapar
    const round1Prompt = `
🎯 KUPON ANALİZİ - ROUND 1

Aşağıdaki maçları analiz et ve her biri için tahmin yap:

${matchSummaries}

Her maç için şu formatta JSON array döndür:
[
  {
    "mac": "Ev Sahibi vs Deplasman",
    "ms": "1" veya "X" veya "2",
    "gol": "ALT" veya "UST",
    "kg": "VAR" veya "YOK",
    "skor": "X-X",
    "guven": 50-100,
    "mantik": "Kısa açıklama"
  }
]

SADECE JSON döndür, başka bir şey yazma.`;

    const agentSystemPrompt = `Sen dünyaca ünlü bir futbol analisti ve profesyonel bahis uzmanısın. 
İstatistikleri derinlemesine analiz eder, form durumunu değerlendirir ve mantıklı tahminler yaparsın.
Sadece güvendiğin tahminleri yap. Emin olmadığın maçlarda düşük güven puanı ver.`;

    // Paralel olarak 3 agent çalıştır
    const [claudeR1, openaiR1, geminiR1] = await Promise.all([
      claudeAgent(round1Prompt, agentSystemPrompt),
      openaiAgent(round1Prompt, agentSystemPrompt),
      geminiAgent(round1Prompt, agentSystemPrompt)
    ]);

    // JSON parse
    let claudePreds: any[] = [], openaiPreds: any[] = [], geminiPreds: any[] = [];
    
    try {
      const claudeMatch = claudeR1.match(/\[[\s\S]*\]/);
      claudePreds = claudeMatch ? JSON.parse(claudeMatch[0]) : [];
    } catch { claudePreds = []; }
    
    try {
      const openaiMatch = openaiR1.match(/\[[\s\S]*\]/);
      openaiPreds = openaiMatch ? JSON.parse(openaiMatch[0]) : [];
    } catch { openaiPreds = []; }
    
    try {
      const geminiMatch = geminiR1.match(/\[[\s\S]*\]/);
      geminiPreds = geminiMatch ? JSON.parse(geminiMatch[0]) : [];
    } catch { geminiPreds = []; }

    // 4. ROUND 2: Tartışma - Farklılıkları çöz
    const disagreements: any[] = [];
    const agreements: any[] = [];

    matchesWithData.forEach((match: any, idx: number) => {
      const cp = claudePreds[idx] || {};
      const op = openaiPreds[idx] || {};
      const gp = geminiPreds[idx] || {};

      const msVotes = [cp.ms, op.ms, gp.ms].filter(Boolean);
      const golVotes = [cp.gol, op.gol, gp.gol].filter(Boolean);
      const kgVotes = [cp.kg, op.kg, gp.kg].filter(Boolean);

      // MS için oy say
      const msCounts: Record<string, number> = {};
      msVotes.forEach(v => { msCounts[v] = (msCounts[v] || 0) + 1; });
      
      const golCounts: Record<string, number> = {};
      golVotes.forEach(v => { golCounts[v] = (golCounts[v] || 0) + 1; });
      
      const kgCounts: Record<string, number> = {};
      kgVotes.forEach(v => { kgCounts[v] = (kgCounts[v] || 0) + 1; });

      // En yüksek oyu bul
      const topMs = Object.entries(msCounts).sort((a, b) => b[1] - a[1])[0];
      const topGol = Object.entries(golCounts).sort((a, b) => b[1] - a[1])[0];
      const topKg = Object.entries(kgCounts).sort((a, b) => b[1] - a[1])[0];

      const avgGuven = Math.round(([cp.guven, op.guven, gp.guven].filter(Boolean).reduce((a, b) => a + b, 0)) / 3);

      if (topMs && topMs[1] >= 2) {
        agreements.push({
          mac: `${match.homeTeam} vs ${match.awayTeam}`,
          ms: topMs[0],
          msOy: topMs[1],
          gol: topGol ? topGol[0] : null,
          golOy: topGol ? topGol[1] : 0,
          kg: topKg ? topKg[0] : null,
          kgOy: topKg ? topKg[1] : 0,
          skorlar: [cp.skor, op.skor, gp.skor].filter(Boolean),
          guven: avgGuven,
          claude: cp,
          openai: op,
          gemini: gp
        });
      } else {
        disagreements.push({
          mac: `${match.homeTeam} vs ${match.awayTeam}`,
          claude: cp,
          openai: op,
          gemini: gp
        });
      }
    });

    // 5. ROUND 3: Anlaşmazlıklar için hakem turuna git (Claude karar verir)
    let resolvedDisagreements: any[] = [];
    
    if (disagreements.length > 0) {
      const debatePrompt = `
🔥 HAKEM TURU - ANLAŞMAZLIK ÇÖZÜMÜ

AI'lar aşağıdaki maçlarda anlaşamadı. Sen hakem olarak final kararı vereceksin.

${disagreements.map(d => `
📌 ${d.mac}
   🟠 Claude: MS=${d.claude?.ms || '-'}, Gol=${d.claude?.gol || '-'}, KG=${d.claude?.kg || '-'} (Güven: ${d.claude?.guven || 0})
      Mantık: ${d.claude?.mantik || '-'}
   🟢 OpenAI: MS=${d.openai?.ms || '-'}, Gol=${d.openai?.gol || '-'}, KG=${d.openai?.kg || '-'} (Güven: ${d.openai?.guven || 0})
      Mantık: ${d.openai?.mantik || '-'}
   🔵 Gemini: MS=${d.gemini?.ms || '-'}, Gol=${d.gemini?.gol || '-'}, KG=${d.gemini?.kg || '-'} (Güven: ${d.gemini?.guven || 0})
      Mantık: ${d.gemini?.mantik || '-'}
`).join('\n')}

Her maç için EN MANTIKLI tahmini seç veya kendi kararını ver.
Eğer çok riskli görüyorsan "SKIP" de.

JSON formatında döndür:
[
  {
    "mac": "Ev Sahibi vs Deplasman",
    "karar": "1" veya "X" veya "2" veya "SKIP",
    "gol": "ALT" veya "UST" veya "SKIP",
    "kg": "VAR" veya "YOK" veya "SKIP",
    "guven": 50-100,
    "neden": "Neden bu kararı verdin"
  }
]`;

      const judgeResponse = await claudeAgent(debatePrompt, 
        'Sen tarafsız bir hakem ve baş analistsin. Diğer AI\'ların argümanlarını değerlendir ve en mantıklı kararı ver. Riskli maçları SKIP et.');
      
      try {
        const judgeMatch = judgeResponse.match(/\[[\s\S]*\]/);
        resolvedDisagreements = judgeMatch ? JSON.parse(judgeMatch[0]) : [];
      } catch {
        resolvedDisagreements = [];
      }
    }

    // 6. Final Kupon Oluştur
    const finalKupon: any[] = [];

    // Anlaşılan maçları ekle
    agreements.forEach(a => {
      if (a.guven >= 60) {
        finalKupon.push({
          mac: a.mac,
          tahmin: `MS: ${a.ms}`,
          tip: 'MS',
          secim: a.ms,
          guven: a.guven,
          oyBirligi: `${a.msOy}/3`,
          kaynak: 'Uzlaşı'
        });

        if (a.gol && a.golOy >= 2) {
          finalKupon.push({
            mac: a.mac,
            tahmin: `2.5 ${a.gol}`,
            tip: 'GOL',
            secim: a.gol,
            guven: a.guven,
            oyBirligi: `${a.golOy}/3`,
            kaynak: 'Uzlaşı'
          });
        }
      }
    });

    // Hakem kararlarını ekle
    resolvedDisagreements.forEach(r => {
      if (r.karar !== 'SKIP' && r.guven >= 65) {
        finalKupon.push({
          mac: r.mac,
          tahmin: `MS: ${r.karar}`,
          tip: 'MS',
          secim: r.karar,
          guven: r.guven,
          oyBirligi: 'Hakem',
          kaynak: 'Hakem Kararı'
        });
      }
    });

    // 7. Çıktı oluştur
    let output = `🎰 **AI KUPON SİSTEMİ**\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    output += `📊 **ANALİZ ÖZETİ**\n`;
    output += `• Toplam Maç: ${matchesWithData.length}\n`;
    output += `• Uzlaşı Sağlanan: ${agreements.length}\n`;
    output += `• Anlaşmazlık: ${disagreements.length}\n`;
    output += `• Hakem Kararı: ${resolvedDisagreements.filter(r => r.karar !== 'SKIP').length}\n\n`;

    output += `🎯 **FİNAL KUPON**\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (finalKupon.length === 0) {
      output += `❌ Güvenilir tahmin bulunamadı. AI'lar uzlaşamadı.\n`;
    } else {
      finalKupon.forEach((k, i) => {
        const emoji = k.guven >= 80 ? '🔥' : k.guven >= 70 ? '✅' : '⚠️';
        output += `${i + 1}. ${emoji} ${k.mac}\n`;
        output += `   📌 ${k.tahmin} | Güven: %${k.guven} | ${k.oyBirligi}\n`;
      });
    }

    output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `💡 *🔥 = Çok Güvenilir | ✅ = Güvenilir | ⚠️ = Riskli*\n`;
    output += `🤖 *3 AI + Hakem sistemi ile analiz edildi*`;

    return NextResponse.json({
      success: true,
      kupon: output,
      finalKupon,
      details: {
        agreements,
        disagreements,
        resolvedDisagreements,
        claudePreds,
        openaiPreds,
        geminiPreds
      }
    });

  } catch (error: any) {
    console.error('Multi-Agent Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
