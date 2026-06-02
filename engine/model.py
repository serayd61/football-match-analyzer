"""
Dixon-Coles-lite gol modeli (saf Python, bağımlılık yok).
- Zaman-ağırlıklı Poisson MLE (sabit-nokta iterasyonu) ile takım atak/defans gücü.
- Dixon-Coles düşük-skor düzeltmesi (rho).
- Skor matrisinden 1X2 / Üst-Alt 2.5 / KG olasılıkları.
"""
import math

MAX_GOALS = 10
RHO = -0.10  # Dixon-Coles düşük skor düzeltmesi


def _pois(k, lam):
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * (lam ** k) / math.factorial(k)


def fit(matches, ref_date, half_life_days=180, window_days=540, iters=25, min_matches=120):
    """ref_date'ten ÖNCEKİ maçlarla zaman-ağırlıklı Poisson MLE."""
    train = [m for m in matches if m["date"] < ref_date]
    if window_days:
        cutoff = ref_date.toordinal() - window_days
        train = [m for m in train if m["date"].toordinal() >= cutoff]
    if len(train) < min_matches:
        return None

    teams = sorted({m["home"] for m in train} | {m["away"] for m in train})
    A = {t: 1.0 for t in teams}   # atak
    D = {t: 1.0 for t in teams}   # defans
    H = 1.35                      # ev avantajı (gol çarpanı)
    base = 1.3                    # lig taban gol

    ln2 = math.log(2.0)
    w = []
    for m in train:
        age = ref_date.toordinal() - m["date"].toordinal()
        w.append(math.exp(-ln2 * age / half_life_days))

    for _ in range(iters):
        # base
        num = den = 0.0
        for k, m in enumerate(train):
            num += w[k] * (m["fthg"] + m["ftag"])
            den += w[k] * (A[m["home"]] * D[m["away"]] * H + A[m["away"]] * D[m["home"]])
        if den > 0:
            base = num / den

        # atak
        a_num = {t: 0.0 for t in teams}
        a_den = {t: 0.0 for t in teams}
        d_num = {t: 0.0 for t in teams}
        d_den = {t: 0.0 for t in teams}
        h_num = h_den = 0.0
        for k, m in enumerate(train):
            wk, h, a = w[k], m["home"], m["away"]
            # atak payları
            a_num[h] += wk * m["fthg"]
            a_num[a] += wk * m["ftag"]
            a_den[h] += wk * base * D[a] * H
            a_den[a] += wk * base * D[h]
            # defans payları (yenen goller)
            d_num[a] += wk * m["fthg"]   # away team i=a, conceded fthg
            d_num[h] += wk * m["ftag"]
            d_den[a] += wk * base * A[h] * H
            d_den[h] += wk * base * A[a]
            # ev avantajı
            h_num += wk * m["fthg"]
            h_den += wk * base * A[h] * D[a]

        for t in teams:
            if a_den[t] > 0:
                A[t] = a_num[t] / a_den[t]
            if d_den[t] > 0:
                D[t] = d_num[t] / d_den[t]
        if h_den > 0:
            H = h_num / h_den

        # kimliklenebilirlik: atak & defans ortalamasını 1'e sabitle
        ma = sum(A.values()) / len(teams)
        md = sum(D.values()) / len(teams)
        if ma > 0 and md > 0:
            for t in teams:
                A[t] /= ma
                D[t] /= md
            base *= ma * md

    return {"A": A, "D": D, "H": H, "base": base, "teams": set(teams)}


def predict(model, home, away):
    """1X2 / Üst-Alt 2.5 / KG olasılıkları + beklenen goller."""
    if model is None:
        return None
    A, D, H, base = model["A"], model["D"], model["H"], model["base"]
    ah = A.get(home, 1.0); dh = D.get(home, 1.0)
    aa = A.get(away, 1.0); da = D.get(away, 1.0)
    lam_h = base * ah * da * H
    lam_a = base * aa * dh
    lam_h = min(max(lam_h, 0.05), 6.0)
    lam_a = min(max(lam_a, 0.05), 6.0)

    ph = [_pois(i, lam_h) for i in range(MAX_GOALS + 1)]
    pa = [_pois(j, lam_a) for j in range(MAX_GOALS + 1)]

    p_home = p_draw = p_away = 0.0
    p_over = p_btts = 0.0
    total = 0.0
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            p = ph[i] * pa[j]
            # Dixon-Coles düzeltmesi
            if i == 0 and j == 0:
                p *= 1.0 - lam_h * lam_a * RHO
            elif i == 1 and j == 0:
                p *= 1.0 + lam_a * RHO
            elif i == 0 and j == 1:
                p *= 1.0 + lam_h * RHO
            elif i == 1 and j == 1:
                p *= 1.0 - RHO
            if p < 0:
                p = 0.0
            total += p
            if i > j: p_home += p
            elif i == j: p_draw += p
            else: p_away += p
            if i + j >= 3: p_over += p
            if i >= 1 and j >= 1: p_btts += p

    if total > 0:
        p_home /= total; p_draw /= total; p_away /= total
        p_over /= total; p_btts /= total

    return {
        "p_home": p_home, "p_draw": p_draw, "p_away": p_away,
        "p_over25": p_over, "p_under25": 1 - p_over,
        "p_btts_yes": p_btts, "p_btts_no": 1 - p_btts,
        "lambda_home": lam_h, "lambda_away": lam_a,
    }
