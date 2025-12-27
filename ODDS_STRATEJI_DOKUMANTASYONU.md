# 💰 ODDS STRATEJİSİ - Detaylı Dokümantasyon

## 📚 Temel Kavramlar

### 1. Implied Probability (Oranlardan Çıkan Olasılık)
**Formül:** `Implied Probability = (1 / Oran) × 100`

**Örnekler:**
- Oran 2.00 → Implied Probability = (1 / 2.00) × 100 = **50%**
- Oran 3.50 → Implied Probability = (1 / 3.50) × 100 = **29%**
- Oran 1.80 → Implied Probability = (1 / 1.80) × 100 = **56%**

**Anlamı:** Bahis şirketi bu oranla %50 (veya %29, %56) olasılık veriyor demektir.

### 2. Form-Based Probability (Form Verilerinden Hesaplanan Gerçek Olasılık)
**Hesaplama Yöntemi:**
- Son 5-10 maç formu
- Gol ortalamaları
- H2H (Kafa kafaya) verileri
- Ev/Deplasman performansı
- İstatistiksel modeller

**Örnek:**
- Ev sahibi son 5 maçta 4 galibiyet → Form %60 gösteriyor
- Deplasman son 5 maçta 2 galibiyet → Form %30 gösteriyor
- Over 2.5: Son 5 maçta %70 → Form %70 gösteriyor

### 3. VALUE (Değer)
**Formül:** `VALUE = Form Olasılığı - Implied Olasılık`

**Örnekler:**
- Ev oranı 2.00 = %50 implied
- Form analizi %60 gösteriyor
- **VALUE = 60% - 50% = +10%** ✅ (Value var!)

- Over 2.5 oranı 1.80 = %56 implied
- İstatistik %55 gösteriyor
- **VALUE = 55% - 56% = -1%** ❌ (Value yok)

### 4. Value Rating (Değer Değerlendirmesi)
- **High Value:** +15% ve üzeri
- **Medium Value:** +8% ile +15% arası
- **Low Value:** +3% ile +8% arası
- **None:** +3% altı veya negatif

## 🎯 Value Bet Tespit Stratejisi

### Adım 1: Oranları Al
```
Ev Sahibi: 2.00
Beraberlik: 3.50
Deplasman: 3.50
Over 2.5: 1.80
Under 2.5: 1.90
BTTS Evet: 1.75
BTTS Hayır: 2.00
```

### Adım 2: Implied Probability Hesapla
```
Ev: (1 / 2.00) × 100 = 50%
Beraberlik: (1 / 3.50) × 100 = 29%
Deplasman: (1 / 3.50) × 100 = 29%
Over 2.5: (1 / 1.80) × 100 = 56%
BTTS Evet: (1 / 1.75) × 100 = 57%
```

### Adım 3: Form Verilerinden Gerçek Olasılık Hesapla
```
Ev Form: WLWWW (4 galibiyet, 1 mağlubiyet)
→ Form Puanı: 12 puan
→ Form Olasılığı: 33 + (12-5)×2 + (4-1)×5 + 10 = 33 + 14 + 15 + 10 = 72%

Deplasman Form: DLLWD (1 galibiyet, 2 mağlubiyet)
→ Form Puanı: 5 puan
→ Form Olasılığı: 33 + (5-12)×2 + (1-4)×5 - 5 = 33 - 14 - 15 - 5 = -1% → 20% (min)

Over 2.5: Son 5 maçta %70
→ Form Olasılığı: 70%
```

### Adım 4: Value Hesapla
```
Ev: 72% - 50% = +22% ✅ (GÜÇLÜ VALUE!)
Deplasman: 20% - 29% = -9% ❌ (Value yok)
Over 2.5: 70% - 56% = +14% ✅ (ORTA VALUE)
BTTS: 55% - 57% = -2% ❌ (Value yok)
```

### Adım 5: En İyi Value'yu Seç
**En yüksek value:** Ev Sahibi (+22%)
**Value Rating:** High (15% üzeri)
**Öneri:** Ev Sahibi kazanır (2.00 oranında)

## 📊 Odds Movement (Oran Hareketleri)

### Oran Düşüyor (Dropping)
- **Anlamı:** Bahis şirketi olasılığı artırdı
- **Neden:** Büyük bahisler (sharp money) geldi
- **Strateji:** Eğer form analizi de value gösteriyorsa → **GERÇEK VALUE**

### Oran Yükseliyor (Rising)
- **Anlamı:** Bahis şirketi olasılığı düşürdü
- **Neden:** Genel bahisçiler (public money) geldi
- **Strateji:** Dikkatli ol! Form analizi value gösteriyorsa bile → **CAUTION**

### Oran Stabil (Stable)
- **Anlamı:** Oran değişmedi
- **Strateji:** Form analizine göre karar ver

## 🔥 Sharp Money (Profesyonel Para)

### Sharp Money Nedir?
Profesyonel bahisçilerin (sharp bettors) yaptığı bahisler. Bu bahisler genellikle doğru tahminlere dayanır.

### Sharp Money Tespiti
1. **Oran Hareketi:** Oran aniden düştü (büyük para geldi)
2. **Line Shopping:** Farklı bahis şirketlerinde oran farkı
3. **Volume:** Yüksek bahis hacmi
4. **Timing:** Maçtan önce son dakikalarda gelen büyük bahisler

### Sharp Money Onayı
Eğer:
- Oran düşüyor VE
- Form analizi value gösteriyor
→ **GERÇEK VALUE!** (Yüksek güven)

## 📈 Asian Handicap Analizi

### Asian Handicap Nedir?
Takımlardan birine gol avantajı/dezavantajı vererek daha dengeli bahis oluşturma.

### Handikap Hesaplama
**Form Farkına Göre:**
- Form farkı > 25% → -1.5 / +1.5
- Form farkı > 15% → -1.0 / +1.0
- Form farkı > 8% → -0.5 / +0.5
- Form farkı -8% ile +8% arası → 0 (Draw No Bet)
- Form farkı < -8% → +0.5 / -0.5

**Örnek:**
- Ev form %60, Dep form %30 → Fark: +30%
- **Öneri:** -1.5 Ev Sahibi (Ev sahibi 1.5 gol avantajı ile)

## 🎲 Correct Score (Doğru Skor) Tahmini

### Hesaplama Yöntemi
1. Beklenen gol sayısı (Expected Goals)
2. Form verileri
3. H2H skorları
4. İstatistiksel modeller

**Örnek:**
- Ev: 1.2 gol atıyor, 1.0 gol yiyor
- Dep: 0.9 gol atıyor, 1.3 gol yiyor
- **En Olası Skor:** 1-0 veya 1-1

## ⏱️ HT/FT (İlk Yarı/Maç Sonucu) Tahmini

### Hesaplama
1. İlk yarı gol paternleri
2. Takımların ilk yarı performansı
3. Maç sonucu tahmini

**Örnekler:**
- X/1: İlk yarı beraberlik, maç sonunda ev sahibi kazanır
- 1/1: İlk yarı ev sahibi önde, maç sonunda ev sahibi kazanır
- X/X: İlk yarı beraberlik, maç sonunda beraberlik

## 📝 Kayıt Sistemi

### Ne Kaydediliyor?
1. **Tüm Oranlar:** Ev, Beraberlik, Deplasman, Over/Under, BTTS
2. **Implied Probabilities:** Her oran için hesaplanan olasılık
3. **Form Probabilities:** Form verilerinden hesaplanan gerçek olasılık
4. **Value Calculations:** Her market için value hesaplaması
5. **Best Value:** En yüksek value olan market ve miktarı
6. **Predictions:** Tüm tahminler (Maç Sonucu, Over/Under, BTTS, vb.)
7. **Odds Movement:** Oran hareketleri
8. **Sharp Money:** Sharp money analizi
9. **Actual Results:** Maç sonuçları (settlement sonrası)

### Nasıl Kullanılır?
1. **Pattern Recognition:** Benzer durumları bul
2. **Value Bet Learning:** Hangi durumlarda value çıkıyor?
3. **Success Rate:** Hangi value bet'ler başarılı?
4. **Odds Movement Analysis:** Oran hareketleri ne söylüyor?
5. **Sharp Money Patterns:** Sharp money hangi durumlarda geliyor?

## 🎓 Öğrenme Stratejisi

### 1. Yüksek Value Kayıtlarını İncele
- Value Rating: High olan kayıtları filtrele
- Hangi durumlarda yüksek value çıkıyor?
- Hangi liglerde daha fazla value var?

### 2. Başarılı Tahminleri Analiz Et
- Prediction Correct: Yes olan kayıtları incele
- Hangi value bet'ler başarılı oldu?
- Başarılı tahminlerin ortak özellikleri neler?

### 3. Odds Movement Patterns
- Oran düşen maçlarda value bet başarı oranı nedir?
- Sharp money geldiğinde tahmin doğruluğu artıyor mu?

### 4. Lig Bazlı Analiz
- Hangi liglerde daha fazla value var?
- Hangi liglerde tahmin doğruluğu daha yüksek?

## 📊 Export ve Analiz

### CSV Export
Tüm kayıtları CSV formatında export edebilirsiniz:
- Excel'de analiz yapabilirsiniz
- Pivot table'lar oluşturabilirsiniz
- Grafikler çizebilirsiniz

### JSON Export
Tüm detaylı verileri JSON formatında export edebilirsiniz:
- Programatik analiz için
- Machine learning modelleri için
- Custom analizler için

## 🔍 Filtreleme Seçenekleri

1. **Lig:** Belirli bir ligi filtrele
2. **Value Rating:** High, Medium, Low, None
3. **Min Value Amount:** Minimum value miktarı (örn: +10%)
4. **Search:** Takım veya lig adına göre ara

## 💡 İpuçları

1. **Yüksek Value ≠ Kesin Kazanç:** Value bet sadece uzun vadede karlı olur
2. **Sharp Money Onayı Önemli:** Sharp money geldiğinde value daha güvenilir
3. **Odds Movement Takibi:** Oran hareketlerini takip et
4. **Lig Bilgisi:** Her lig farklı karakteristiklere sahip
5. **Form > Oran:** Form analizi oranlardan daha önemli

## 🎯 Sonuç

Odds stratejisi, oranları form verileriyle karşılaştırarak **VALUE BET** tespit etmektir. Bu sistem:
- Tüm analizleri kaydeder
- Başarı oranlarını takip eder
- Pattern recognition yapmanıza yardımcı olur
- Benzer durumlarda benzer tahminler yapmanızı sağlar

**Önemli:** Value bet uzun vadede karlı olur. Tek bir maçta kaybetmek normaldir, önemli olan uzun vadede karlı olmaktır.

