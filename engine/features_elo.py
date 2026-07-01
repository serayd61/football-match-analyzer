"""
ELO özellik katmanı (Club Elo / soccerdata) — POINT-IN-TIME, sızıntısız.

ClubElo takım adları FD.co.uk'e çok yakın ("Man City", "Tottenham"...); mevcut
features.canon() çoğunu eşler. 7 istisna için ELO'ya özel _ELO_FIX (ClubElo yüzey
formunu FD-canonical'a indirir) — FD↔Understat alias sözlüğüne dokunmadan.

read_by_date(gün) o güne geçerli TÜM kulüp ELO'sunu verir (dünya geneli, tüm ligler
tek çağrıda). Maç tarihlerini haftalık (Pazartesi) kovaya yuvarlayıp o snapshot'ları
çeker → {grid_monday: {(country, key): elo}}. Maç için: maçtan ÖNCEKİ en yakın
Pazartesi snapshot'ı → o haftanın başındaki ELO (o maçın sonucunu içermez → sızıntı yok).

Yalnız yerelde/Hetzner'de (soccerdata TLS). Vercel'de KOŞMAZ → canlıya taşınırsa
ELO snapshot ayrı tabloya yazılır (bkz. Faz 2 canlı-bağlama).
"""
from datetime import timedelta

from features import canon

# FD kodu → ClubElo country
CC = {"E0": "ENG", "SP1": "ESP", "I1": "ITA", "D1": "GER", "F1": "FRA"}

# ClubElo yüzey-formu (canon'lanmış) → FD-canonical hedef (features.canon çıktısıyla aynı olsun)
_ELO_FIX = {
    "bayern": "bayern munich",
    "frankfurt": "eintracht frankfurt",
    "koeln": "fc cologne",
    "gladbach": "borussia m gladbach",
    "werder": "werder bremen",
    "forest": "nottingham forest",
    "bilbao": "athletic club",
    "fuerth": "greuther furth",
    "holstein": "holstein kiel",
}


def elo_key(name: str) -> str:
    c = canon(name)
    return _ELO_FIX.get(c, c)


def _monday(d):
    return (d - timedelta(days=d.weekday())).date()


def build_snapshots(dates, verbose=True):
    """
    dates: datetime listesi. Haftalık (Pazartesi) benzersiz snapshot'ları çeker.
    Döndürür: (sorted_grid_list, {grid_monday: {(country, key): elo}}).
    """
    import logging
    logging.disable(logging.CRITICAL)
    import soccerdata as sd

    grid = sorted({_monday(d) for d in dates})
    elo = sd.ClubElo()
    snaps = {}
    for i, g in enumerate(grid):
        try:
            df = elo.read_by_date(g.isoformat()).reset_index()
        except Exception as e:
            if verbose:
                print(f"  [elo] {g} çekilemedi: {e}")
            continue
        d = {}
        for _, r in df.iterrows():
            try:
                d[(r["country"], elo_key(r["team"]))] = float(r["elo"])
            except (TypeError, ValueError, KeyError):
                continue
        snaps[g] = d
        if verbose and (i + 1) % 25 == 0:
            print(f"  [elo] {i+1}/{len(grid)} snapshot")
    if verbose:
        print(f"[elo] {len(snaps)}/{len(grid)} haftalık snapshot hazır")
    return sorted(snaps), snaps


def elo_of(grid, snaps, country, fd_name, date):
    """Maçtan ÖNCEKİ en yakın Pazartesi snapshot'ta takımın ELO'su (yoksa None)."""
    target = _monday(date)
    # target'tan büyük olmayan en yakın grid (grid sıralı) — küçük veri, lineer tara yeterli
    best = None
    for g in grid:
        if g <= target:
            best = g
        else:
            break
    if best is None:
        return None
    return snaps.get(best, {}).get((country, elo_key(fd_name)))


def coverage(recs, fd_code, grid, snaps):
    """Kaç maçta iki takımın da ELO'su bulundu (kapsama %)."""
    country = CC[fd_code]
    tot = hit = 0
    miss = set()
    for m in recs:
        tot += 1
        eh = elo_of(grid, snaps, country, m["home"], m["date"])
        ea = elo_of(grid, snaps, country, m["away"], m["date"])
        if eh is not None and ea is not None:
            hit += 1
        else:
            if eh is None:
                miss.add(m["home"])
            if ea is None:
                miss.add(m["away"])
    return hit, tot, sorted(miss)
