# Kuponum (slip-1.0) — kullanıcı kuponu

**Ne:** Üye, maç sayfasındaki pazar satırlarından ("1/X/2", "Üst/Alt 2,5", "KG Var/Yok") seçim ekleyip
kendi kuponunu derler. Çubuk (sağ alt / mobilde sekme çubuğunun üstü) sayı ve toplam oranı gösterir,
tıklayınca çekmece açılır. `/coupon` sayfasının başında da aynı liste tam alanıyla durur.
**Günün kuponundan (duo-1.0) ayrıdır:** burada seçim kullanıcınındır, sunucu hiçbir şey önermez.

## Kurallar (`src/lib/site/slip-rule.ts`, saf, testli)
- Aynı maçtan tek bacak; aynı maçın başka seçimi eskisini **değiştirir**, aynı seçim ikinci tıkta **çıkar**.
- En çok `MAX_LEGS = 10` maç; başlamış maç eklenmez (`toggleLeg` → `started`).
- Bacak, eklendiği andaki model olasılığı `p` ve tablodaki bahisçi oranı `odds` (yoksa `null`) ile donar.
- `slipTotals`: toplam oran yalnız **her** bacağın oranı varsa çarpım; model olasılığı bağımsızlık varsayımıyla çarpım.
- `legHit` / `slipStatus`: bir bacak kaybettiyse `lost`, hepsi tuttuysa `won`, aksi `pending`.
- Liste başlama saatine göre sıralı (sıra = `kickoff`, sonra `fixtureId`).

## Saklama ve veri
- Kupon yalnız istemcide: `localStorage['fa.slip.v1']` (`parseStoredSlip` bozuk/eski kaydı süzer). Sunucuda tablo yok, migration yok.
- Skorlar: `GET /api/site/slip?ids=…` (≤ 20 id, üye kapılı, `private, no-store`) → `engine_predictions` resmi sürüm;
  yalnız başlamış bacak varsa istenir, 60 sn'de bir tazelenir.
- Düğmeler yalnız üye görünümünde ve başlamamış maçta basılır (`slipOn = !publicSample && !isPast`);
  örnek maçta ve ziyaretçi sayfalarında yok. Çubuk oturum açıkken ve bacak varken görünür; `/coupon`'da gizli.

## Bileşenler
`SlipProvider` (bağlam, layout'ta), `AddToSlipButton` (maç sayfası: 1X2 tablosu, "Diğer pazarlar" KG/Üst-Alt satırları, öne çıkan seçim),
`SlipBar` (yüzen çubuk + çekmece), `SlipPanel` (liste; çekmece ve `/coupon`). Metinler `slip` ad alanı (4 dil).

## Dil
Public site dili korunur: "istatistiksel modelin olasılıkları; bahis tavsiyesi değildir" notu her listede.
