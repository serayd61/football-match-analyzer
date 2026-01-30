// src/app/api/chat/route.ts
// AI Football Chatbot - Gemini API
// Hızlı ve öz maç tahminleri

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    });

    // Chat history'yi Gemini formatına çevir
    const chatHistory = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Sen bir futbol analisti olarak davranacaksın. İşte kuralların:' }]
        },
        {
          role: 'model',
          parts: [{ text: SYSTEM_PROMPT }]
        },
        ...chatHistory
      ]
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

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
    model: 'gemini-1.5-flash',
    features: ['match_predictions', 'score_predictions', 'quick_analysis']
  });
}
