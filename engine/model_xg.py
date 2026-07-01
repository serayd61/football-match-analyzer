"""
xG-Dixon-Coles: model.py'nin çarpımsal fit'i, ama atak/defans hedefi
  target = (1 - xg_weight) * gol + xg_weight * xG
harmanı. xg_weight=0 → saf gol (baseline'a EŞDEĞER), 1 → saf xG.

Neden çalışır: fit sabit-nokta oranları/ortalamaları kullanır (integer şart değil),
xG sürekli değer olabilir. predict() DEĞİŞMEZ → model.py'deki predict aynen kullanılır,
çıktı şeması {A,D,H,base} aynı → canlı TS serving kodu SIFIR değişir.
xG eksik maçta o maç için gole düşülür (graceful fallback).
"""
import math

import model as M  # predict + _pois aynen kullanılır (çıktı şeması aynı)


def _targets(m, w):
    """Bu maç için harmanlı (home, away) hedef golü. xG yoksa gole düş."""
    hx, ax = m.get("home_xg"), m.get("away_xg")
    if w <= 0 or hx is None or ax is None:
        return float(m["fthg"]), float(m["ftag"])
    th = (1.0 - w) * m["fthg"] + w * hx
    ta = (1.0 - w) * m["ftag"] + w * ax
    return th, ta


def fit(matches, ref_date, xg_weight=0.0, half_life_days=180, window_days=540,
        iters=25, min_matches=120):
    """ref_date'ten ÖNCEKİ maçlarla zaman-ağırlıklı harmanlı-hedef Poisson MLE."""
    train = [m for m in matches if m["date"] < ref_date]
    if window_days:
        cutoff = ref_date.toordinal() - window_days
        train = [m for m in train if m["date"].toordinal() >= cutoff]
    if len(train) < min_matches:
        return None

    teams = sorted({m["home"] for m in train} | {m["away"] for m in train})
    A = {t: 1.0 for t in teams}
    D = {t: 1.0 for t in teams}
    H = 1.35
    base = 1.3

    ln2 = math.log(2.0)
    w = []
    tgt = []  # (th, ta) önceden hesapla
    for m in train:
        age = ref_date.toordinal() - m["date"].toordinal()
        w.append(math.exp(-ln2 * age / half_life_days))
        tgt.append(_targets(m, xg_weight))

    for _ in range(iters):
        num = den = 0.0
        for k, m in enumerate(train):
            th, ta = tgt[k]
            num += w[k] * (th + ta)
            den += w[k] * (A[m["home"]] * D[m["away"]] * H + A[m["away"]] * D[m["home"]])
        if den > 0:
            base = num / den

        a_num = {t: 0.0 for t in teams}; a_den = {t: 0.0 for t in teams}
        d_num = {t: 0.0 for t in teams}; d_den = {t: 0.0 for t in teams}
        h_num = h_den = 0.0
        for k, m in enumerate(train):
            wk, h, a = w[k], m["home"], m["away"]
            th, ta = tgt[k]
            a_num[h] += wk * th
            a_num[a] += wk * ta
            a_den[h] += wk * base * D[a] * H
            a_den[a] += wk * base * D[h]
            d_num[a] += wk * th   # away defans, home hedefini yer
            d_num[h] += wk * ta
            d_den[a] += wk * base * A[h] * H
            d_den[h] += wk * base * A[a]
            h_num += wk * th
            h_den += wk * base * A[h] * D[a]

        for t in teams:
            if a_den[t] > 0:
                A[t] = a_num[t] / a_den[t]
            if d_den[t] > 0:
                D[t] = d_num[t] / d_den[t]
        if h_den > 0:
            H = h_num / h_den

        ma = sum(A.values()) / len(teams)
        md = sum(D.values()) / len(teams)
        if ma > 0 and md > 0:
            for t in teams:
                A[t] /= ma
                D[t] /= md
            base *= ma * md

    return {"A": A, "D": D, "H": H, "base": base, "teams": set(teams)}


# predict aynen model.py'den
predict = M.predict
