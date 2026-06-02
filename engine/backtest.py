"""
Walk-forward backtest: modelin gerçekten edge'i var mı?
Her maç için SADECE öncesindeki verilerle fit edip tahmin eder, sonra:
- 1X2 isabet, Brier, log-loss (vs bahisçi kapanış oranı benchmark)
- Kapanış oranına karşı value-betting ROI (de-vig + EV eşiği)
Saf Python, bağımlılık yok.
"""
import math
import sys
from data import load_matches
import model as M


def implied_probs(oh, od, oa):
    """De-vig (overround çıkarılmış) bahisçi olasılıkları."""
    if not (oh and od and oa):
        return None
    ih, idr, ia = 1 / oh, 1 / od, 1 / oa
    s = ih + idr + ia
    return {"H": ih / s, "D": idr / s, "A": ia / s}


def run(league="E0", start_year=2019, end_year=2024, test_from_season="2122",
        ev_threshold=0.05, half_life=180, window=540):
    matches = load_matches(league, start_year, end_year)
    print(f"[backtest] {league}: {len(matches)} maç yüklendi")

    # Tarihe göre fit cache (aynı gün tek fit)
    fit_cache = {}
    def get_model(ref_date):
        key = ref_date.toordinal()
        if key not in fit_cache:
            fit_cache[key] = M.fit(matches, ref_date, half_life_days=half_life, window_days=window)
        return fit_cache[key]

    n = 0
    correct = 0
    book_correct = 0
    brier_sum = 0.0
    logloss_sum = 0.0
    # value betting
    bets = 0
    bet_profit = 0.0
    bet_wins = 0
    started = False

    outcomes = {"H": 0, "D": 1, "A": 2}
    for m in matches:
        if m["season"] < test_from_season:
            continue
        mdl = get_model(m["date"])
        if mdl is None:
            continue
        pr = M.predict(mdl, m["home"], m["away"])
        if pr is None:
            continue

        model_p = {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]}
        actual = m["ftr"]
        if actual not in outcomes:
            continue
        started = True
        n += 1

        # 1X2 isabet
        pick = max(model_p, key=model_p.get)
        if pick == actual:
            correct += 1

        # Brier (3-sınıf) + logloss
        for o in ("H", "D", "A"):
            y = 1.0 if o == actual else 0.0
            brier_sum += (model_p[o] - y) ** 2
        logloss_sum += -math.log(max(model_p[actual], 1e-9))

        # Bahisçi benchmark + value bet
        imp = implied_probs(m["odds_home"], m["odds_draw"], m["odds_away"])
        if imp:
            book_pick = max(imp, key=imp.get)
            if book_pick == actual:
                book_correct += 1
            odds = {"H": m["odds_home"], "D": m["odds_draw"], "A": m["odds_away"]}
            for o in ("H", "D", "A"):
                ev = model_p[o] * odds[o] - 1.0  # beklenen değer (1 birim bahis)
                if ev > ev_threshold:
                    bets += 1
                    if o == actual:
                        bet_profit += odds[o] - 1.0
                        bet_wins += 1
                    else:
                        bet_profit -= 1.0

    if not started or n == 0:
        print("[backtest] test edilecek maç bulunamadı")
        return

    print("\n" + "=" * 56)
    print(f"  WALK-FORWARD BACKTEST — {league}  (test: {test_from_season}+)")
    print("=" * 56)
    print(f"  Test maçı            : {n}")
    print(f"  1X2 isabet (model)   : {correct/n*100:.1f}%")
    print(f"  1X2 isabet (bahisçi) : {book_correct/n*100:.1f}%  <- benchmark")
    print(f"  Brier skoru (model)  : {brier_sum/n:.4f}   (düşük=iyi)")
    print(f"  Log-loss (model)     : {logloss_sum/n:.4f}   (düşük=iyi)")
    print("-" * 56)
    print(f"  VALUE BETTING (EV>{ev_threshold:.0%}, kapanış oranına karşı)")
    print(f"  Bahis sayısı         : {bets}")
    if bets:
        roi = bet_profit / bets * 100
        print(f"  Kazanan bahis        : {bet_wins} ({bet_wins/bets*100:.1f}%)")
        print(f"  Net kar (birim)      : {bet_profit:+.1f}")
        print(f"  ROI                  : {roi:+.2f}%   <- ASIL METRİK")
    else:
        print("  (eşiği geçen value bahis yok)")
    print("=" * 56)


if __name__ == "__main__":
    league = sys.argv[1] if len(sys.argv) > 1 else "E0"
    run(league=league)
