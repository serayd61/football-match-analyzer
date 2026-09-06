"""
Footy Predict Service — FastAPI
n8n bu servisi HTTP ile çağırır:
    POST /predict   {"fixtures": [ ...site fixture shape... ]}  -> {"predictions":[...]}
    POST /backfill  {"days": 540}   (admin: depoyu doldur)
    POST /update    {"days": 3}     (admin: son günleri güncelle)
    POST /reload                    (admin: params + depo + cache yenile)
    GET  /health
    GET  /status

Model: engine/model.py (Dixon-Coles-lite) ve engine/model_xg.py (xG harmanı).
Veri: engine/store.py (FotMob sonuçları), engine/store_xg.py (Understat xG yan deposu).

Faz 3 (2026-09-07, haftalık öğrenme döngüsü):
- SÜRÜMLER site tablosundan gelir (engine/params.py → ENGINE_PARAMS_URL → params.json
  → env varsayılanları). /predict her fixture için AKTİF + GÖLGE sürümlerin hepsini
  üretir; satır başına `modelVersion`. Site resmi sürümü kendisi seçer; gölge
  satırlar Pazartesi incelemesinde eşleştirilmiş karşılaştırma verisi olur.
- kind="xg" sürüm yalnız eğitim penceresinde xG kapsamı `xg_min_coverage` üstündeki
  ligde satır üretir; yoksa o lig için o sürüm atlanır (gol sürümüne DÜŞMEZ —
  karışık sürüm etiketi olmasın).
- Az maçlı takım: n_eff < min_team_matches → o satır atlanır (uçuk λ yayınlanmaz).
- Depo KENDİNİ TAZELER: results.jsonl 20 saatten eskiyse /predict arka planda
  update_recent(4) (+ xG deposu varsa yeniden kurar) çalıştırır → Hetzner'a cron gerekmez.
- _fit_cache günlük anahtarlıdır; eski günlerin girdileri her çağrıda silinir.
Çalıştır:  uvicorn service:app --host 0.0.0.0 --port 8000
"""
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel

import model as M
import model_xg as MX
import params as P
from store import ResultStore, STORE_PATH, backfill, update_recent, _parse_dt, league_name
from store_xg import XgStore

SERVICE_TOKEN = os.environ.get("PREDICT_SERVICE_TOKEN", "")  # opsiyonel: /predict & admin koruması
MIN_LEAGUE_MATCHES = int(os.environ.get("MIN_LEAGUE_MATCHES", "150"))
MIN_TEAM_MATCHES = float(os.environ.get("MIN_TEAM_MATCHES", "6"))       # sürüm params'ı yoksa
STORE_MAX_AGE_H = float(os.environ.get("STORE_MAX_AGE_HOURS", "20"))     # depo bundan eskiyse tazele
STORE_REFRESH_DAYS = int(os.environ.get("STORE_REFRESH_DAYS", "4"))
XG_REFRESH_DAYS = int(os.environ.get("XG_REFRESH_DAYS", "600"))
SERVICE_VERSION = "2026-09-07"

app = FastAPI(title="Footy Predict Service", version=SERVICE_VERSION)
store = ResultStore()
xg_store = XgStore()

# (league_id, ref_ordinal, version) -> (fitted model | None, xg_coverage, skip_reason)
_fit_cache: Dict[tuple, tuple] = {}
_refresh_lock = threading.Lock()
_refresh_state: Dict[str, Any] = {"running": False, "last_started": None, "last_finished": None, "last_error": None, "last_added": None}


def _check_token(authorization: Optional[str]):
    if not SERVICE_TOKEN:
        return
    tok = (authorization or "").replace("Bearer ", "")
    if tok != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Sürüm spesifikasyonu → fit
# ---------------------------------------------------------------------------
def _evict_old(ref_ord: int):
    """Bir önceki günden eski cache anahtarlarını at (bellek sızıntısı önlemi)."""
    stale = [k for k in _fit_cache if k[1] < ref_ord - 1]
    for k in stale:
        _fit_cache.pop(k, None)


def _get_model(league_id: int, ref_ord: int, spec: Dict[str, Any]):
    """→ (model | None, xg_coverage, skip_reason). spec: {version, kind, params}."""
    key = (league_id, ref_ord, spec["version"])
    if key in _fit_cache:
        return _fit_cache[key]
    prm = P.params_for_league(spec, league_id)
    matches = store.load_for_fit(league_id)
    cov = xg_store.attach(matches)
    mdl, reason = None, None
    if len(matches) < MIN_LEAGUE_MATCHES:
        reason = "league_too_small"
    else:
        ref_date = datetime.fromordinal(ref_ord)
        common = dict(half_life_days=prm["half_life_days"], window_days=prm["window_days"], iters=prm["iters"],
                      min_matches=prm["min_matches"], rho=prm["rho"], shrink_k=prm["shrink_k"])
        if spec["kind"] == "xg":
            has_xg = any(m.get("home_xg") is not None for m in matches)
            if prm["xg_weight"] <= 0 or cov < prm["xg_min_coverage"] or not has_xg:
                reason = "xg_coverage"
            else:
                mdl = MX.fit(matches, ref_date, xg_weight=prm["xg_weight"], **common)
        else:
            mdl = M.fit(matches, ref_date, **common)
        if mdl is None and reason is None:
            reason = "fit_failed"
    _fit_cache[key] = (mdl, cov, reason)
    return _fit_cache[key]


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


# ---------------------------------------------------------------------------
# Depo kendini tazeleme (Hetzner'a cron yok)
# ---------------------------------------------------------------------------
def _store_age_hours() -> Optional[float]:
    if not os.path.exists(STORE_PATH):
        return None
    return (time.time() - os.path.getmtime(STORE_PATH)) / 3600.0


def _store_stale() -> bool:
    age = _store_age_hours()
    return age is None or age > STORE_MAX_AGE_H


def _refresh_store():
    """Arka plan: son günlerin sonuçlarını çek, xG yan deposunu (varsa) yenile, cache'i boşalt."""
    if not _refresh_lock.acquire(blocking=False):
        return
    _refresh_state.update(running=True, last_started=datetime.now(timezone.utc).isoformat(), last_error=None)
    try:
        added = update_recent(STORE_REFRESH_DAYS)
        _refresh_state["last_added"] = added
        if os.path.exists(xg_store.path):
            try:
                import store_xg as SX
                SX.build(days=XG_REFRESH_DAYS, out_path=xg_store.path, verbose=False)
            except Exception as e:  # soccerdata yok / Understat erişilemez → gol deposu yine güncel
                print(f"[refresh] xg build skipped: {e}")
        store.reload()
        _fit_cache.clear()
    except Exception as e:
        _refresh_state["last_error"] = str(e)
        print(f"[refresh] failed: {e}")
    finally:
        _refresh_state.update(running=False, last_finished=datetime.now(timezone.utc).isoformat())
        _refresh_lock.release()


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


def _versions_summary(p: Dict[str, Any]):
    return {
        "source": p.get("source"), "fetched_at": p.get("fetched_at"),
        "active": {"version": p["active"]["version"], "kind": p["active"]["kind"], "params": P.merge_params(p["active"].get("params"))},
        "shadow": [{"version": s["version"], "kind": s["kind"], "params": P.merge_params(s.get("params"))} for s in p.get("shadow") or []],
    }


@app.get("/health")
def health():
    p = P.load_params()
    return {"ok": True, "version": p["active"]["version"], "service": SERVICE_VERSION}


@app.get("/status")
def status():
    p = P.load_params()
    leagues = store.leagues()
    return {
        "ok": True,
        "service": SERVICE_VERSION,
        "version": p["active"]["version"],
        "versions": _versions_summary(p),
        "store_total_matches": store.total(),
        "store_age_hours": None if _store_age_hours() is None else round(_store_age_hours(), 2),
        "store_stale": _store_stale(),
        "refresh": dict(_refresh_state),
        "league_count": len(leagues),
        "top_leagues": [
            {"leagueId": l, "name": league_name(l), "matches": store.league_count(l)}
            for l in leagues[:15]
        ],
        "min_league_matches": MIN_LEAGUE_MATCHES,
        "fit_cache_entries": len(_fit_cache),
        "xg": {
            "matches_with_xg": xg_store.total(), "path": xg_store.path,
            "leagues": _xg_league_status(p),
        },
    }


def _xg_league_status(p: Dict[str, Any]):
    out = []
    from store_xg import XG_LEAGUES
    xg_specs = [s for s in P.all_specs(p) if s["kind"] == "xg"]
    for lid in XG_LEAGUES:
        matches = store.load_for_fit(lid)
        cov = xg_store.attach(matches)
        row = {"leagueId": lid, "name": league_name(lid), "matches": len(matches), "xg_coverage": round(cov, 3)}
        row["publishes"] = [s["version"] for s in xg_specs if cov >= P.params_for_league(s, lid)["xg_min_coverage"]]
        out.append(row)
    return out


@app.post("/predict")
def predict(req: PredictRequest, background: BackgroundTasks, authorization: Optional[str] = Header(default=None)):
    _check_token(authorization)

    if req.ref_date:
        ref_dt = _parse_dt(req.ref_date) or datetime.now(timezone.utc)
    else:
        ref_dt = datetime.now(timezone.utc)
    ref_ord = ref_dt.toordinal()
    _evict_old(ref_ord)

    # Depo bayatsa arka planda tazele (bu çağrı mevcut depoyla cevaplanır; ertesi gün taze).
    if _store_stale() and os.environ.get("FOOTBALL_API_KEY") and not _refresh_state["running"]:
        background.add_task(_refresh_store)

    p = P.load_params()
    specs = P.all_specs(p)

    out: List[dict] = []
    skipped = 0
    skipped_by: Dict[str, int] = {}
    per_version: Dict[str, int] = {s["version"]: 0 for s in specs}

    def _skip(reason: str):
        nonlocal skipped
        skipped += 1
        skipped_by[reason] = skipped_by.get(reason, 0) + 1

    for fx in req.fixtures:
        fid = _f(fx, "id", "fixtureId")
        lid = _f(fx, "leagueId", "league_id")
        home_id = _f(fx, "homeTeamId", "homeId")
        away_id = _f(fx, "awayTeamId", "awayId")
        home_name = _f(fx, "homeTeam", "homeName") or "Ev"
        away_name = _f(fx, "awayTeam", "awayName") or "Deplasman"
        lname = _f(fx, "league", "leagueName") or league_name(lid)
        kickoff = _f(fx, "date", "utcTime", "kickoff")

        if fid is None or lid is None or home_id is None or away_id is None:
            _skip("missing_fields")
            continue

        hk, ak = str(home_id), str(away_id)
        for spec in specs:
            mdl, _cov, reason = _get_model(int(lid), ref_ord, spec)
            if mdl is None:
                # aktif sürüm için gerçek atlama; gölge sürümde "o ligde yok" normaldir
                if spec is specs[0]:
                    _skip(reason or "no_model")
                continue
            if hk not in mdl["teams"] or ak not in mdl["teams"]:
                if spec is specs[0]:
                    _skip("team_unknown")
                continue
            min_team = P.params_for_league(spec, lid).get("min_team_matches", MIN_TEAM_MATCHES)
            n_eff = mdl.get("n_eff") or {}
            if min(n_eff.get(hk, 0.0), n_eff.get(ak, 0.0)) < float(min_team):
                if spec is specs[0]:
                    _skip("team_too_few_matches")
                continue

            pr = M.predict(mdl, hk, ak)
            if pr is None:
                if spec is specs[0]:
                    _skip("predict_failed")
                continue

            pick, conf = _pick_and_conf(pr)
            per_version[spec["version"]] += 1
            out.append({
                "fixtureId": int(fid),
                "leagueId": int(lid),
                "leagueName": lname,
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
                "modelVersion": spec["version"],
            })

    return {
        "ok": True,
        "version": p["active"]["version"],
        "versions": [s["version"] for s in specs],
        "params_source": p.get("source"),
        "ref_date": ref_dt.strftime("%Y-%m-%d"),
        "received": len(req.fixtures),
        "predicted": len(out),
        "predicted_by_version": per_version,
        "skipped": skipped,
        "skipped_by": skipped_by,
        "store_stale": _store_stale(),
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


@app.post("/reload")
def admin_reload(authorization: Optional[str] = Header(default=None)):
    """Params cache + depo + fit cache'i yenile (parametre değişikliğini hemen almak için)."""
    _check_token(authorization)
    P.invalidate()
    p = P.load_params(force=True)
    store.reload()
    _fit_cache.clear()
    return {"ok": True, "versions": _versions_summary(p), "store_total": store.total()}
