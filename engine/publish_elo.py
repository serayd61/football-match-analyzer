"""
ELO snapshot'ını canlı `team_elo` tablosuna yaz (Faz 2, Hetzner haftalık job).
DRY-RUN varsayılan (yazmaz); --write ile Supabase'e POST.

Ne yapar (lig başına PL/PD/SA/BL1/FL1):
  1. FD.co.uk takım evrenini al (modelle aynı 2 sezon: 2024,2025).
  2. Güncel ELO snapshot'ı (Club Elo, read_by_date latest) → FD.co.uk adı → ELO
     (features_elo.elo_key, kanıtlı %100 eşleme).
  3. FD.co.uk → football-data.org adı (publish_xg.map_teams, kanıtlı) → ratings anahtarı
     canlı model namespace'i olur (dc_model_params ile birebir) → TS runtime isim-eşleme YOK.
  4. Lig ELO→gol eşleme paramları (a,b,total) + harman ağırlığı (lambda) eklenir.
  5. team_elo'ya {a,b,total,lambda,ratings} JSONB yazılır (yalnız kapsama tam liglerde).

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOCCERDATA_DIR.
Çalıştır: SOCCERDATA_DIR=/opt/soccerdata python publish_elo.py [--write]
"""
import json
import os

from data import load_matches
import features_elo as FE
from publish_xg import FD_TO_FDORG, FDORG_TEAMS, map_teams

START, END = 2024, 2025  # canlı modelle (dc_model_params) aynı takım evreni

# Lig-başı ELO→gol eşleme (engine/backtest_elo.fit_elo_map, 2020-2024) + harman ağırlığı
# (backtest optimal λ; test-seti seçimi olduğu için mütevazı, JSONB'de tutulup ayarlanabilir).
# a: gol/ELO-puanı, b: ev-avantajı (gol), total: lig ort. gol, lambda: harman 0..1.
ELO_MAP = {
    "PL":  {"a": 0.004605, "b": 0.008, "total": 2.69, "lambda": 0.15},
    "PD":  {"a": 0.004769, "b": 0.228, "total": 2.51, "lambda": 0.30},
    "SA":  {"a": 0.005452, "b": 0.200, "total": 3.05, "lambda": 0.30},
    "BL1": {"a": 0.005213, "b": 0.322, "total": 3.03, "lambda": 0.40},
    "FL1": {"a": 0.005553, "b": 0.029, "total": 2.76, "lambda": 0.40},
}


def latest_elo_snapshot():
    """Club Elo güncel (read_by_date latest) → {(country, key): elo}."""
    import logging
    logging.disable(logging.CRITICAL)
    import soccerdata as sd
    df = sd.ClubElo().read_by_date().reset_index()
    snap = {}
    for _, r in df.iterrows():
        try:
            snap[(r["country"], FE.elo_key(r["team"]))] = float(r["elo"])
        except (TypeError, ValueError, KeyError):
            continue
    return snap, str(df["from"].max())[:10] if "from" in df.columns else None


def build_rows():
    snap, snap_date = latest_elo_snapshot()
    rows = []
    print("=" * 74)
    print("  ELO → team_elo SNAPSHOT + İSİM EŞLEME (DRY-RUN)")
    print("=" * 74)
    for fd_code, fdorg in FD_TO_FDORG.items():
        country = FE.CC[fd_code]
        ms = load_matches(fd_code, START, END)
        fd_teams = sorted({m["home"] for m in ms} | {m["away"] for m in ms})
        mapping, unmatched_org = map_teams(fd_teams, FDORG_TEAMS[fdorg])

        ratings = {}
        missing_elo = []
        for t in fd_teams:
            org = mapping.get(t)
            elo = snap.get((country, FE.elo_key(t)))
            if org and elo is not None:
                ratings[org] = round(elo, 1)
            elif org and elo is None:
                missing_elo.append(t)

        cov = len(ratings) / len(FDORG_TEAMS[fdorg]) * 100
        clean = (not unmatched_org) and (not missing_elo) and len(ratings) == len(FDORG_TEAMS[fdorg])
        flag = "✅" if clean else "⚠️"
        print(f"  {flag} {fdorg}: {len(ratings)}/{len(FDORG_TEAMS[fdorg])} takım ELO (%{cov:.0f}), "
              f"λ={ELO_MAP[fdorg]['lambda']}, snapshot {snap_date}")
        if unmatched_org:
            print(f"      İSİM eşleşmeyen (FD→org): {unmatched_org}")
        if missing_elo:
            print(f"      ELO eksik: {missing_elo}")

        elo_blob = dict(ELO_MAP[fdorg])
        elo_blob["ratings"] = ratings
        rows.append({
            "league_code": fdorg, "elo": elo_blob,
            "snapshot_date": snap_date, "coverage_pct": cov, "clean": clean,
        })
    print("=" * 74)
    out = os.path.join(os.path.dirname(__file__), "elo_snapshot_output.json")
    with open(out, "w") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"  Çıktı: {out}  ({len(rows)} lig) — DB'ye YAZILMADI")
    return rows


def write_to_supabase(rows):
    import urllib.request
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/team_elo"
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    written = []
    for r in rows:
        if not r["clean"]:
            print(f"  ⏭️  {r['league_code']}: kapsama tam değil — yazılmadı")
            continue
        body = json.dumps({
            "league_code": r["league_code"], "elo": r["elo"],
            "snapshot_date": r["snapshot_date"],
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


if __name__ == "__main__":
    import sys
    rows = build_rows()
    if "--write" in sys.argv:
        print("-" * 74)
        print("  team_elo'ya YAZILIYOR (--write)")
        write_to_supabase(rows)
