// src/app/api/chat/route.ts
// AI Football Chatbot - OpenAI GPT-4o-mini
// Hızlı ve öz maç tahminleri

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const SYSTEM_PROMPT = `Sen profesyonel bir futbol analisti ve bahis uzmanısın. Kullanıcılar sana maç soruları soracak.

KURALLAR:
1. KISA ve ÖZ cevaplar ver - maksimum 3-4 satır
2. Her zaman şu formatı kullan:
   🎯 [Takım1] vs [Takım2]
   
   MS: [1/X/2] - [Kısa sebep]
   Skor: [X-X]
   Ü/A: [2.5 Üst/Alt]
   KG: [Var/Yok]
   
   💡 [Tek cümle insight]

3. Türkçe cevap ver
4. Emoji kullan ama abartma
5. Eğer maç bilgisi yoksa, genel futbol bilgine göre tahmin yap
6. Bahis tavsiyesi verirken dikkatli ol, "garanti" kelimesini ASLA kullanma

ÖRNEK:
Kullanıcı: "Galatasaray Fenerbahçe ne olur?"

Cevap:
🎯 Galatasaray vs Fenerbahçe

MS: 1 - Ev avantajı + form üstünlüğü
Skor: 2-1
Ü/A: 2.5 Üst
KG: Var

💡 Derbi maçı, gol beklentisi yüksek.

---

Eğer kullanıcı futbol dışı bir soru sorarsa, kibarca "Ben sadece futbol ve maç tahminleri konusunda yardımcı olabilirim" de.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mesaj gerekli' }, { status: 400 });
    }

    // Chat history'yi OpenAI formatına çevir
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
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
