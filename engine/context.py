"""
PUAN DURUMU BAĞLAMI (dc-1.3-ctx gölgesi, 2026-10-18).

Kullanıcı gözlemi: 2. sıradaki takımın maça bakışı 10. sıradakinden farklı. Ölçüm
(2.991 sonuçlanmış maç, 44 lig, Mart→Ekim; puan durumu her maç öncesi arşivden
kuruldu): sinyal SIRA FARKINDA değil, HATTA MESAFEDE —
  - ev sahibi ilk 3'te / zirveye ≤3 puan → ev galibiyeti model +8…+9 pp
    (aynı p_home bandında +15 pp, z≈2.3)
  - iki takım da düşme hattına ≤3 puan → deplasman galibiyeti model +10 pp (z 2.6)
  - form farkı (son 5 puan): fit'te iyileşir, zaman-ayrımlı sınamada KÖTÜLEŞİR
    (0.947→0.954) → kapalı (c=0). H2H gibi (bkz. backtest_context.py).
Zaman-ayrımlı ızgara (ilk %70 fit / son %30 sınama): a=0.10, b=0.10 → sınama LL
0.9469→0.9440. Etki küçük; gölge olarak koşar, karne ±5 ise aktifleşir.

SIFIR yeni veri: tablo store'daki maçlardan (date, home, away, fthg, ftag) kurulur.
SIZINTISIZ: yalnız ref_date'ten ÖNCE oynanan maçlar; sezon = 60+ gün boşluktan
sonraki son blok. En az `min_played` hafta oynanmamışsa bağlam yok (çarpan 1).

params.ctx = {"title_home": 0.10, "releg_both": 0.10, "min_played": 6,
              "top_pos": 3, "gap_pts": 3}
"""
from collections import defaultdict
from datetime import timedelta

SEASON_GAP_DAYS = 60
DEFAULTS = {"title_home": 0.10, "releg_both": 0.10, "min_played": 6, "top_pos": 3, "gap_pts": 3}


def season_table(matches, ref_date, gap_days=SEASON_GAP_DAYS):
    """
    matches: load_for_fit formatı (date, home, away, fthg, ftag), herhangi sırada.
    → {"teams": {id: {"pts","pl","gd"}}, "pos": {id: sıra}, "n": takım sayısı,
       "top_pts": lider puanı, "rel_pts": düşme hattı (n-3. sıra) puanı, "played": min oynanan}
    Boş sezon → None.
    """
    prior = sorted((m for m in matches if m.get("date") and m["date"] < ref_date
                    and m.get("fthg") is not None and m.get("ftag") is not None), key=lambda m: m["date"])
    if not prior:
        return None
    # sezon bloğu: sondan geriye, gap_days'ten büyük ilk boşlukta kes
    start = 0
    for i in range(len(prior) - 1, 0, -1):
        if prior[i]["date"] - prior[i - 1]["date"] > timedelta(days=gap_days):
            start = i
            break
    block = prior[start:]
    if ref_date - block[-1]["date"] > timedelta(days=gap_days):
        return None  # sezon arası: tablo bayat
    tbl = defaultdict(lambda: {"pts": 0, "pl": 0, "gd": 0})
    for m in block:
        h, a = m["home"], m["away"]
        hg, ag = int(m["fthg"]), int(m["ftag"])
        tbl[h]["pl"] += 1; tbl[a]["pl"] += 1
        tbl[h]["gd"] += hg - ag; tbl[a]["gd"] += ag - hg
        if hg > ag: tbl[h]["pts"] += 3
        elif hg < ag: tbl[a]["pts"] += 3
        else: tbl[h]["pts"] += 1; tbl[a]["pts"] += 1
    ranked = sorted(tbl.items(), key=lambda kv: (-kv[1]["pts"], -kv[1]["gd"]))
    n = len(ranked)
    pos = {tid: i + 1 for i, (tid, _) in enumerate(ranked)}
    rel_idx = max(0, n - 3)
    return {
        "teams": dict(tbl), "pos": pos, "n": n,
        "top_pts": ranked[0][1]["pts"],
        "rel_pts": ranked[rel_idx][1]["pts"] if ranked else 0,
        "played": min(v["pl"] for v in tbl.values()) if tbl else 0,
    }


def context_factors(table, home, away, ctx):
    """
    → (f_home, f_away, tags): λ_ev ve λ_dep çarpanları + açıklama etiketleri.
    ctx yoksa/boşsa veya tablo yetersizse (1.0, 1.0, []).
    """
    if not isinstance(ctx, dict) or table is None:
        return 1.0, 1.0, []
    p = {**DEFAULTS, **{k: v for k, v in ctx.items() if v is not None}}
    try:
        a = float(p["title_home"]); b = float(p["releg_both"])
        min_played = int(p["min_played"]); top_pos = int(p["top_pos"]); gap = float(p["gap_pts"])
    except (TypeError, ValueError):
        return 1.0, 1.0, []
    if table["played"] < min_played or table["n"] < 6:
        return 1.0, 1.0, []
    th, ta = table["teams"].get(home), table["teams"].get(away)
    if th is None or ta is None:
        return 1.0, 1.0, []
    fh = fa = 1.0
    tags = []
    if a and (table["pos"].get(home, 99) <= top_pos or table["top_pts"] - th["pts"] <= gap):
        fh *= 1.0 + a
        tags.append("title_home")
    if b and (th["pts"] - table["rel_pts"] <= gap) and (ta["pts"] - table["rel_pts"] <= gap):
        fa *= 1.0 + b
        tags.append("releg_both")
    return fh, fa, tags
