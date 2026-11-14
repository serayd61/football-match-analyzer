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

## 1. GitHub

```bash
cd open-data-kit/dist/repo && git init -b main && git add -A && git commit -m "Initial dataset snapshot"
gh repo create serayd61/football-predictions-open-data --public --source . --push --description "Pre-match 1X2 probabilities of a football prediction model with final scores. CSV, CC BY 4.0, refreshed daily." --homepage https://footballanalytics.pro/en/data
gh repo edit serayd61/football-predictions-open-data --add-topic football --add-topic soccer --add-topic football-data --add-topic soccer-data --add-topic open-data --add-topic dataset --add-topic sports-analytics --add-topic football-analytics --add-topic predictions
```

Sonrasında `Refresh data` iş akışı her gün 05:17 UTC'de çalışır; yeni sonuçlanan maç varsa commit atar. İlk çalıştırma: Actions sekmesinden "Run workflow".

## 2. Zenodo (DOI)

1. zenodo.org → GitHub ile giriş → GitHub sekmesinde depoyu aç.
2. GitHub'da bir sürüm (release) yayınla, ör. `v2026.11`.
3. Zenodo sürümü arşivler ve DOI verir. DOI'yi README'ye ve `CITATION.cff` içine `doi:` satırı olarak ekle.

Akademik atıf ve DataCite / Google Scholar dizini buradan gelir.

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

Kopyalar yayınlandıktan sonra `/data` sayfasına "Mirrors" satırı eklenir (GitHub, Kaggle, Hugging Face, DOI). Bu ayrı bir küçük PR'dır.

## Sıra

GitHub → Zenodo → Kaggle → Hugging Face → liste PR'ları (`marketing/link-outreach-2026-11.md`). Liste PR'ları GitHub deposuna bağlanacağı için depo önce açılmalı.
