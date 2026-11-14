# Kadro piyasa değeri (Transfermarkt) backtest — 2026-11-15

Betik: `engine/backtest_value.py`. Kapı: `.claude/skills/fa-prediction-lab/scripts/gate.py`.
Veri: dcaribou/transfermarkt-datasets (CC0; player_valuations, appearances, games — son forma
kaydı 2026-06-28) + football-data.co.uk. Test 2021-22+, n=9.408. Veri depoya ve siteye girmedi.

## Soru

Takımların maç öncesi kadro piyasa değeri, gol-DC'nin, DC+Elo harmanının (`dc-1.4-elo`) ve
dinamik modelin (`backtest-dynamic-strength.md`) üstüne bilgi katar mı?

## Neden denendi

Dış araştırma: bir kulüp çalışmasında Elo + Transfermarkt havuzu Elo'ya göre log-loss'ta ~−0,009;
FiveThirtyEight SPI de ön bilgi olarak kadro değeri kullanıyordu. Elo ve dinamik model aynı
bilgiyi (sonuçlardan takım gücü) taşıdığı için farklı türden bir girdi arandı.

## Yöntem

- Kadro = kulüp adına maçtan önceki 120 günde forma giymiş oyuncular; değer = oyuncunun maç
  gününden önceki son Transfermarkt değeri; V = en değerli 18 oyuncunun toplamı.
  x = ln V_ev − ln V_dep. (Pencere 120/365 ve toplama biçimi doğrulamada seçildi.)
- x → 1X2: gol farkı ~ a·x + b (2015-16 → 2018-19, n=7.270; a=0,674 gol / ln-oran), sonra
  canlıdakiyle aynı Poisson + DC(ρ).
- Harman p = (1−w)·p_ref + w·p_değer; w doğrulama sezonlarında (2019-20, 2020-21) seçildi,
  testte tarama yok. Kadro kurulamayan maçta aday = referans.
- Takım eşleme: aynı gün + aynı skor çoğunluğu; 176/180 takım eşleşti.

## Sonuç

| Referans | w | ΔLL [%95 CI] | Lig yönü | Kapı |
|---|--:|--:|:-:|:-:|
| gol-DC | 0,4 | **−0,0120 [−0,0151, −0,0090]** | 5/5 | GEÇTİ |
| DC+Elo | 0,2 | −0,0019 [−0,0028, −0,0010] | 5/5 | GEÇTİ (küçük) |
| Dinamik model | 0,1 | −0,0008 [−0,0011, −0,0004] | 5/5 | GEÇTİ (çok küçük) |

Mutlak log-loss: gol-DC 1,0007 → 0,9888 · DC+Elo 0,9856 → 0,9837 · dinamik 0,9843 → 0,9836 ·
piyasa 0,9676. Değer modeli tek başına gol-DC'den kötü (doğrulamada 1,0115'e karşı 1,0057).

Kazancın yeri (DC+Elo üstüne): Ağustos–Eylül −0,0025, Ekim–Aralık −0,0023, Ocak sonrası −0,0014.

## Dürüst yorum

- Kadro değeri gol-DC'ye Elo kadar olmasa da büyük katkı yapıyor (−0,012), ama Elo ya da dinamik
  model varken katkısı −0,001…−0,002: yön her ligde aynı ve aralık 0'ı dışlıyor, fakat haftalık
  terfi eşiğinin (−0,003) altında. Üç girdi de büyük ölçüde aynı şeyi ölçüyor: takımın gerçek gücü.
- Ölçüm kadro değerinin en çok işe yarayacağı yerde kör: kadro "forma giymiş oyuncular"dan
  kurulduğu için yeni transferler ilk maçlarına kadar görünmüyor, yeni çıkan takımların geçmişi yok
  (542 test maçında özellik kurulamadı; 4 takım hiç eşleşmedi). Sezon öncesi resmi kadro listesiyle
  kazanç daha büyük olabilir — bu veriyle ölçülemedi.
- 2026-27 sezonu veride yok (son kayıt 28 Haziran 2026; veri seti artık güncellenmiyor).
- Canlıda kullanmak için güncel bir değer kaynağı gerekir; Transfermarkt'ın resmi API'si yok,
  kazıma kullanım koşullarına takılır.

## Karar: GEÇTİ (ölçüm) — ALINMIYOR

Beklenen kazanç (−0,002) terfi eşiğinin altında ve sürdürülebilir bir canlı veri kaynağı yok.
Yeniden bakılacak koşul: sezon öncesi kadro listesi veren lisanslı / açık bir kaynak bulunursa
yalnız Ağustos–Eylül ve yeni çıkan takımlar için ön bilgi olarak.

## Çalıştırma

```bash
# veri: https://github.com/dcaribou/transfermarkt-datasets (player_valuations, appearances, games .csv.gz)
python3 engine/backtest_value.py --tm-dir /path/tm-data --out /tmp/gate-value --dc-cache /tmp/dc-cache.json
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-value/elo.jsonl /tmp/gate-value/elo_val.jsonl
```
