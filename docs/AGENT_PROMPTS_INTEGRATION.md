# Agent Prompt'ları Entegrasyon Planı

## 📋 Durum

Kullanıcı yeni, geliştirilmiş agent prompt'ları verdi. Bu prompt'lar mevcut sisteme entegre edilmeli.

## 🎯 Yeni Prompt Özellikleri

1. **Stats Agent:**
   - 6 analiz katmanı (Form, xG, Matematiksel Modeller, Zaman Paternleri, Savunma/Hücum Dengesi, Sezgisel Yorum)
   - Daha detaylı JSON çıktı formatı
   - Gut feeling ve tuzak tespiti

2. **Odds Agent:**
   - 7 analiz katmanı (Implied Probability, Value Tespiti, Oran Hareketi, Sharp vs Public Money, Psikolojik Faktörler, Özel Marketler, Gut Feeling)
   - Detaylı value analizi
   - Trap alarmları

3. **Deep Analysis Agent:**
   - 7 analiz katmanı (Taktiksel, Motivasyon, Psikolojik, Kadro/Sakatlık, Tarihsel, Maçın Hikayesi, Öngörü ve Sezgi)
   - Motivasyon skoru hesaplama
   - Narrative analizi

4. **Master Strategist:**
   - 5 sentez adımı
   - Uyum ve çelişki analizi
   - Risk değerlendirmesi
   - Final strateji oluşturma

## 🔧 Entegrasyon Stratejisi

### Yöntem 1: Mevcut PROMPTS Constant'larını Güncelle (Önerilen)

**Avantajlar:**
- Mevcut yapıyı korur
- Minimum kod değişikliği
- Kolay test edilebilir

**Dezavantajlar:**
- Dosyalar çok uzun olabilir
- Prompt'lar çok detaylı

### Yöntem 2: Ayrı Dosyada Tut, Import Et

**Avantajlar:**
- Daha temiz kod
- Prompt'ları ayrı yönetebilirsin
- Versiyonlama kolay

**Dezavantajlar:**
- Import yapısı değişmeli
- Daha fazla dosya

## 📝 Uygulama Adımları

1. **Enhanced Prompts Dosyası Oluştur** ✅ (enhanced-prompts.ts oluşturuldu)
2. **Stats Agent Prompt'unu Güncelle** (İlk öncelik)
3. **Odds Agent Prompt'unu Güncelle**
4. **Deep Analysis Agent Prompt'unu Güncelle**
5. **Master Strategist Prompt'unu Güncelle**
6. **JSON Çıktı Formatlarını Test Et**
7. **Mevcut JSON Parsing'i Güncelle (gerekirse)**

## ⚠️ Dikkat Edilmesi Gerekenler

1. **JSON Format Uyumu:** Yeni prompt'ların JSON formatı mevcut parsing ile uyumlu mu?
2. **Çıktı Parsing:** Agent sonuçlarını parse eden kod yeni format ile çalışacak mı?
3. **Geriye Uyumluluk:** Eski format desteklenmeli mi?
4. **Test:** Her agent'ı ayrı ayrı test etmek gerekir

## 🚀 Hızlı Başlangıç

En basit yöntem: Mevcut `PROMPTS.tr` ve `PROMPTS.en` string'lerini yeni prompt'larla değiştirmek.

**Örnek (Stats Agent):**
```typescript
// src/lib/heurist/agents/stats.ts
const PROMPTS = {
  tr: ENHANCED_STATS_AGENT_PROMPT.tr,
  en: ENHANCED_STATS_AGENT_PROMPT.en,
  // ... mevcut kod değişmeden kalır
};
```

## 📌 Sonraki Adımlar

1. Stats Agent prompt'unu test et
2. JSON çıktısını kontrol et
3. Parsing kodunu güncelle (gerekirse)
4. Diğer agent'ları güncelle
