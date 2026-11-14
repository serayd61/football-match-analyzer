"""
Kendi Elo'muz — yalnız maç sonuçlarından, dış servis yok (2026-11-14).

Neden: gol-DC yalnız hedef ligin son 540 gününü görür ve takım gücünü geç öğrenir
(sezon başı, yeni çıkan takım). Elo havuzu ülkenin ilk iki kademesini birlikte tutar;
takım üst lige kendi puanıyla gelir. Kapı: reports/backtest-own-elo.md.

Kural (World Football Elo):
    E_ev = 1 / (1 + 10^(-(R_ev + hfa - R_dep) / 400))
    R   += k · G · (S - E),   G = 1 (fark ≤ 1), 1.5 (fark 2), (11 + fark) / 8 (fark ≥ 3)

DC ile harman λ DÜZEYİNDE yapılır ki 1X2, Ü/A ve KG aynı gol beklentisinden çıksın:
    üstünlük_DC  = λ_ev - λ_dep
    üstünlük_Elo = gpe · (R_ev - R_dep) + ev_avantajı        (ev_avantajı = base · (H - 1), DC'den)
    üstünlük     = (1 - lam) · üstünlük_DC + lam · üstünlük_Elo
    toplam gol   = λ_ev + λ_dep                              (DC'den, değişmez)
lam = 0 → DC çıktısı birebir (parite).

Saf stdlib; hem engine/service.py hem engine/backtest_ownelo.py bu dosyayı kullanır.
"""
from collections import defaultdict
from typing import Any, Dict, Iterable, Optional, Tuple

DEFAULTS: Dict[str, float] = {
    "k": 10.0,            # güncelleme katsayısı
    "lam": 0.6,           # Elo'nun harmandaki payı
    "hfa": 60.0,          # ev avantajı (Elo puanı, yalnız beklenen sonuçta)
    "gpe": 0.0057,        # Elo puanı başına gol farkı (5 lig fit ortalaması, 0.0055–0.0060)
    "init": 1500.0,       # üst kademede ilk kez görülen takım
    "feeder_init": 1350.0,  # alt kademede ilk kez görülen takım
    "cap_sup": 2.5,       # |üstünlük| tavanı (gol)
    "min_matches": 8.0,   # takımın havuzda bu kadar maçı yoksa satır üretilmez
}


def settings(raw: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """params.elo → sayısal ayarlar (bilinmeyen / bozuk değer varsayılana düşer)."""
    out = dict(DEFAULTS)
    for key in DEFAULTS:
        if isinstance(raw, dict) and key in raw:
            try:
                out[key] = float(raw[key])
            except (TypeError, ValueError):
                pass
    return out


def margin_mult(goal_diff: int) -> float:
    gd = abs(goal_diff)
    return 1.0 if gd <= 1 else 1.5 if gd == 2 else (11.0 + gd) / 8.0


def expected(r_home: float, r_away: float, hfa: float) -> float:
    return 1.0 / (1.0 + 10 ** (-(r_home + hfa - r_away) / 400.0))


def walk(events: Iterable[Tuple[Any, int, Dict[str, Any]]], k: float, hfa: float,
         init: float, feeder_init: float, on_read=None):
    """Kronolojik tek havuz.

    events: (gün_anahtarı, kademe, maç) — kademe 0 üst, 1 alt; maç: home, away, fthg, ftag.
    Aynı günün bütün maçları günün BAŞINDAKİ puanı okur, sonra güncellenir (sızıntı yok).
    on_read(maç, kademe, R_ev, R_dep): maçtan önceki puanlar (backtest bunu toplar).
    Dönüş: (puanlar, oynanan_maç_sayısı).
    """
    start = {0: init, 1: feeder_init}
    rating: Dict[Any, float] = {}
    played: Dict[Any, int] = defaultdict(int)
    ordered = sorted(events, key=lambda e: e[0])
    i = 0
    while i < len(ordered):
        j = i
        while j < len(ordered) and ordered[j][0] == ordered[i][0]:
            j += 1
        day = ordered[i:j]
        for _, tier, m in day:
            rh = rating.setdefault(m["home"], start.get(tier, init))
            ra = rating.setdefault(m["away"], start.get(tier, init))
            if on_read is not None:
                on_read(m, tier, rh, ra)
        delta: Dict[Any, float] = defaultdict(float)
        for _, _tier, m in day:
            gd = m["fthg"] - m["ftag"]
            s = 1.0 if gd > 0 else 0.5 if gd == 0 else 0.0
            d = k * margin_mult(gd) * (s - expected(rating[m["home"]], rating[m["away"]], hfa))
            delta[m["home"]] += d
            delta[m["away"]] -= d
            played[m["home"]] += 1
            played[m["away"]] += 1
        for team, d in delta.items():
            rating[team] += d
        i = j
    return rating, played


def blend_lambdas(lam_home: float, lam_away: float, home_adv: float, elo_diff: float,
                  cfg: Dict[str, float]) -> Tuple[float, float]:
    """DC gol beklentileri + Elo farkı → harmanlanmış (λ_ev, λ_dep). Toplam gol korunur."""
    lam = min(max(cfg["lam"], 0.0), 1.0)
    if lam == 0.0:
        return lam_home, lam_away
    total = lam_home + lam_away
    cap = cfg["cap_sup"]
    sup_elo = max(-cap, min(cap, cfg["gpe"] * elo_diff + home_adv))
    sup = (1.0 - lam) * (lam_home - lam_away) + lam * sup_elo
    # iki λ da pozitif kalsın: |üstünlük| toplamın altında
    lim = max(total - 0.10, 0.0)
    sup = max(-lim, min(lim, sup))
    return (total + sup) / 2.0, (total - sup) / 2.0


def home_advantage(model: Dict[str, Any]) -> float:
    """DC modelinden ortalama iki takım için ev avantajı (gol): base · (H - 1)."""
    return float(model["base"]) * (float(model["H"]) - 1.0)


# ---------------------------------------------------------------------------
# Servis tarafı: havuz seçimi ve depodan puan hesabı (store nesnesi: resolve, load_for_fit)
# ---------------------------------------------------------------------------
def _ids(v) -> list:
    out = []
    for x in v if isinstance(v, (list, tuple)) else []:
        try:
            out.append(int(x))
        except (TypeError, ValueError):
            continue
    return out


def pool_for(league_id: int, raw: Optional[Dict[str, Any]], resolve) -> Optional[Tuple[tuple, tuple]]:
    """params.elo.pools içinden hedef ligin havuzu → (üst_gruplar, alt_gruplar) ya da None.

    pools: [{"top": [47], "feeders": [48, 938218]}, ...] — id'ler sezonluk olabilir; hepsi
    store.resolve ile kanonik gruba indirgenir. Hedef lig yalnız bir havuzun "top" tarafındaysa
    eşleşir: alt kademe ligleri hedef olarak ölçülmedi, satır üretilmez.
    """
    if not isinstance(raw, dict):
        return None
    target = resolve(int(league_id))
    for pool in raw.get("pools") or []:
        if not isinstance(pool, dict):
            continue
        top = tuple(sorted({resolve(i) for i in _ids(pool.get("top"))}))
        if target not in top:
            continue
        feeders = tuple(sorted({resolve(i) for i in _ids(pool.get("feeders"))} - set(top)))
        return top, feeders
    return None


def ratings(store, pool: Tuple[tuple, tuple], ref_date, cfg: Dict[str, float]):
    """Havuzun ref_date ÖNCESİ bütün maçlarından Elo → (puanlar, oynanan_maç). Anahtar: takım id (str)."""
    events, seen = [], set()
    for tier, groups in enumerate(pool):
        for gid in groups:
            for m in store.load_for_fit(gid):
                if m["date"] >= ref_date:
                    continue
                key = m.get("id") or (m["date"], m["home"], m["away"])
                if key in seen:
                    continue
                seen.add(key)
                events.append((m["date"].toordinal(), tier, m))
    return walk(events, cfg["k"], cfg["hfa"], cfg["init"], cfg["feeder_init"])
