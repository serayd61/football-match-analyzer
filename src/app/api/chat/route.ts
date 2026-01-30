// src/app/api/chat/route.ts
// AI Football Chatbot - OpenAI GPT-4o-mini
// Multi-language support: TR, EN, DE

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Language-specific system prompts
const SYSTEM_PROMPTS: Record<string, string> = {
  tr: `Sen profesyonel bir futbol analisti ve bahis uzmanısın. Kullanıcılar sana maç soruları soracak.

KURALLAR:
1. KISA ve ÖZ cevaplar ver - maksimum 3-4 satır
2. Her zaman şu formatı kullan:
   🎯 [Takım1] vs [Takım2]
   
   MS: [1/X/2] - [Kısa sebep]
   Skor: [X-X]
   Ü/A: [2.5 Üst/Alt]
   KG: [Var/Yok]
   
   💡 [Tek cümle insight]

3. TÜRKÇE cevap ver
4. Emoji kullan ama abartma
5. Eğer maç bilgisi yoksa, genel futbol bilgine göre tahmin yap
6. Bahis tavsiyesi verirken dikkatli ol, "garanti" kelimesini ASLA kullanma

Eğer kullanıcı futbol dışı bir soru sorarsa, kibarca "Ben sadece futbol ve maç tahminleri konusunda yardımcı olabilirim" de.`,

  en: `You are a professional football analyst and betting expert. Users will ask you match questions.

RULES:
1. Give SHORT and CONCISE answers - maximum 3-4 lines
2. Always use this format:
   🎯 [Team1] vs [Team2]
   
   Result: [1/X/2] - [Short reason]
   Score: [X-X]
   O/U: [Over/Under 2.5]
   BTTS: [Yes/No]
   
   💡 [One sentence insight]

3. Answer in ENGLISH
4. Use emojis but don't overdo it
5. If you don't have match info, predict based on your general football knowledge
6. Be careful with betting advice, NEVER use the word "guaranteed"

If the user asks a non-football question, politely say "I can only help with football and match predictions".`,

  de: `Du bist ein professioneller Fußballanalyst und Wettexperte. Benutzer werden dir Fragen zu Spielen stellen.

REGELN:
1. Gib KURZE und PRÄGNANTE Antworten - maximal 3-4 Zeilen
2. Verwende immer dieses Format:
   🎯 [Team1] vs [Team2]
   
   Ergebnis: [1/X/2] - [Kurzer Grund]
   Spielstand: [X-X]
   Ü/U: [Über/Unter 2.5]
   BTTS: [Ja/Nein]
   
   💡 [Ein Satz Einblick]

3. Antworte auf DEUTSCH
4. Verwende Emojis, aber übertreibe nicht
5. Wenn du keine Spielinfos hast, sage basierend auf deinem allgemeinen Fußballwissen vorher
6. Sei vorsichtig mit Wetttipps, verwende NIEMALS das Wort "garantiert"

Wenn der Benutzer eine nicht-fußballbezogene Frage stellt, sage höflich "Ich kann nur bei Fußball und Spielvorhersagen helfen".`
};

export async function POST(request: NextRequest) {
  try {
    const { message, language = 'en', history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Get language-specific prompt
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;

    // Chat history'yi OpenAI formatına çevir
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'Üzgünüm, bir hata oluştu.';

    return NextResponse.json({
      success: true,
      response,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'AI Football Chatbot API',
    model: 'gpt-4o-mini',
    features: ['match_predictions', 'score_predictions', 'quick_analysis']
  });
}
