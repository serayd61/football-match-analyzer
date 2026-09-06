"""
Motor parametreleri — tek doğruluk kaynağı site tablosudur (engine_model_versions),
servis onu /api/v2/engine/params üzerinden okur. Zincir:

    ENGINE_PARAMS_URL (1 saat cache; hata → eski cache) → PARAMS_PATH (json dosya)
    → varsayılanlar (env: MODEL_VERSION, MODEL_VERSION_XG, XG_WEIGHT, XG_MIN_COVERAGE)

Dönen yapı:
    {"source": "url|file|defaults|cache", "fetched_at": iso,
     "active": {"version","kind","params"},  "shadow": [ {...}, ... ]}

`params` anahtarları (bilinmeyenler yok sayılır):
    half_life_days, window_days, rho, iters, min_matches, shrink_k, min_team_matches,
    xg_weight, xg_min_coverage, leagues: {"<league_id>": {...override...}}
Bağımlılık yok (stdlib). Ağ hatası asla /predict'i düşürmez.
"""
import json
import os
import time
import urllib.request
from typing import Any, Dict, List, Optional

PARAMS_URL = os.environ.get("ENGINE_PARAMS_URL", "").strip()
PARAMS_PATH = os.environ.get("PARAMS_PATH", "").strip()
PARAMS_TTL = float(os.environ.get("ENGINE_PARAMS_TTL", str(60 * 60)))  # sn

DEFAULT_PARAMS: Dict[str, Any] = {
    "half_life_days": 180,
    "window_days": 540,
    "rho": -0.10,
    "iters": 25,
    "min_matches": 120,
    "shrink_k": 0.0,
    "min_team_matches": 6,
    "xg_weight": 0.75,
    "xg_min_coverage": 0.95,
}
_NUMERIC = {"half_life_days", "window_days", "rho", "iters", "min_matches", "shrink_k",
            "min_team_matches", "xg_weight", "xg_min_coverage"}


def env_defaults() -> Dict[str, Any]:
    """URL/dosya yokken bugünkü davranış: aktif = MODEL_VERSION (gol), gölge = xG sürümü."""
    goals = dict(DEFAULT_PARAMS)
    xg = dict(DEFAULT_PARAMS)
    xg["xg_weight"] = float(os.environ.get("XG_WEIGHT", DEFAULT_PARAMS["xg_weight"]))
    xg["xg_min_coverage"] = float(os.environ.get("XG_MIN_COVERAGE", DEFAULT_PARAMS["xg_min_coverage"]))
    return {
        "source": "defaults",
        "fetched_at": _now(),
        "active": {"version": os.environ.get("MODEL_VERSION", "dc-1.0"), "kind": "goals", "params": goals},
        "shadow": [{"version": os.environ.get("MODEL_VERSION_XG", "dc-2.0-xg"), "kind": "xg", "params": xg}],
    }


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def merge_params(*layers: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """DEFAULT_PARAMS ← sürüm params ← lig override. Sayısal alanlar float/int'e zorlanır."""
    out: Dict[str, Any] = dict(DEFAULT_PARAMS)
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        for k, v in layer.items():
            if k in ("leagues", "kind"):
                continue
            if k in _NUMERIC:
                try:
                    out[k] = float(v)
                except (TypeError, ValueError):
                    continue
            else:
                out[k] = v
    for k in ("half_life_days", "window_days", "iters", "min_matches"):
        out[k] = int(round(out[k]))
    return out


def params_for_league(spec: Dict[str, Any], league_id: Any) -> Dict[str, Any]:
    """Bir sürümün belirli lig için etkin parametreleri."""
    p = spec.get("params") or {}
    leagues = p.get("leagues") or {}
    override = leagues.get(str(league_id)) if isinstance(leagues, dict) else None
    return merge_params(p, override)


def _normalize(doc: Dict[str, Any], source: str) -> Optional[Dict[str, Any]]:
    """Site cevabı ({ok, active, shadow}) ya da dosya ({active, shadow}) → iç şema."""
    if not isinstance(doc, dict):
        return None
    active = doc.get("active")
    shadow = doc.get("shadow") or []
    if not isinstance(active, dict) or not active.get("version"):
        return None
    specs: List[Dict[str, Any]] = []
    for s in [active] + [x for x in shadow if isinstance(x, dict) and x.get("version")]:
        kind = s.get("kind") or (s.get("params") or {}).get("kind") or "goals"
        specs.append({"version": str(s["version"]), "kind": "xg" if kind == "xg" else "goals",
                      "params": dict(s.get("params") or {})})
    return {"source": source, "fetched_at": _now(), "active": specs[0], "shadow": specs[1:]}


def _fetch_url(url: str, timeout: float = 6.0) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(url, headers={"User-Agent": "footy-predict/params"})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # nosec - operatör URL'si
        return json.loads(r.read().decode("utf-8"))


def _read_file(path: str) -> Optional[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_cache: Dict[str, Any] = {"at": 0.0, "value": None}


def load_params(force: bool = False, url: Optional[str] = None, path: Optional[str] = None) -> Dict[str, Any]:
    """Aktif + gölge sürüm spesifikasyonları. Asla exception fırlatmaz."""
    url = PARAMS_URL if url is None else url
    path = PARAMS_PATH if path is None else path
    now = time.time()
    if not force and _cache["value"] is not None and now - _cache["at"] < PARAMS_TTL:
        return _cache["value"]

    result = None
    if url:
        try:
            result = _normalize(_fetch_url(url), "url")
        except Exception as e:  # ağ/format hatası → sonraki katman
            print(f"[params] url failed: {e}")
            if _cache["value"] is not None:
                stale = dict(_cache["value"]); stale["source"] = "cache"
                _cache["at"] = now
                return stale
    if result is None and path:
        try:
            result = _normalize(_read_file(path), "file")
        except Exception as e:
            print(f"[params] file failed: {e}")
    if result is None:
        result = env_defaults()

    _cache["at"] = now
    _cache["value"] = result
    return result


def invalidate():
    _cache["at"] = 0.0
    _cache["value"] = None


def all_specs(p: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Aktif önce, sonra gölgeler (yinelenen sürüm adı atlanır)."""
    out, seen = [], set()
    for s in [p["active"]] + list(p.get("shadow") or []):
        if s["version"] in seen:
            continue
        seen.add(s["version"]); out.append(s)
    return out
