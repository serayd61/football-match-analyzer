# Haftalık sosyal video (Instagram Reel + Telegram)

9:16, ~28 sn. Kaynaklar: `/api/v2/proof` (kanıt kartı), günün seçimleri, ElevenLabs seslendirme (Oliver Silk, eleven_v4).

```bash
cd scripts/social-video
curl -s -o proof-en.png "https://footballanalytics.pro/api/social/image?kind=proof&day=$(date -u +%F)&lang=en"
python3 cards.py "1 November 2026"                 # title.png + end.png
python3 today_card.py picks.json "1 November" "Measured double-chance record: 77.7% on 23,060 matches"  # today-en.png (oransız)
./build.sh voice.mp3 weekly-$(date -u +%F).mp4     # voice.mp3 = ElevenLabs çıktısı
```

Gereksinim: ffmpeg, Pillow. `picks.json` biçimi: `[{"league":"Eredivisie","time":"14:30","match":"A – B","pick":"Over 2.5","prob":"79%"}]`.
Politika: görsel ve metinde oran yok, bahis dili yok. Caption şablonu ve etiketler için `docs/INSTAGRAM_SETUP.md`.
