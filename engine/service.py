"""
Footy Predict Service — FastAPI
n8n bu servisi HTTP ile çağırır:
    POST /predict   {"fixtures": [ ...site fixture shape... ]}  -> {"predictions":[...]}
    POST /backfill  {"days": 540}   (admin: depoyu doldur)
    POST /update    {"days": 3}     (admin: son günleri güncelle)
    GET  /health
    GET  /status

Model: engine/model.py (Dixon-Coles-lite). Veri: engine/store.py (FotMob sonuçları).
Çalıştır:  uvicorn service:app --host 0.0.0.0 --port 8000
"""
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import model as M
from store import ResultStore, backfill, update_recent, _parse_dt

MODEL_VERSION = os.environ.get("MODEL_VERSION", "dc-1.0")
SERVICE_TOKEN = os.environ.get("PREDICT_SERVICE_TOKEN", "")  # opsiyonel: /predict & admin koruması
MIN_LEAGUE_MATCHES = int(os.environ.get("MIN_LEAGUE_MATCHES", "150"))

app = FastAPI(title="Footy Predict Service", version=MODEL_VERSION)
store = ResultStore()

# (league_id, ref_ordinal) -> fitted model | None
_fit_cache: Dict[tuple, Optional[dict]] = {}


def _check_token(authorization: Optional[str]):
    if not SERVICE_TOKEN:
        return
    tok = (authorization or "").replace("Bearer ", "")
    if tok != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _get_model(league_id: int, ref_ord: int) -> Optional[dict]:
    key = (league_id, ref_ord)
    if key in _fit_cache:
        return _fit_cache[key]
    matches = store.load_for_fit(league_id)
    mdl = None
    if len(matches) >= MIN_LEAGUE_MATCHES:
        ref_date = datetime.fromordinal(ref_ord)
        mdl = M.fit(matches, ref_date)
    _fit_cache[key] = mdl
    return mdl


def _pick_and_conf(pr: dict):
    opts = {"1": pr["p_home"], "X": pr["p_draw"], "2": pr["p_away"]}
    pick = max(opts, key=opts.get)
    return pick, opts[pick]


def _rationale_tr(pr: dict, home: str, away: str, pick: str) -> str:
    lh, la = pr["lambda_home"], pr["lambda_away"]
    side = {"1": f"{home} (ev sahibi)", "X": "beraberlik", "2": f"{away} (deplasman)"}[pick]
    parts = [
        f"Model {side} yönünde eğilimli.",
        f"Beklenen gol: {home} {lh:.2f} – {la:.2f} {away}.",
        f"1/X/2: %{pr['p_home']*100:.0f} / %{pr['p_draw']*100:.0f} / %{pr['p_away']*100:.0f}.",
        f"Üst 2.5: %{pr['p_over25']*100:.0f}, KG Var: %{pr['p_btts_yes']*100:.0f}.",
    ]
    return " ".join(parts)


# ---- request shapes (esnek: hem site hem ham FotMob alan adlarını kabul eder) ----
class PredictRequest(BaseModel):
    fixtures: List[Dict[str, Any]]
    ref_date: Optional[str] = None  # 'YYYY-MM-DD' (yoksa bugün UTC)


class AdminDays(BaseModel):
    days: Optional[int] = None


def _f(fx: dict, *keys):
    for k in keys:
        if k in fx and fx[k] is not None:
            return fx[k]
    return None


@app.get("/health")
def health():
    return {"ok": True, "version": MODEL_VERSION}


@app.get("/status")
def status():
    leagues = store.leagues()
    return {
        "ok": True,
        "version": MODEL_VERSION,
        "store_total_matches": store.total(),
        "league_count": len(leagues),
        "top_leagues": [{"leagueId": l, "matches": store.league_count(l)} for l in leagues[:15]],
        "min_league_matches": MIN_LEAGUE_MATCHES,
    }


@app.post("/predict")
def predict(req: PredictRequest, authorization: Optional[str] = Header(default=None)):
    _check_token(authorization)

    if req.ref_date:
        ref_dt = _parse_dt(req.ref_date) or datetime.now(timezone.utc)
    else:
        ref_dt = datetime.now(timezone.utc)
    ref_ord = ref_dt.toordinal()

    out: List[dict] = []
    skipped = 0
    for fx in req.fixtures:
        fid = _f(fx, "id", "fixtureId")
        lid = _f(fx, "leagueId", "league_id")
        home_id = _f(fx, "homeTeamId", "homeId")
        away_id = _f(fx, "awayTeamId", "awayId")
        home_name = _f(fx, "homeTeam", "homeName") or "Ev"
        away_name = _f(fx, "awayTeam", "awayName") or "Deplasman"
        league_name = _f(fx, "league", "leagueName")
        kickoff = _f(fx, "date", "utcTime", "kickoff")

        if fid is None or lid is None or home_id is None or away_id is None:
            skipped += 1
            continue

        mdl = _get_model(int(lid), ref_ord)
        if mdl is None:
            skipped += 1
            continue

        hk, ak = str(home_id), str(away_id)
        if hk not in mdl["teams"] or ak not in mdl["teams"]:
            # takım geçmişte yok (yeni çıkmış/az maç) -> güvenilmez, atla
            skipped += 1
            continue

        pr = M.predict(mdl, hk, ak)
        if pr is None:
            skipped += 1
            continue

        pick, conf = _pick_and_conf(pr)
        out.append({
            "fixtureId": int(fid),
            "leagueId": int(lid),
            "leagueName": league_name,
            "homeId": int(home_id),
            "homeName": home_name,
            "awayId": int(away_id),
            "awayName": away_name,
            "kickoff": kickoff,
            "p_home": round(pr["p_home"], 4),
            "p_draw": round(pr["p_draw"], 4),
            "p_away": round(pr["p_away"], 4),
            "p_over25": round(pr["p_over25"], 4),
            "p_btts_yes": round(pr["p_btts_yes"], 4),
            "lambda_home": round(pr["lambda_home"], 3),
            "lambda_away": round(pr["lambda_away"], 3),
            "pick": pick,
            "confidence": round(conf, 4),
            "rationale": _rationale_tr(pr, home_name, away_name, pick),
            "modelVersion": MODEL_VERSION,
        })

    return {
        "ok": True,
        "version": MODEL_VERSION,
        "ref_date": ref_dt.strftime("%Y-%m-%d"),
        "received": len(req.fixtures),
        "predicted": len(out),
        "skipped": skipped,
        "predictions": out,
    }


@app.post("/backfill")
def admin_backfill(body: AdminDays, authorization: Optional[str] = Header(default=None)):
    _check_token(authorization)
    n = backfill(body.days or 540)
    store.reload()
    _fit_cache.clear()
    return {"ok": True, "added": n, "store_total": store.total()}


@app.post("/update")
def admin_update(body: AdminDays, authorization: Optional[str] = Header(default=None)):
    _check_token(authorization)
    n = update_recent(body.days or 3)
    store.reload()
    _fit_cache.clear()
    return {"ok": True, "added": n, "store_total": store.total()}
