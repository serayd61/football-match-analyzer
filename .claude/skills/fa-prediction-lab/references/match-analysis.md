# Tek maç analizi — çıpa + isimli sapma + retrospektif

Kullanım yeri: dashboard "Match Intelligence" / legacy `match_intelligence`; public site'a
LLM metni GİRMEZ. Amaç: modelin göremediği, isimlendirilebilir bilgiyi sınırlı ve ölçülebilir
biçimde eklemek; sonra gerçek sonuçla puanlamak.

## 1. Çıpa
`engine_predictions` resmi satırı (pHome/pDraw/pAway ham + kalibre güven, λ'lar, Ü/A, KG).
Yoksa (kapsam dışı lig) `market-model.ts` zemini (yalnız 1X2 + çifte şans güvenilir).
Çıpayı olduğu gibi `baseline` alanına yaz.

## 2. İstihbarat toplama (isimli, tarihli, kaynaklı)
Sıra ve araç:
1. `football-data` skill: `search_team` ×2 → `get_team_schedule` (son 5–10 sonuç),
   `get_head_to_head` (11 Avrupa ligi), `get_team_strength` (ClubElo farkı),
   `get_match_forecast` (≤1 hafta), top-5'te son maçların `get_event_xg`; PL'de
   `get_missing_players`.
2. Web araması (kısa tohum sorgu: "<Ev> vs <Dep> <lig> preview lineup injuries"), 72 saat
   içi haber öncelikli; ikinci-el/sosyal kaynak güveni düşür.
3. Proje verisi: `getTeamForm(before=kickoff)`, `getHeadToHead(before)`, `getMarketBook`
   (açılış/kapanış oranı, sağlayıcı).
Kayıt şeması (`football-match-forecasting/references/data-collection.md`'deki JSON):
recentForm, strength, style/scoringTendency, h2h, injuries[{player,status,source,asOf}],
lineupNews, expertViews, evidence[], confidence, asOf. Bulunamayan alan "unverified".

## 3. Sapma kuralları
- Yalnız isimli faktör: kilit oyuncu kesin yok / ceza / rotasyon (ölü maç) / bariz taktik
  uyumsuzluk / aşırı hava / uzun seyahat-3 günde 2 maç. "Form iyi" tek başına faktör
  DEĞİL (model içeriyor).
- Faktör başına ≤ ±0.08; iki kilit eksik gibi ezici durumda ≤ ±0.12. Toplam sonra normalize.
- Piyasa oranı sapma gerekçesi olamaz; yalnız §5 edge için.
- Sapma yoksa `probabilities == baseline` ve `deviations: []`.

Çıktı:
```json
{"fixtureId":0,"modelVersion":"dc-1.0",
 "baseline":{"home":0.0,"draw":0.0,"away":0.0},
 "deviations":[{"factor":"","shift":{"home":-0.05,"draw":0.03,"away":0.02},"reason":"","source":"","asOf":""}],
 "probabilities":{"home":0.0,"draw":0.0,"away":0.0},
 "goals":{"lambdaHome":0.0,"lambdaAway":0.0,"over25":0.0,"btts":0.0,"adjusted":false},
 "confidence":"low|medium|high","dataCompleteness":0.0,
 "keyFactors":[],"narrative":"3–5 cümle, olasılık dili (olabilir/işaret ediyor), garanti yok"}
```

## 4. Dil ve sunum
Türkçe/EN/DE/IT kullanıcı diline göre; "istatistiksel model" ifadesi; yüzdeler kalibre
güvenle; tek maçın kazanılmasının kanıt olmadığını bir cümleyle söyle.

## 5. Edge ve boyut (isteğe bağlı, dashboard)
`betting` skill: `devig` (kapanış ya da güncel oran) → `find_edge(fair=probabilities,
market=devig)` → `kelly_criterion` çeyrek Kelly. Eşik: edge ≥ %3 ve dataCompleteness ≥ 0.7.
CLV takibi: alınan oran vs `prediction_odds.closing` — pozitif CLV birikimi edge'in asıl
kanıtı; ROI'yi 500 bahis altında yorumlama.

## 6. Retrospektif (maç sonrası, `settled=true`)
Girdi: analiz JSON + skor + gol dakikaları (`get_event_timeline`). Çıktı:
```json
{"grade":"correct|partial|wrong","brierBaseline":0.0,"brierFinal":0.0,
 "critique":"neyi fazla/az tarttı, neyi kaçırdı — kendini mazur görme",
 "lessons":[{"category":"örn. rotation-underrated","lesson":"yeniden kullanılabilir kural"}]}
```
Toplu değerlendirme: ≥50 maçta `mean(brierFinal) − mean(brierBaseline)`; pozitifse sapma
sınırını daralt (±0.05) ya da faktör türünü yasakla. Tekrarlayan dersler analiz sistem
promptuna "geçmiş hatalar" olarak eklenir; baseline kaynaklı dersler (örn. beraberlik
eksik) modele (`experiment-protocol.md`) yönlendirilir, prompta değil.
