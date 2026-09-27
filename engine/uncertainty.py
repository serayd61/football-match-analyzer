"""
Backtest belirsizlik katmanı — saf stdlib.

Neden: mevcut raporlar (reports/backtest-xg.md, backtest-elo.md) yalnız nokta
tahmini veriyor (ör. E0 log-loss Δ −0.0165). ~1.100 test maçında bu farkın
gürültüden ayrılıp ayrılmadığı bilinmiyor; ROI ise çok daha gürültülü.

Bu modül iki modeli AYNI maçlar üzerinde eşleştirilmiş (paired) bootstrap ile
karşılaştırır. Maçlar bağımsız değil (aynı hafta, aynı takımlar) → varsayılan
olarak ISO hafta kümesi (cluster) üzerinden yeniden örnekler.
"""
import math
import random

OUTCOMES = ("H", "D", "A")


def match_scores(p, actual, odds=None, ev_threshold=0.05):
    """Tek maç için log-loss, Brier (3-sınıf toplam) ve value-bet kâr/stake."""
    ll = -math.log(max(p[actual], 1e-9))
    brier = sum((p[o] - (1.0 if o == actual else 0.0)) ** 2 for o in OUTCOMES)
    profit = stake = 0.0
    if odds and all(odds.get(o) for o in OUTCOMES):
        for o in OUTCOMES:
            if p[o] * odds[o] - 1.0 > ev_threshold:
                stake += 1.0
                profit += (odds[o] - 1.0) if o == actual else -1.0
    return {"ll": ll, "brier": brier, "profit": profit, "stake": stake}


def _clusters(keys):
    groups = {}
    for i, k in enumerate(keys):
        groups.setdefault(k, []).append(i)
    return list(groups.values())


def _quantile(sorted_vals, q):
    if not sorted_vals:
        return float("nan")
    pos = q * (len(sorted_vals) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def paired_diff(base, cand, cluster_keys=None, n_boot=2000, seed=7, alpha=0.05):
    """
    Ortalama(cand − base) için küme-bootstrap güven aralığı.
    Düşük = iyi olan metriklerde (log-loss, Brier) negatif Δ iyileşmedir.
    Dönüş: {delta, lo, hi, p_improve, n, clusters}
      p_improve = bootstrap örneklerinde Δ<0 oranı.
    """
    if len(base) != len(cand):
        raise ValueError("base ve cand aynı maç listesinden gelmeli")
    n = len(base)
    if n == 0:
        return None
    diffs = [c - b for b, c in zip(base, cand)]
    keys = cluster_keys if cluster_keys is not None else list(range(n))
    groups = _clusters(keys)
    rng = random.Random(seed)
    stats = []
    for _ in range(n_boot):
        s = cnt = 0.0
        for _ in range(len(groups)):
            g = groups[rng.randrange(len(groups))]
            for i in g:
                s += diffs[i]
            cnt += len(g)
        stats.append(s / cnt)
    stats.sort()
    return {
        "delta": sum(diffs) / n,
        "lo": _quantile(stats, alpha / 2),
        "hi": _quantile(stats, 1 - alpha / 2),
        "p_improve": sum(1 for v in stats if v < 0) / len(stats),
        "n": n,
        "clusters": len(groups),
    }


def roi_ci(profits, stakes, cluster_keys=None, n_boot=2000, seed=11, alpha=0.05):
    """ROI = Σkâr/Σstake (%). Küme-bootstrap aralığı. Bahis yoksa None."""
    total_stake = sum(stakes)
    if total_stake == 0:
        return None
    keys = cluster_keys if cluster_keys is not None else list(range(len(profits)))
    groups = _clusters(keys)
    rng = random.Random(seed)
    stats = []
    for _ in range(n_boot):
        p = s = 0.0
        for _ in range(len(groups)):
            g = groups[rng.randrange(len(groups))]
            for i in g:
                p += profits[i]
                s += stakes[i]
        if s > 0:
            stats.append(p / s * 100)
    stats.sort()
    return {
        "roi": sum(profits) / total_stake * 100,
        "lo": _quantile(stats, alpha / 2),
        "hi": _quantile(stats, 1 - alpha / 2),
        "bets": int(total_stake),
        "p_positive": sum(1 for v in stats if v > 0) / len(stats) if stats else float("nan"),
    }


def week_key(d):
    """datetime → 'YYYY-Www' (ISO hafta) — bootstrap kümesi."""
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def verdict(res, min_p=0.95):
    """Kısa okunur hüküm (düşük=iyi metrik için)."""
    if res is None:
        return "veri yok"
    if res["hi"] < 0 and res["p_improve"] >= min_p:
        return "anlamlı iyileşme"
    if res["lo"] > 0:
        return "anlamlı kötüleşme"
    return "belirsiz (aralık 0'ı kapsıyor)"
