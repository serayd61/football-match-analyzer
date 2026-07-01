"""
xG-Dixon-Coles parametrelerini canlı TS `dc_model_params` şemasına DÖNÜŞTÜR + isim-eşle.
DRY-RUN varsayılan: fit → dönüşüm → isim eşleme → PARİTE kontrolü → kapsama; DB'ye YAZMAZ.
Çıktıyı engine/xg_params_output.json'a yazar (sonra MCP ile INSERT edilecek — onayla).

Python çarpımsal {A,D,H,base} → TS toplamsal {attack,defense,homeAdv,rho}:
  a_i=ln A_i, d_i=ln D_i, h=ln H, b=ln base, ā=mean(a_i)
  attack_i  = a_i - ā
  defense_i = d_i + b + ā
  homeAdv   = h ;  rho = -0.10   (Python sabit RHO)
→ λ,μ birebir aynı → tahmin birebir aynı (parite ile doğrulanır).

Çalıştır: SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python publish_xg.py
"""
import json
import math
import os

import difflib
import re
import unicodedata

from features import load_features
import model_xg as MX

# FD.co.uk → football-data.org kesin override (fuzzy'nin yanıldığı/eksik kaldığı takımlar).
OVERRIDES = {
    # ENG
    "Brighton": "Brighton & Hove Albion FC", "Leeds": "Leeds United FC",
    "Wolves": "Wolverhampton Wanderers FC",
    # ESP — kısaltmalar fuzzy'de TAKAS oluyor, kesin sabitle
    "Ath Madrid": "Club Atlético de Madrid", "Ath Bilbao": "Athletic Club",
    "Real Madrid": "Real Madrid CF", "Espanol": "RCD Espanyol de Barcelona",
    # ITA
    "Pisa": "AC Pisa 1909",
    # GER
    "M'gladbach": "Borussia Mönchengladbach",
    # FRA
    "Brest": "Stade Brestois 29", "Lens": "Racing Club de Lens",
    "Lyon": "Olympique Lyonnais", "Reims": "Stade de Reims",
    "Rennes": "Stade Rennais FC 1901",
}

# İsim gürültüsü (kulüp tipi ekleri + yıl/numara) — token eşlemede atılır.
_NOISE = {"fc","afc","cf","sc","ac","as","us","ss","ssc","rc","rcd","ca","cd","sd","ud",
          "sv","vfb","vfl","fsv","tsg","gnk","sk","fk","aj","ogc","og","sco","hsc","osc",
          "calcio","balompie","de","la","el","und","and","1846","1848","1899","1901","1907",
          "1909","1910","1913","1963","29","05","1","club","racing","stade","olympique",
          "deportivo","real","athletic"}


def _tokens(name):
    s = "".join(c for c in unicodedata.normalize("NFKD", (name or "").lower())
                if not unicodedata.combining(c))
    s = s.replace("&", " ").replace("'", "").replace("-", " ").replace(".", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = [t for t in s.split() if t and t not in _NOISE and not t.isdigit()]
    return toks


def _tok_match(a, b):
    """İki token 'eşleşir': aynı, biri diğerinin öneki (≥4), veya benzerlik ≥0.8."""
    if a == b: return True
    if len(a) >= 4 and len(b) >= 4 and (a.startswith(b) or b.startswith(a)): return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.8


def _score(fd, fdorg):
    ta, tb = _tokens(fd), _tokens(fdorg)
    if not ta or not tb: return 0.0
    inter = sum(1 for x in ta if any(_tok_match(x, y) for y in tb))
    return inter / min(len(ta), len(tb))


def map_teams(fd_teams, fdorg_teams):
    """FD.co.uk → football-data.org. Override → skor-sıralı greedy (yanlış çalmayı önler)."""
    mapping, used = {}, set()
    remaining = []
    for t in fd_teams:
        if t in OVERRIDES and OVERRIDES[t] in fdorg_teams:
            mapping[t] = OVERRIDES[t]; used.add(OVERRIDES[t])
        else:
            remaining.append(t)
    # tüm skorları hesapla, en yüksekten ata
    pairs = []
    for t in remaining:
        for f in fdorg_teams:
            pairs.append((_score(t, f), t, f))
    pairs.sort(reverse=True, key=lambda p: p[0])
    done = set()
    for sc, t, f in pairs:
        if t in done or f in used or sc < 0.5:
            continue
        mapping[t] = f; used.add(f); done.add(t)
    unmatched = [t for t in fd_teams if t not in mapping]
    return mapping, unmatched

# FD.co.uk kodu → football-data.org kodu (dc_model_params.league_code)
FD_TO_FDORG = {"E0": "PL", "SP1": "PD", "I1": "SA", "D1": "BL1", "F1": "FL1"}

# Hedef namespace: canlı dc_model_params'taki football-data.org tam adları (yer-gerçeği).
FDORG_TEAMS = {
    "PL": ["AFC Bournemouth","Arsenal FC","Aston Villa FC","Brentford FC","Brighton & Hove Albion FC","Burnley FC","Chelsea FC","Crystal Palace FC","Everton FC","Fulham FC","Ipswich Town FC","Leeds United FC","Leicester City FC","Liverpool FC","Manchester City FC","Manchester United FC","Newcastle United FC","Nottingham Forest FC","Southampton FC","Sunderland AFC","Tottenham Hotspur FC","West Ham United FC","Wolverhampton Wanderers FC"],
    "PD": ["Athletic Club","CA Osasuna","CD Leganés","Club Atlético de Madrid","Deportivo Alavés","Elche CF","FC Barcelona","Getafe CF","Girona FC","Levante UD","Rayo Vallecano de Madrid","RC Celta de Vigo","RCD Espanyol de Barcelona","RCD Mallorca","Real Betis Balompié","Real Madrid CF","Real Oviedo","Real Sociedad de Fútbol","Real Valladolid CF","Sevilla FC","UD Las Palmas","Valencia CF","Villarreal CF"],
    "SA": ["AC Milan","AC Monza","AC Pisa 1909","ACF Fiorentina","AS Roma","Atalanta BC","Bologna FC 1909","Cagliari Calcio","Como 1907","Empoli FC","FC Internazionale Milano","Genoa CFC","Hellas Verona FC","Juventus FC","Parma Calcio 1913","SS Lazio","SSC Napoli","Torino FC","Udinese Calcio","US Cremonese","US Lecce","US Sassuolo Calcio","Venezia FC"],
    "BL1": ["1. FC Heidenheim 1846","1. FC Köln","1. FC Union Berlin","1. FSV Mainz 05","Bayer 04 Leverkusen","Borussia Dortmund","Borussia Mönchengladbach","Eintracht Frankfurt","FC Augsburg","FC Bayern München","FC St. Pauli 1910","Hamburger SV","Holstein Kiel","RB Leipzig","SC Freiburg","SV Werder Bremen","TSG 1899 Hoffenheim","VfB Stuttgart","VfL Bochum 1848","VfL Wolfsburg"],
    "FL1": ["AJ Auxerre","Angers SCO","AS Monaco FC","AS Saint-Étienne","FC Lorient","FC Metz","FC Nantes","Le Havre AC","Lille OSC","Montpellier HSC","OGC Nice","Olympique de Marseille","Olympique Lyonnais","Paris FC","Paris Saint-Germain FC","Racing Club de Lens","RC Strasbourg Alsace","Stade Brestois 29","Stade de Reims","Stade Rennais FC 1901","Toulouse FC"],
}

XG_WEIGHT = 0.75
START, END = 2024, 2025  # canlı modelle aynı 2 sezon


def convert_params(m):
    """Python {A,D,H,base} → TS {attack,defense,homeAdv,rho}. Takım anahtarları FD.co.uk (henüz)."""
    A, D, H, base = m["A"], m["D"], m["H"], m["base"]
    teams = list(A.keys())
    a = {t: math.log(A[t]) for t in teams}
    d = {t: math.log(D[t]) for t in teams}
    abar = sum(a.values()) / len(teams)
    b = math.log(base)
    attack = {t: a[t] - abar for t in teams}
    defense = {t: d[t] + b + abar for t in teams}
    return {"attack": attack, "defense": defense, "homeAdv": math.log(H), "rho": -0.10}


def ts_probs(p, home, away):
    """TS predict eşdeğeri (parite kontrolü için) — dixon-coles.ts:rates+predict birebir."""
    lam = math.exp(p["attack"].get(home, 0) + p["defense"].get(away, 0) + p["homeAdv"])
    mu = math.exp(p["attack"].get(away, 0) + p["defense"].get(home, 0))
    rho = p["rho"]
    def pois(k, l): return math.exp(-l) * l ** k / math.factorial(k) if l > 0 else (1.0 if k == 0 else 0.0)
    ph = [pois(i, lam) for i in range(11)]; pa = [pois(j, mu) for j in range(11)]
    H = Dw = Aw = tot = 0.0
    for i in range(11):
        for j in range(11):
            pr = ph[i] * pa[j]
            if i == 0 and j == 0: pr *= 1 - lam * mu * rho
            elif i == 0 and j == 1: pr *= 1 + lam * rho
            elif i == 1 and j == 0: pr *= 1 + mu * rho
            elif i == 1 and j == 1: pr *= 1 - rho
            pr = max(pr, 0.0); tot += pr
            if i > j: H += pr
            elif i == j: Dw += pr
            else: Aw += pr
    return (H / tot, Dw / tot, Aw / tot)


def remap_names(params, fd_teams, fdorg_teams):
    """FD.co.uk anahtarlarını football-data.org adlarına çevir. (out, mapping, unmatched, mapped)."""
    mapping, unmatched = map_teams(fd_teams, fdorg_teams)
    out = {"attack": {}, "defense": {}, "homeAdv": params["homeAdv"], "rho": params["rho"]}
    for t in fd_teams:
        f = mapping.get(t)
        if not f:
            continue
        out["attack"][f] = params["attack"][t]
        out["defense"][f] = params["defense"][t]
    return out, mapping, unmatched, len(mapping)


def write_to_supabase(rows):
    """Rows'u Supabase PostgREST'e INSERT eder (Hetzner job için). stdlib urllib.
    Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Sadece %100 kapsama + parite temiz ligleri yazar."""
    import urllib.request
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/dc_model_params"
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    written = []
    for r in rows:
        if r["unmatched"] or r["coverage_pct"] < 100.0 or r["parity_max_diff"] > 1e-9:
            print(f"  ⏭️  {r['league_code']}: temiz değil (kapsama/parite) — yazılmadı")
            continue
        body = json.dumps({
            "league_code": r["league_code"], "params": r["params"],
            "trained_matches": r["trained_matches"], "season": r["season"],
        }).encode()
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json", "Prefer": "return=minimal",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"  ✅ {r['league_code']}: yazıldı (HTTP {resp.status})")
                written.append(r["league_code"])
        except Exception as e:
            print(f"  ❌ {r['league_code']}: yazım hatası — {e}")
    print(f"  Toplam yazılan: {len(written)}/{len(rows)} → {written}")
    return written


def main(dry_run=True):
    from datetime import datetime, timezone
    ref = datetime(2026, 7, 1)
    rows = []
    print("=" * 74)
    print("  xG-DC → dc_model_params DÖNÜŞÜM + İSİM EŞLEME (DRY-RUN)" if dry_run else "  YAYIN")
    print("=" * 74)
    for fd_code, fdorg in FD_TO_FDORG.items():
        recs, stats = load_features(fd_code, START, END, verbose=False)
        model = MX.fit(recs, ref, xg_weight=XG_WEIGHT, half_life_days=180, window_days=540, iters=25)
        if model is None:
            print(f"  {fdorg}: fit başarısız (yetersiz maç)"); continue
        ts_params = convert_params(model)
        fd_teams = sorted(model["A"].keys())

        # PARİTE: Python predict vs TS-eşdeğer predict (aynı takım, FD.co.uk anahtarlı)
        max_diff = 0.0
        sample = [(fd_teams[0], fd_teams[1]), (fd_teams[-1], fd_teams[2])]
        for h, a in sample:
            pp = MX.predict(model, h, a)
            th, td, ta = ts_probs(ts_params, h, a)  # dönüşüm öncesi FD.co.uk anahtarlı
            max_diff = max(max_diff, abs(pp["p_home"] - th), abs(pp["p_draw"] - td), abs(pp["p_away"] - ta))

        # İSİM EŞLEME → football-data.org namespace
        remapped, mapping, unmatched, mapped = remap_names(ts_params, fd_teams, FDORG_TEAMS[fdorg])
        cov = mapped / len(fd_teams) * 100
        flag = "✅" if (not unmatched and cov == 100.0 and max_diff < 1e-9) else "⚠️"
        print(f"  {flag} {fdorg}: {len(fd_teams)} takım, isim-eşleşme {mapped}/{len(fd_teams)} (%{cov:.0f}), "
              f"parite Δ={max_diff:.2e}, xG kapsama %{stats['coverage_pct']}")
        if unmatched:
            print(f"      EŞLEŞMEYEN (FD.co.uk→?): {unmatched}")
        if os.environ.get("SHOW_MAP"):
            for t in fd_teams:
                print(f"        {t:<22} → {mapping.get(t, '❌ YOK')}")
        rows.append({
            "league_code": fdorg, "params": remapped,
            "trained_matches": len([r for r in recs if r['date'] < ref]),
            "season": f"{START},{END}", "source": "xg-dc-1.0",
            "n_teams": mapped, "coverage_pct": cov, "parity_max_diff": max_diff,
            "unmatched": unmatched,
        })
    print("=" * 74)
    out_path = os.path.join(os.path.dirname(__file__), "xg_params_output.json")
    with open(out_path, "w") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"  Çıktı: {out_path}  ({len(rows)} lig)  — DB'ye YAZILMADI")
    return rows


if __name__ == "__main__":
    import sys
    rows = main(dry_run=True)
    if "--write" in sys.argv:
        print("-" * 74)
        print("  SUPABASE'E YAZILIYOR (--write)")
        write_to_supabase(rows)
