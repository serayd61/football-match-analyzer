# Kuponum (slip-1.2) — kullanıcı kuponu

**Ne:** Üye, maç sayfasında hero'nun hemen altındaki **"Kupona ekle" ızgarasından** (1X2, Üst/Alt 2,5, KG,
Asya handikapı, beraberlikte iade; her seçim model % · bahisçi oranı) ya da değerlendirme kartındaki pazar
satırından seçim ekleyip kendi kuponunu derler. "Pazarlar ve oranlar" sekmesindeki tablolarda da düğme var. Çubuk (sağ alt / mobilde sekme çubuğunun üstü) sayı ve toplam oranı gösterir,
tıklayınca çekmece açılır. `/coupon` sayfasının başında da aynı liste tam alanıyla durur.
**Günün kuponundan (duo-1.0) ayrıdır:** burada seçim kullanıcınındır, sunucu hiçbir şey önermez.

## Kurallar (`src/lib/site/slip-rule.ts`, saf, testli)
- **slip-1.2:** aynı maçtan birden çok pazar seçilebilir (1 + Üst 2,5 + KG). Aynı maçın aynı pazarında (`slotKey`)
  yenisi eskisini **değiştirir**; aynı seçim ikinci tıkta **çıkar**. Olasılık çarpımı aynı maçın bacakları için
  bağımsızlık varsaymaz diye uyarılır.
- En çok `MAX_LEGS = 15` bacak; başlamış maç eklenmez (`toggleLeg` → `started`).
- Bacak, eklendiği andaki model olasılığı `p` ve tablodaki bahisçi oranı `odds` (yoksa `null`) ile donar.
- `slipTotals`: toplam oran yalnız **her** bacağın oranı varsa çarpım; model olasılığı bağımsızlık varsayımıyla çarpım.
- `legHit` / `slipStatus`: bir bacak kaybettiyse `lost`, hepsi tuttuysa `won`, aksi `pending`.
- Liste başlama saatine göre sıralı (sıra = `kickoff`, sonra `fixtureId`).
- **slip-1.1:** `ah` (Asya handikapı, `line` ev perspektifinden, 0,25 katı; çeyrek çizgi iki yarım bahis gibi
  sonuçlanır: tuttu / yarı tuttu / iade / yarı tutmadı / tutmadı) ve `dnb` (beraberlikte iade). Handikap çizgisi
  bahisçiden gelir; yoksa modelin adil çizgisi (oran yok). Aynı maçta farklı çizgi = farklı seçim (değiştirir).
  `legOutcome` beş durumlu; `legHit` geriye dönük (tuttu/yarı tuttu/iade → true).

## Saklama ve veri
- Kupon yalnız istemcide: `localStorage['fa.slip.v1']` (`parseStoredSlip` bozuk/eski kaydı süzer). Sunucuda tablo yok, migration yok.
- Skorlar: `GET /api/site/slip?ids=…` (≤ 20 id, üye kapılı, `private, no-store`) → `engine_predictions` resmi sürüm;
  yalnız başlamış bacak varsa istenir, 60 sn'de bir tazelenir.
- Düğmeler yalnız üye görünümünde ve başlamamış maçta basılır (`slipOn = !publicSample && !isPast`);
  örnek maçta ve ziyaretçi sayfalarında yok. Çubuk oturum açıkken ve bacak varken görünür; `/coupon`'da gizli.

## Bileşenler
`SlipProvider` (bağlam, layout'ta), `AddToSlipButton` (maç sayfası: 1X2 tablosu, "Diğer pazarlar" KG/Üst-Alt satırları, öne çıkan seçim),
`SlipMarkets` + `SlipOptionButton` (pazar ızgarası), `SlipBar` (yüzen çubuk + çekmece), `SlipPanel` (liste; çekmece ve `/coupon`). Metinler `slip` ad alanı (4 dil).

## Dil
Public site dili korunur: "istatistiksel modelin olasılıkları; bahis tavsiyesi değildir" notu her listede.
