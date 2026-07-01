"""
Maç-anına özgü bağlam özellikleri (SIFIR yeni veri, SIFIR isim-eşleme):
elimizdeki maç listesinden (gol+tarih+sonuç) türetilir.

  - rolling form: her takımın son-N maçındaki puan-oranı + gol-farkı ortalaması
  - H2H: iki takımın son-K karşılaşmasında ev-takımı perspektifinden gol-farkı

SIZINTISIZ: her maç için yalnız o maçtan ÖNCE oynanmış maçlar kullanılır
(annotate sırası kronolojik; güncelleme maç işlendikten SONRA yapılır).

annotate_context(matches, ...) her kaydı yerinde `m["ctx"]` ile zenginleştirir:
  ctx = {
    "home_form_pts", "away_form_pts",   # [0..3] son-N puan/maç (None=yetersiz geçmiş)
    "home_form_gd",  "away_form_gd",     # ortalama gol farkı
    "home_n", "away_n",                  # kaç maça bakıldı
    "h2h_gd", "h2h_n",                   # ev-takımı bakışıyla H2H gol-farkı ort. (None=yok)
  }
Model/backtest bunları predict-zamanı tilt'e çevirir (bkz. backtest_context.py).
"""
from collections import defaultdict


def _rate(lst, n):
    """Son-n kaydın (puan, gol_farkı) ortalaması + sayısı. Boşsa (None,None,0)."""
    tail = lst[-n:]
    if not tail:
        return None, None, 0
    pts = sum(x[0] for x in tail) / len(tail)
    gd = sum(x[1] for x in tail) / len(tail)
    return pts, gd, len(tail)


def annotate_context(matches, form_n=5, h2h_k=6):
    """
    matches: tarihe göre ARTAN sıralı maç listesi (data/features formatı:
             date, home, away, fthg, ftag). Her kayda m["ctx"] eklenir.
    """
    ms = sorted(matches, key=lambda m: m["date"])
    hist = defaultdict(list)       # takım -> kronolojik [(puan, gol_farkı), ...]
    pair_hist = defaultdict(list)  # (t1,t2) sıralı -> [(ev_takımı, home_gd), ...]

    for m in ms:
        h, a = m["home"], m["away"]

        # --- ÖNCE oku (sızıntısız) ---
        hp, hg, hn = _rate(hist[h], form_n)
        ap, ag, an = _rate(hist[a], form_n)

        key = tuple(sorted((h, a)))
        prev = pair_hist[key][-h2h_k:]
        if prev:
            # her karşılaşmanın gol-farkını ŞU ANKİ ev-takımı bakışına çevir
            vals = [(gd if home == h else -gd) for (home, gd) in prev]
            h2h_gd = sum(vals) / len(vals)
            h2h_n = len(vals)
        else:
            h2h_gd, h2h_n = None, 0

        m["ctx"] = {
            "home_form_pts": hp, "away_form_pts": ap,
            "home_form_gd": hg, "away_form_gd": ag,
            "home_n": hn, "away_n": an,
            "h2h_gd": h2h_gd, "h2h_n": h2h_n,
        }

        # --- SONRA güncelle ---
        gd = m["fthg"] - m["ftag"]
        ph = 3 if gd > 0 else (1 if gd == 0 else 0)
        pa = 3 if gd < 0 else (1 if gd == 0 else 0)
        hist[h].append((ph, gd))
        hist[a].append((pa, -gd))
        pair_hist[key].append((h, gd))

    return ms


if __name__ == "__main__":
    # Basit sağlama: bağlam alanları dolu mu, sızıntı yok mu.
    from data import load_matches
    ms = load_matches("E0", 2022, 2023)
    annotate_context(ms)
    withform = [m for m in ms if m["ctx"]["home_n"] >= 5 and m["ctx"]["away_n"] >= 5]
    withh2h = [m for m in ms if m["ctx"]["h2h_n"] > 0]
    print(f"Toplam {len(ms)} maç | form>=5: {len(withform)} | H2H'li: {len(withh2h)}")
    s = withh2h[len(withh2h) // 2]
    c = s["ctx"]
    print(f"ÖRNEK {s['date'].date()} {s['home']} v {s['away']}: "
          f"form_pts {c['home_form_pts']:.2f}/{c['away_form_pts']:.2f} "
          f"gd {c['home_form_gd']:+.2f}/{c['away_form_gd']:+.2f} "
          f"H2H_gd {c['h2h_gd']:+.2f} (n={c['h2h_n']})")
