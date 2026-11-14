# Açık veri setini yayınlama

Bu klasör, `footballanalytics.pro/data` altındaki veri setinin dış platformlardaki kopyalarını üretir. Amaç: sitenin kendi verisine dışarıdan bağlantı ve keşif kanalı kazandırmak. Kaynak her zaman sitedeki dosyadır; buradakiler onun günlük kopyasıdır.

## Derleme

```bash
./open-data-kit/build.sh serayd61/football-predictions-open-data
```

Çıktı `open-data-kit/dist/` altına yazılır (git'e girmez):

| Klasör | Ne için |
|---|---|
| `dist/repo/` | GitHub deposunun tamamı: README (istatistik bloğu dolu), veri, günlük yenileme iş akışı |
| `dist/kaggle/` | Kaggle yükleme klasörü (`all.csv` + `dataset-metadata.json`) |
| `dist/huggingface/` | Hugging Face yükleme klasörü (`README.md` veri kartı + `data/all.csv`) |

Betik hiçbir şey yayınlamaz.

## Durum (14 Kasım 2026)

| Kopya | Adres | Durum |
|---|---|---|
| GitHub | <https://github.com/serayd61/football-predictions-open-data> | Yayında. 17 Ekim'de `footballanalytics-open-data` adıyla açılan depo yeniden adlandırıldı; eski adres yönleniyor, günlük commit geçmişi korunuyor |
| Zenodo | <https://doi.org/10.5281/zenodo.24216824> | Yayında. Bu DOI her zaman son sürüme gider; `v2026.11` sürümünün kendi DOI'si `10.5281/zenodo.24216825` |
| Kaggle | — | Hesap bekliyor |
| Hugging Face | — | Hesap bekliyor |

## 1. GitHub

Depo yayında ve kendi `Refresh data` iş akışıyla her gün 05:17 UTC'de güncelleniyor. README, betik veya iş akışında değişiklik gerekirse **doğrudan o depoda** yapılır; ardından aynı değişiklik buradaki şablona işlenir (`README.md` içinde depo adı `OWNER/REPO`, istatistik bloğu boş tutulur). `dist/repo/` artık yalnızca Kaggle ve Hugging Face klasörlerini üretmek için derlenir, GitHub'a itilmez.

## 2. Zenodo (DOI)

Depo Zenodo'da etkin (release kancası kurulu). Yeni arşiv sürümü için GitHub'da sürüm yayınlamak yeter:

```bash
gh release create v2027.01 -R serayd61/football-predictions-open-data --title "v2027.01" --notes "..."
```

Zenodo birkaç saniye içinde yeni sürüm DOI'si üretir; README'deki DOI (konsept DOI) değişmez. Kayıt üst verisi depodaki `.zenodo.json` dosyasından okunur. Öneri: sezon ortası ve sezon sonu olmak üzere yılda iki sürüm.

## 3. Kaggle

Hesap gerekir. `dist/kaggle/dataset-metadata.json` içindeki `KAGGLE_USER` yerine kullanıcı adını yaz, sonra:

```bash
pip install kaggle   # ~/.kaggle/kaggle.json: Kaggle → Settings → Create New Token
kaggle datasets create -p open-data-kit/dist/kaggle
```

Güncelleme: `kaggle datasets version -p open-data-kit/dist/kaggle -m "refresh"`. Web arayüzünden sürükle-bırak da olur; açıklama metni JSON'daki `description` alanıdır.

## 4. Hugging Face

Hesap gerekir. `dist/huggingface/README.md` içindeki `HF_OWNER/HF_REPO` yerine veri seti adını yaz, sonra:

```bash
pip install -U huggingface_hub && hf auth login
hf upload HF_OWNER/football-match-predictions open-data-kit/dist/huggingface . --repo-type dataset
```

## 5. Siteye geri bağlantı

`/data` sayfası Zenodo DOI'sine ve GitHub deposuna bağlanıyor; yapısal veride (`Dataset`) `identifier` ve `sameAs` olarak da geçiyor. Adresler `src/lib/site/open-data.ts` içinde. Kaggle ve Hugging Face açılınca aynı satıra eklenir.
