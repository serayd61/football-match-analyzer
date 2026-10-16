"""
intel_agent.py — Maç-önü istihbarat ajanı (Claude API): ÇIPA + İSİMLİ SAPMA + RETROSPEKTİF.

Protokol: .claude/skills/fa-prediction-lab/references/match-analysis.md
  1. Çıpa  = engine_predictions resmi sürüm satırı (p_home/draw/away, λ, Ü2.5, KG). Olduğu gibi `baseline`.
  2. İstihbarat = Claude + sunucu taraflı web araması: sakat/cezalı, rotasyon, ölü maç, seyahat, hava.
     Her faktör isimli, tarihli, kaynaklı. "Form iyi" faktör DEĞİL (yarı-ömür içeriyor).
  3. Sapma = faktör başına ≤ ±0.08 (ezici durumda ≤ ±0.12); toplam normalize. Sınır KODDA uygulanır,
     modelin söylediğine güvenilmez. 1X2 sapmadan, Ü/A-KG λ çarpanından (DC ızgarası) yeniden hesaplanır.
  4. Piyasa oranı sapma gerekçesi OLAMAZ; yalnız edge raporu için prompta ayrı bölümde verilir.
  5. Kayıt: engine_intel (baseline + final yan yana) → settle ile Brier/log-loss karşılaştırması.
     Kapı: ≥50 (tercihen ≥200) sonuçlanmış maçta mean(brierFinal) − mean(brierBaseline) < 0 değilse
     sapma sınırı daraltılır (±0.05) ya da faktör türü yasaklanır. Public site'a LLM metni GİRMEZ.

Kullanım (repo kökü ya da engine/):
    python3 intel_agent.py analyze 5881691 --env ../.env.local            # DRY-RUN: JSON yazdırır, DB'ye yazmaz
    python3 intel_agent.py analyze 5881691 --env ../.env.local --write    # engine_intel'e upsert
    python3 intel_agent.py settle  --env ../.env.local --write            # biten maçları skorla
    python3 intel_agent.py report  --env ../.env.local                    # baseline vs final karne
    python3 intel_agent.py daily   --env ../.env.local --plan             # cron adayları (API çağrısı yok)
    python3 intel_agent.py daily   --env ../.env.local --write            # cron: settle + beyaz liste maçları (≤30 sa)

Env: ANTHROPIC_API_KEY, SUPABASE_URL (ya da NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
     İsteğe bağlı: SITE_MODEL_VERSION (çıpa sürümü), STORE_PATH (FotMob deposu → son maçlar/H2H),
     INTEL_MODEL (varsayılan claude-opus-5-5), INTEL_EFFORT (medium).
Bağımlılık: anthropic (requirements-intel.txt). Geri kalan saf stdlib; testler anthropic olmadan çalışır.
"""
import argparse
import json
import math
import os
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model as M  # noqa: E402  (markets_from_lambdas, RHO)

AGENT_VERSION = "intel-1.0"
# 2026-10-16 karşılaştırma (12 maç): Haiku $0.029/maç, Opus $0.15/maç; 5 ortak maçta 4'ünde aynı isimli faktör.
# Varsayılan Haiku; Opus için --model claude-opus-5-5. Karne model bazında (llm_model) ayrı raporlanır.
DEFAULT_MODEL = os.environ.get("INTEL_MODEL", "claude-haiku-5-5")
DEFAULT_EFFORT = os.environ.get("INTEL_EFFORT", "medium")
DEFAULT_LANG = "tr"

# Sapma sınırları (protokol §3)
SHIFT_CAP = 0.08
SHIFT_CAP_OVERWHELMING = 0.12
LAMBDA_MULT_MIN, LAMBDA_MULT_MAX = 0.85, 1.15          # faktör başına
LAMBDA_TOTAL_MIN, LAMBDA_TOTAL_MAX = 0.75, 1.25        # toplam çarpan
PROB_FLOOR, PROB_CEIL = 0.02, 0.96
MAX_DEVIATIONS = 4

# model-coverage.ts COVERED_IDS ile aynı (kanonik FotMob lig id'leri) — yalnız uyarı için
COVERED_LEAGUE_IDS = {47, 87, 55, 54, 53, 42, 57, 61, 48, 268, 71}

# USD / 1M jeton (claude-api skill tablosu, 2026-10). Web araması: $10 / 1000 arama.
PRICES = {
    "claude-opus-5-5":   {"in": 4.00, "out": 20.00, "cache_read": 0.20, "cache_write": 5.00},
    "claude-sonnet-5-5": {"in": 2.00, "out": 10.00, "cache_read": 0.20, "cache_write": 2.50},
    "claude-haiku-5-5":  {"in": 0.10, "out": 0.50,  "cache_read": 0.01, "cache_write": 0.125},
}
WEB_SEARCH_USD = 0.01

DEVIATION_CATEGORIES = [
    "key_absence",        # kilit oyuncu kesin yok (sakat/ceza)
    "multiple_absences",  # birden çok başlangıç oyuncusu yok
    "rotation",           # ölü maç / fikstür sıkışıklığı nedeniyle rotasyon
    "tactical_mismatch",  # bariz taktik uyumsuzluk (yeni hoca, sistem değişimi)
    "travel_congestion",  # uzun seyahat, 3 günde 2 maç
    "weather_pitch",      # aşırı hava / saha
    "motivation",         # küme/şampiyonluk/kupa önceliği gibi isimli motivasyon
    "other",
]

# Modelin çıktısı: SAPMA ve istihbarat. Nihai olasılığı KOD hesaplar.
OUTPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["deviations", "intel", "confidence", "dataCompleteness", "keyFactors", "narrative", "unverified"],
    "properties": {
        "deviations": {
            "type": "array",   # maxItems structured output'ta desteklenmiyor; sınır apply_deviations'ta
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["factor", "category", "team", "shift", "lambdaMult", "severity", "reason", "source", "asOf"],
                "properties": {
                    "factor": {"type": "string", "description": "Kısa isimli faktör, örn. 'Haaland (CF) hamstring — kesin yok'"},
                    "category": {"type": "string", "enum": DEVIATION_CATEGORIES},
                    "team": {"type": "string", "enum": ["home", "away", "both"]},
                    "shift": {
                        "type": "object", "additionalProperties": False,
                        "required": ["home", "draw", "away"],
                        "properties": {
                            "home": {"type": "number"}, "draw": {"type": "number"}, "away": {"type": "number"},
                        },
                        "description": "1X2 olasılık kaydırması, toplamı 0, bileşen başına ≤ ±0.08 (ezici ≤ ±0.12)",
                    },
                    "lambdaMult": {
                        "type": "object", "additionalProperties": False,
                        "required": ["home", "away"],
                        "properties": {"home": {"type": "number"}, "away": {"type": "number"}},
                        "description": "Beklenen gol çarpanı, 0.85–1.15; etkisi yoksa 1.0",
                    },
                    "severity": {"type": "string", "enum": ["normal", "overwhelming"]},
                    "reason": {"type": "string"},
                    "source": {"type": "string", "description": "URL ya da kaynak adı"},
                    "asOf": {"type": "string", "description": "Bilginin tarihi, ISO 8601"},
                },
            },
        },
        "intel": {
            "type": "object", "additionalProperties": False,
            "required": ["injuries", "lineupNews", "context", "sources"],
            "properties": {
                "injuries": {
                    "type": "array",
                    "items": {
                        "type": "object", "additionalProperties": False,
                        "required": ["team", "player", "status", "source", "asOf"],
                        "properties": {
                            "team": {"type": "string", "enum": ["home", "away"]},
                            "player": {"type": "string"},
                            "status": {"type": "string", "enum": ["out", "doubtful", "suspended", "returning", "unverified"]},
                            "source": {"type": "string"},
                            "asOf": {"type": "string"},
                        },
                    },
                },
                "lineupNews": {"type": "string"},
                "context": {"type": "string", "description": "Motivasyon, fikstür yükü, hoca durumu — isimli ve tarihli"},
                "sources": {"type": "array", "items": {"type": "string"}},
            },
        },
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "dataCompleteness": {"type": "number", "description": "0–1: istihbaratın ne kadarı doğrulanmış kaynaklı"},
        "keyFactors": {"type": "array", "items": {"type": "string"}},
        "narrative": {"type": "string", "description": "3–5 cümle, olasılık dili; garanti yok; 'istatistiksel model' ifadesi"},
        "unverified": {"type": "array", "items": {"type": "string"}, "description": "Bulunamayan/doğrulanamayan alanlar"},
    },
}

SYSTEM_PROMPT = f"""Sen footballanalytics.pro'nun maç-önü istihbarat analistisin. Bir Dixon-Coles istatistiksel modelinin
ürettiği ÇIPA olasılıkları sana verilir. Görevin bu olasılıkları yeniden hesaplamak DEĞİL; modelin GÖREMEDİĞİ,
isimlendirilebilir bilgiyi bulup sınırlı sapmalar olarak raporlamaktır. Nihai olasılığı kod hesaplar.

Kurallar (ihlal edilirse sapma kodda düşürülür):
- Yalnız İSİMLİ faktör: kilit oyuncu kesin yok / ceza / rotasyon (ölü maç, 3 günde 2 maç) / bariz taktik
  uyumsuzluk / aşırı hava / uzun seyahat / isimli motivasyon farkı. Her faktör için oyuncu-kaynak-tarih yaz.
- "Form iyi/kötü", "son 5 maç", "H2H üstünlüğü" FAKTÖR DEĞİLDİR: model 180 günlük yarı-ömürle formu zaten içeriyor;
  bunları sapma olarak yazma (çift sayım). Bağlam olarak anlatıda geçebilir.
- Piyasa oranı sapma gerekçesi OLAMAZ. Oranlar sana yalnız bilgi amaçlı verilir; "piyasa böyle diyor" diye kaydırma yapma.
- Sapma büyüklüğü: faktör başına bileşen ≤ ±{SHIFT_CAP:.2f}; iki kilit eksik gibi ezici durumda severity=overwhelming
  ve ≤ ±{SHIFT_CAP_OVERWHELMING:.2f}. shift toplamı 0 olmalı (bir sonuçtan alıp diğerine ver). En fazla {MAX_DEVIATIONS} sapma.
- Gol etkisi: lambdaMult {LAMBDA_MULT_MIN}–{LAMBDA_MULT_MAX}; forvet eksikliği o takımın λ'sını düşürür, stoper eksikliği
  RAKİBİN λ'sını yükseltir. Etki yoksa 1.0 yaz.
- Sapma YOKSA deviations boş liste olur; bu tamamen kabul edilebilir ve sık görülen doğru cevaptır.
- Sakatlıktan DÖNEN oyuncu (returning) ya da "şüpheli" oyuncu sapma gerekçesi DEĞİLDİR; yalnız intel.injuries'e yaz.
  Sapma için oyuncunun yokluğu KESİN olmalı (kulüp/hoca açıklaması, ceza, ameliyat).
- Web aramasını kadro/sakatlık/rotasyon/hoca haberi için kullan; 72 saat içi birincil kaynak (kulüp, resmi lig,
  büyük spor medyası) tercih. Sosyal medya/ikinci-el kaynakta güveni düşür, asOf yaz. Bulamadığını "unverified"a yaz.
- Dil: narrative kullanıcı dilinde (lang alanı). Olasılık dili kullan ("işaret ediyor", "olabilir"), garanti yok,
  bahis tavsiyesi yok, "yapay zekâ" iddiası yok; "istatistiksel model" de.
- Çıktı yalnız verilen JSON şemasıdır."""


# ---------------------------------------------------------------------------
# Env / Supabase (stdlib)
# ---------------------------------------------------------------------------
def load_env_file(path: str) -> int:
    """KEY=VALUE satırlarını os.environ'a yükler (mevcut değerleri ezmez). Döner: yüklenen anahtar sayısı."""
    n = 0
    if not path or not os.path.exists(path):
        return 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
                n += 1
    return n


def _sb_base() -> Tuple[str, str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY") or ""
    if not url or not key:
        raise SystemExit("SUPABASE_URL (ya da NEXT_PUBLIC_SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY gerekli (--env ile yükle)")
    return url.rstrip("/"), key


def _sb_headers(key: str, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def sb_select(table: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
    base, key = _sb_base()
    url = f"{base}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=_sb_headers(key))
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def sb_upsert(table: str, rows: List[Dict[str, Any]], on_conflict: str) -> int:
    base, key = _sb_base()
    url = f"{base}/rest/v1/{table}?on_conflict={on_conflict}"
    body = json.dumps(rows, default=str).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Supabase {table} upsert HTTP {e.code}: {detail}") from e


def sb_patch(table: str, match: Dict[str, str], patch: Dict[str, Any]) -> int:
    base, key = _sb_base()
    url = f"{base}/rest/v1/{table}?{urllib.parse.urlencode(match)}"
    body = json.dumps(patch, default=str).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH",
                                 headers=_sb_headers(key, {"Prefer": "return=minimal"}))
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


# ---------------------------------------------------------------------------
# Çıpa, piyasa, depo bağlamı
# ---------------------------------------------------------------------------
def official_version() -> str:
    """SITE_MODEL_VERSION → engine_model_versions.status='active' → 'dc-1.0' (official.ts ile aynı sıra)."""
    v = os.environ.get("SITE_MODEL_VERSION")
    if v:
        return v
    try:
        rows = sb_select("engine_model_versions", {"select": "version", "status": "eq.active", "limit": "1"})
        if rows:
            return rows[0]["version"]
    except Exception as e:  # noqa: BLE001
        print(f"  [uyarı] aktif sürüm okunamadı: {e}", file=sys.stderr)
    return "dc-1.0"


ANCHOR_COLS = ("fixture_id,league_id,league_name,home_id,home_name,away_id,away_name,kickoff,"
               "p_home,p_draw,p_away,p_over25,p_btts_yes,lambda_home,lambda_away,pick,confidence,model_version,"
               "settled,home_score,away_score,result")


def fetch_anchor(fixture_id: int, version: str) -> Optional[Dict[str, Any]]:
    rows = sb_select("engine_predictions", {"select": ANCHOR_COLS, "fixture_id": f"eq.{fixture_id}",
                                            "model_version": f"eq.{version}", "limit": "1"})
    return rows[0] if rows else None


def fetch_market(fixture_id: int) -> Optional[Dict[str, Any]]:
    """En güncel oran satırı (closing varsa o). Yalnız edge raporu için; sapma gerekçesi değil."""
    rows = sb_select("prediction_odds", {
        "select": "phase,provider,captured_at,home_odds,draw_odds,away_odds,overround,"
                  "p_home_market,p_draw_market,p_away_market,btts_yes_odds,btts_no_odds,over25_odds,under25_odds",
        "fixture_id": f"eq.{fixture_id}", "order": "captured_at.desc", "limit": "4"})
    if not rows:
        return None
    closing = [r for r in rows if r.get("phase") == "closing"]
    return (closing or rows)[0]


def store_context(anchor: Dict[str, Any], kickoff: datetime, n_last: int = 8) -> Optional[Dict[str, Any]]:
    """FotMob deposu varsa (STORE_PATH) iki takımın kickoff ÖNCESİ son sonuçları + H2H. Yoksa None.
    Sızıntı yok: date < kickoff. Model bunu zaten içeriyor → prompta 'bağlam' diye verilir, faktör değil."""
    try:
        from store import ResultStore, STORE_PATH
    except Exception:  # noqa: BLE001
        return None
    if not os.path.exists(STORE_PATH):
        return None
    try:
        rows = ResultStore().load_for_fit(int(anchor["league_id"]))
    except Exception as e:  # noqa: BLE001
        print(f"  [uyarı] depo okunamadı: {e}", file=sys.stderr)
        return None
    ko = kickoff.replace(tzinfo=None)
    hid, aid = str(anchor["home_id"]), str(anchor["away_id"])

    def last_for(tid: str) -> List[str]:
        out = []
        for m in reversed(rows):
            if m["date"] >= ko:
                continue
            if m["home"] == tid or m["away"] == tid:
                venue = "H" if m["home"] == tid else "A"
                gf, ga = (m["fthg"], m["ftag"]) if venue == "H" else (m["ftag"], m["fthg"])
                res = "W" if gf > ga else ("D" if gf == ga else "L")
                out.append(f"{m['date'].date()} {venue} {gf}-{ga} {res}")
                if len(out) >= n_last:
                    break
        return out

    h2h = []
    for m in reversed(rows):
        if m["date"] >= ko:
            continue
        if {m["home"], m["away"]} == {hid, aid}:
            h2h.append(f"{m['date'].date()} {'home' if m['home'] == hid else 'away'}-venue {m['fthg']}-{m['ftag']}")
            if len(h2h) >= 6:
                break
    return {"home_last": last_for(hid), "away_last": last_for(aid), "h2h": h2h, "note": "lig-içi maçlar, FotMob deposu"}


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
def _f(x: Any, nd: int = 3) -> Optional[float]:
    try:
        return round(float(x), nd)
    except (TypeError, ValueError):
        return None


def baseline_from_anchor(anchor: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "home": _f(anchor["p_home"], 4), "draw": _f(anchor["p_draw"], 4), "away": _f(anchor["p_away"], 4),
        "over25": _f(anchor.get("p_over25"), 4), "btts": _f(anchor.get("p_btts_yes"), 4),
        "lambdaHome": _f(anchor.get("lambda_home"), 3), "lambdaAway": _f(anchor.get("lambda_away"), 3),
        "modelVersion": anchor.get("model_version"),
    }


def build_user_prompt(anchor: Dict[str, Any], market: Optional[Dict[str, Any]], ctx: Optional[Dict[str, Any]],
                      lang: str, now: datetime) -> str:
    b = baseline_from_anchor(anchor)
    ko = anchor.get("kickoff")
    lines = [
        f"lang: {lang}",
        f"now: {now.isoformat(timespec='minutes')}",
        "",
        "## Maç",
        f"fixtureId: {anchor['fixture_id']}",
        f"league: {anchor.get('league_name')} (id {anchor.get('league_id')})",
        f"home: {anchor.get('home_name')} (id {anchor.get('home_id')})",
        f"away: {anchor.get('away_name')} (id {anchor.get('away_id')})",
        f"kickoff: {ko}",
        "",
        "## ÇIPA — istatistiksel model (dokunma, sapma olarak raporla)",
        json.dumps(b, ensure_ascii=False),
    ]
    if ctx:
        lines += ["", "## Bağlam — modelin ZATEN içerdiği sonuçlar (faktör değil, yalnız anlatı için)",
                  f"home_last: {ctx.get('home_last')}", f"away_last: {ctx.get('away_last')}", f"h2h: {ctx.get('h2h')}"]
    if market:
        mk = {k: market.get(k) for k in ("phase", "provider", "captured_at", "home_odds", "draw_odds", "away_odds",
                                        "p_home_market", "p_draw_market", "p_away_market",
                                        "btts_yes_odds", "over25_odds")}
        lines += ["", "## Piyasa — YALNIZ bilgi; sapma gerekçesi OLAMAZ", json.dumps(mk, ensure_ascii=False, default=str)]
    lines += ["", "## Görev",
              "1) Web aramasıyla iki takımın bu maç için kadro/sakatlık/ceza/rotasyon/hoca haberlerini bul (en çok birkaç arama).",
              "2) Yalnız isimli, tarihli, kaynaklı faktörleri sapma olarak yaz; sınırlara uy; yoksa boş bırak.",
              "3) Şemaya uygun JSON üret."]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Claude çağrısı
# ---------------------------------------------------------------------------
def _extract_json(content: List[Any]) -> Dict[str, Any]:
    texts = [b.text for b in content if getattr(b, "type", None) == "text" and getattr(b, "text", "").strip()]
    for t in reversed(texts):
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            continue
    raise ValueError("Yanıtta geçerli JSON metin bloğu yok")


def _collect_sources(content: List[Any]) -> List[Dict[str, str]]:
    out = []
    for b in content:
        if getattr(b, "type", None) != "web_search_tool_result":
            continue
        c = getattr(b, "content", None)
        if not isinstance(c, list):      # hata nesnesi (max_uses_exceeded vb.)
            continue
        for r in c:
            if getattr(r, "type", None) == "web_search_result":
                out.append({"url": getattr(r, "url", ""), "title": getattr(r, "title", ""),
                            "age": getattr(r, "page_age", None) or ""})
    seen, uniq = set(), []
    for s in out:
        if s["url"] and s["url"] not in seen:
            seen.add(s["url"]); uniq.append(s)
    return uniq


def estimate_cost(model_id: str, usage: Dict[str, Any]) -> float:
    p = PRICES.get(model_id)
    if not p:
        return 0.0
    cost = (usage.get("input_tokens", 0) * p["in"] + usage.get("output_tokens", 0) * p["out"]
            + usage.get("cache_read_input_tokens", 0) * p["cache_read"]
            + usage.get("cache_creation_input_tokens", 0) * p["cache_write"]) / 1_000_000
    cost += usage.get("web_search_requests", 0) * WEB_SEARCH_USD
    return round(cost, 5)


def call_claude(user_prompt: str, model_id: str = DEFAULT_MODEL, effort: str = DEFAULT_EFFORT,
                max_searches: int = 4, use_fallbacks: bool = True) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, str]]]:
    """→ (çıktı JSON, usage{tokens, web_search_requests, model, stop_reason, fallback}, kaynaklar).
    Sunucu taraflı web araması + structured output. pause_turn'de aynı mesajlarla devam (≤3)."""
    import anthropic  # geç import: testler/CI anthropic olmadan çalışsın

    client = anthropic.Anthropic()
    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]
    base_kwargs: Dict[str, Any] = dict(
        model=model_id,
        max_tokens=16000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": max_searches}],
    )
    usage_acc = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0,
                 "cache_creation_input_tokens": 0, "web_search_requests": 0, "model": model_id,
                 "effort": effort, "turns": 0, "fallback": False}

    def _create(msgs):
        if use_fallbacks:
            try:
                return client.beta.messages.create(messages=msgs, betas=["server-side-fallback-2026-07-01"],
                                                   fallbacks="default", **base_kwargs)
            except anthropic.BadRequestError as e:
                if "fallback" not in str(e).lower():
                    raise
                print(f"  [uyarı] fallbacks reddedildi, onsuz deneniyor: {e.message}", file=sys.stderr)
        return client.messages.create(messages=msgs, **base_kwargs)

    resp = None
    for _ in range(4):
        resp = _create(messages)
        u = resp.usage
        usage_acc["turns"] += 1
        usage_acc["input_tokens"] += getattr(u, "input_tokens", 0) or 0
        usage_acc["output_tokens"] += getattr(u, "output_tokens", 0) or 0
        usage_acc["cache_read_input_tokens"] += getattr(u, "cache_read_input_tokens", 0) or 0
        usage_acc["cache_creation_input_tokens"] += getattr(u, "cache_creation_input_tokens", 0) or 0
        stu = getattr(u, "server_tool_use", None)
        usage_acc["web_search_requests"] += (getattr(stu, "web_search_requests", 0) or 0) if stu else 0
        if any(getattr(b, "type", None) == "fallback" for b in resp.content):
            usage_acc["fallback"] = True
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        break
    assert resp is not None
    usage_acc["stop_reason"] = resp.stop_reason
    usage_acc["served_by"] = getattr(resp, "model", model_id)
    if resp.stop_reason == "refusal":
        sd = getattr(resp, "stop_details", None)
        raise RuntimeError(f"Model reddetti: {getattr(sd, 'category', None)} — {getattr(sd, 'explanation', '')}")
    if resp.stop_reason == "max_tokens":
        raise RuntimeError("max_tokens'a takıldı; çıktı eksik")
    data = _extract_json(resp.content)
    return data, usage_acc, _collect_sources(resp.content)


# ---------------------------------------------------------------------------
# Sapma uygulama (saf, test edilir)
# ---------------------------------------------------------------------------
def _norm3(p: Dict[str, float]) -> Dict[str, float]:
    s = p["home"] + p["draw"] + p["away"]
    if s <= 0:
        return {"home": 1 / 3, "draw": 1 / 3, "away": 1 / 3}
    return {k: p[k] / s for k in ("home", "draw", "away")}


def apply_deviations(baseline: Dict[str, Any], deviations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Model çıktısındaki sapmaları KURALLARA göre uygula.
    - Faktör sayısı ≤ MAX_DEVIATIONS; shift toplamı 0'a çekilir; bileşen başına cap (normal 0.08 / overwhelming 0.12).
    - Form/H2H kategorisi yok; 'other' kategori yalnız reason doluysa.
    - λ çarpanı faktör başına [0.85,1.15], toplam [0.75,1.25].
    Döner: {probabilities, deviations(uygulanan, kırpılmış), lambdaMult{home,away}, warnings[]}"""
    warnings: List[str] = []
    probs = {"home": float(baseline["home"]), "draw": float(baseline["draw"]), "away": float(baseline["away"])}
    probs = _norm3(probs)
    mult = {"home": 1.0, "away": 1.0}
    applied: List[Dict[str, Any]] = []
    for i, d in enumerate(deviations or []):
        if i >= MAX_DEVIATIONS:
            warnings.append(f"sapma {i + 1} atıldı: sınır {MAX_DEVIATIONS}")
            break
        cat = d.get("category") or "other"
        if cat not in DEVIATION_CATEGORIES:
            warnings.append(f"sapma '{d.get('factor')}' atıldı: bilinmeyen kategori {cat}")
            continue
        if not (d.get("factor") or "").strip() or not (d.get("reason") or "").strip():
            warnings.append("isimsiz/gerekçesiz sapma atıldı")
            continue
        cap = SHIFT_CAP_OVERWHELMING if d.get("severity") == "overwhelming" else SHIFT_CAP
        sh = d.get("shift") or {}
        raw = {k: float(sh.get(k, 0.0) or 0.0) for k in ("home", "draw", "away")}
        mean = sum(raw.values()) / 3.0
        if abs(mean) > 1e-9:
            raw = {k: v - mean for k, v in raw.items()}        # toplamı 0'a çek
            warnings.append(f"'{d.get('factor')}': shift toplamı 0 değildi, merkezlendi")
        clipped = {k: max(-cap, min(cap, v)) for k, v in raw.items()}
        if any(abs(clipped[k] - raw[k]) > 1e-9 for k in clipped):
            warnings.append(f"'{d.get('factor')}': shift ±{cap:.2f} ile kırpıldı")
        lm = d.get("lambdaMult") or {}
        lm_h = max(LAMBDA_MULT_MIN, min(LAMBDA_MULT_MAX, float(lm.get("home", 1.0) or 1.0)))
        lm_a = max(LAMBDA_MULT_MIN, min(LAMBDA_MULT_MAX, float(lm.get("away", 1.0) or 1.0)))
        for k in ("home", "draw", "away"):
            probs[k] += clipped[k]
        mult["home"] *= lm_h
        mult["away"] *= lm_a
        applied.append({**{k: d.get(k) for k in ("factor", "category", "team", "severity", "reason", "source", "asOf")},
                        "shift": {k: round(v, 4) for k, v in clipped.items()},
                        "lambdaMult": {"home": round(lm_h, 3), "away": round(lm_a, 3)}})
    # toplam λ çarpanı sınırı
    for k in ("home", "away"):
        if mult[k] < LAMBDA_TOTAL_MIN or mult[k] > LAMBDA_TOTAL_MAX:
            warnings.append(f"toplam λ çarpanı ({k}) {mult[k]:.3f} → [{LAMBDA_TOTAL_MIN},{LAMBDA_TOTAL_MAX}] ile kırpıldı")
            mult[k] = max(LAMBDA_TOTAL_MIN, min(LAMBDA_TOTAL_MAX, mult[k]))
    probs = {k: max(PROB_FLOOR, min(PROB_CEIL, v)) for k, v in probs.items()}
    probs = {k: round(v, 4) for k, v in _norm3(probs).items()}
    return {"probabilities": probs, "deviations": applied,
            "lambdaMult": {k: round(v, 3) for k, v in mult.items()}, "warnings": warnings}


def goals_block(baseline: Dict[str, Any], mult: Dict[str, float], rho: float = M.RHO) -> Dict[str, Any]:
    """λ çarpanı 1 değilse Ü2.5/KG'yi DC ızgarasından yeniden hesapla; aksi halde çıpa aynen."""
    lh, la = baseline.get("lambdaHome"), baseline.get("lambdaAway")
    adjusted = abs(mult["home"] - 1.0) > 1e-9 or abs(mult["away"] - 1.0) > 1e-9
    if lh is None or la is None or not adjusted:
        return {"lambdaHome": lh, "lambdaAway": la, "over25": baseline.get("over25"), "btts": baseline.get("btts"),
                "adjusted": False}
    lh2 = min(max(lh * mult["home"], 0.05), 6.0)
    la2 = min(max(la * mult["away"], 0.05), 6.0)
    mk = M.markets_from_lambdas(lh2, la2, rho)
    return {"lambdaHome": round(lh2, 3), "lambdaAway": round(la2, 3),
            "over25": round(mk["p_over25"], 4), "btts": round(mk["p_btts_yes"], 4), "adjusted": True}


# ---------------------------------------------------------------------------
# Skorlama (settle) — engine scoring.ts ile aynı tanımlar
# ---------------------------------------------------------------------------
def outcome_vec(home_score: int, away_score: int) -> Dict[str, int]:
    if home_score > away_score:
        return {"home": 1, "draw": 0, "away": 0}
    if home_score == away_score:
        return {"home": 0, "draw": 1, "away": 0}
    return {"home": 0, "draw": 0, "away": 1}


def brier3(p: Dict[str, float], y: Dict[str, int]) -> float:
    return sum((float(p[k]) - y[k]) ** 2 for k in ("home", "draw", "away"))


def logloss3(p: Dict[str, float], y: Dict[str, int]) -> float:
    eps = 1e-6
    k = next(k for k, v in y.items() if v == 1)
    return -math.log(max(eps, min(1 - eps, float(p[k]))))


def brier_bin(p: Optional[float], y: int) -> Optional[float]:
    return None if p is None else (float(p) - y) ** 2


def argmax3(p: Dict[str, float]) -> str:
    return max(("home", "draw", "away"), key=lambda k: float(p[k]))


def paired_bootstrap_ci(diffs: List[float], n_boot: int = 2000, seed: int = 7) -> Tuple[float, float]:
    rng = random.Random(seed)
    n = len(diffs)
    if n == 0:
        return (float("nan"), float("nan"))
    means = []
    for _ in range(n_boot):
        s = sum(diffs[rng.randrange(n)] for _ in range(n))
        means.append(s / n)
    means.sort()
    return (means[int(0.025 * n_boot)], means[int(0.975 * n_boot) - 1])


# ---------------------------------------------------------------------------
# Komutlar
# ---------------------------------------------------------------------------
def analyze(fixture_id: int, write: bool, model_id: str, effort: str, lang: str, max_searches: int,
            force: bool, version: Optional[str], use_fallbacks: bool,
            agent_version: str = AGENT_VERSION) -> Dict[str, Any]:
    """agent_version: aynı maçta farklı model/efor karşılaştırması için ayrı satır (örn. intel-1.0-haiku)."""
    version = version or official_version()
    anchor = fetch_anchor(fixture_id, version)
    if not anchor:
        raise SystemExit(f"engine_predictions'ta fixture {fixture_id} / sürüm {version} yok → çıpa olmadan analiz yapılmaz")
    now = datetime.now(timezone.utc)
    kickoff = datetime.fromisoformat(str(anchor["kickoff"]).replace("Z", "+00:00"))
    issued_after = now >= kickoff
    if issued_after and not force:
        raise SystemExit(f"kickoff geçmiş ({kickoff.isoformat()}); karneye girmez. Yine de üretmek için --force")
    if anchor.get("league_id") not in COVERED_LEAGUE_IDS:
        print(f"  [uyarı] lig {anchor.get('league_id')} ({anchor.get('league_name')}) kapsam listesinde değil; "
              f"analiz üretilir ama karne yorumunda ayrı tut", file=sys.stderr)

    market = None
    try:
        market = fetch_market(fixture_id)
    except Exception as e:  # noqa: BLE001
        print(f"  [uyarı] oran okunamadı: {e}", file=sys.stderr)
    ctx = store_context(anchor, kickoff)
    baseline = baseline_from_anchor(anchor)
    prompt = build_user_prompt(anchor, market, ctx, lang, now)

    print(f"→ {anchor['home_name']} – {anchor['away_name']} | {anchor['league_name']} | {anchor['kickoff']} | çıpa {version}")
    print(f"  çıpa 1X2 {baseline['home']:.3f}/{baseline['draw']:.3f}/{baseline['away']:.3f}  Ü2.5 {baseline['over25']}  KG {baseline['btts']}")
    print(f"  model {model_id} effort {effort} web_search≤{max_searches} …")
    out, usage, sources = call_claude(prompt, model_id=model_id, effort=effort, max_searches=max_searches,
                                      use_fallbacks=use_fallbacks)
    usage["cost_usd"] = estimate_cost(model_id, usage)

    applied = apply_deviations(baseline, out.get("deviations") or [])
    goals = goals_block(baseline, applied["lambdaMult"])
    final = applied["probabilities"]
    pick = {"home": "1", "draw": "X", "away": "2"}[argmax3(final)]
    analysis = {
        "fixtureId": fixture_id,
        "agentVersion": agent_version,
        "modelVersion": version,
        "baseline": baseline,
        "deviations": applied["deviations"],
        "probabilities": final,
        "goals": goals,
        "pick": pick,
        "confidence": out.get("confidence"),
        "dataCompleteness": _f(out.get("dataCompleteness"), 2),
        "keyFactors": out.get("keyFactors") or [],
        "narrative": out.get("narrative") or "",
        "intel": out.get("intel") or {},
        "unverified": out.get("unverified") or [],
        "sources": sources,
        "warnings": applied["warnings"],
        "usage": usage,
        "issuedAfterKickoff": issued_after,
        "analyzedAt": now.isoformat(),
        "lang": lang,
    }
    print(f"  final 1X2 {final['home']:.3f}/{final['draw']:.3f}/{final['away']:.3f}  pick {pick}  "
          f"sapma {len(applied['deviations'])}  Ü2.5 {goals['over25']}  KG {goals['btts']}  "
          f"maliyet ~${usage['cost_usd']:.4f} ({usage['input_tokens']}+{usage['output_tokens']} jeton, "
          f"{usage['web_search_requests']} arama)")
    for w in applied["warnings"]:
        print(f"  [kural] {w}")

    if write:
        row = {
            "fixture_id": fixture_id, "agent_version": agent_version, "model_version": version,
            "league_id": anchor.get("league_id"), "league_name": anchor.get("league_name"),
            "home_id": anchor.get("home_id"), "home_name": anchor.get("home_name"),
            "away_id": anchor.get("away_id"), "away_name": anchor.get("away_name"),
            "kickoff": anchor.get("kickoff"),
            "baseline": baseline, "deviations": applied["deviations"], "final": final, "goals": goals,
            "pick": pick, "confidence": analysis["confidence"], "data_completeness": analysis["dataCompleteness"],
            "key_factors": analysis["keyFactors"], "narrative": analysis["narrative"], "lang": lang,
            "intel": analysis["intel"], "unverified": analysis["unverified"], "sources": sources,
            "warnings": applied["warnings"], "usage": usage, "cost_usd": usage["cost_usd"],
            "llm_model": usage.get("served_by") or model_id,
            "issued_after_kickoff": issued_after, "analyzed_at": now.isoformat(),
        }
        sb_upsert("engine_intel", [row], on_conflict="fixture_id,agent_version")
        print(f"  ✅ engine_intel yazıldı (fixture {fixture_id}, {agent_version})")
    else:
        print("  (dry-run: DB'ye yazılmadı; --write ile yaz)")
    return analysis


def settle(write: bool, grace_hours: float = 2.5) -> List[Dict[str, Any]]:
    """engine_intel.settled=false ve kickoff geçmiş satırları engine_predictions sonucuyla skorla."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=grace_hours)).isoformat()
    rows = sb_select("engine_intel", {"select": "fixture_id,agent_version,model_version,baseline,final,goals",
                                      "settled": "eq.false", "kickoff": f"lt.{cutoff}", "limit": "500"})
    done = []
    for r in rows:
        preds = sb_select("engine_predictions", {"select": "settled,home_score,away_score,result",
                                                 "fixture_id": f"eq.{r['fixture_id']}",
                                                 "model_version": f"eq.{r['model_version']}", "limit": "1"})
        p = preds[0] if preds else None
        if not p or not p.get("settled") or p.get("home_score") is None or p.get("away_score") is None:
            continue
        hs, as_ = int(p["home_score"]), int(p["away_score"])
        y = outcome_vec(hs, as_)
        b, f = r["baseline"], r["final"]
        g = r.get("goals") or {}
        over_y = 1 if hs + as_ >= 3 else 0
        btts_y = 1 if hs >= 1 and as_ >= 1 else 0
        patch = {
            "settled": True, "settled_at": datetime.now(timezone.utc).isoformat(),
            "home_score": hs, "away_score": as_, "result": {"home": "H", "draw": "D", "away": "A"}[argmax3(y)],
            "brier_baseline": round(brier3(b, y), 5), "brier_final": round(brier3(f, y), 5),
            "ll_baseline": round(logloss3(b, y), 5), "ll_final": round(logloss3(f, y), 5),
            "brier_ou25_baseline": brier_bin(b.get("over25"), over_y),
            "brier_ou25_final": brier_bin(g.get("over25"), over_y),
            "brier_btts_baseline": brier_bin(b.get("btts"), btts_y),
            "brier_btts_final": brier_bin(g.get("btts"), btts_y),
            "grade": "correct" if argmax3(f) == argmax3(y) else ("partial" if argmax3(b) == argmax3(y) else "wrong"),
        }
        done.append({"fixture_id": r["fixture_id"], **patch})
        if write:
            sb_patch("engine_intel", {"fixture_id": f"eq.{r['fixture_id']}", "agent_version": f"eq.{r['agent_version']}"}, patch)
    print(f"settle: {len(rows)} bekleyen, {len(done)} skorlandı{' (yazıldı)' if write else ' (dry-run)'}")
    for d in done[:20]:
        print(f"  {d['fixture_id']}: {d['home_score']}-{d['away_score']} brier {d['brier_baseline']:.3f}→{d['brier_final']:.3f} {d['grade']}")
    return done


# ---------------------------------------------------------------------------
# Günlük cron (adım 2, 2026-10-16): beyaz liste maçlarını ~24 sa önceden analiz et
# ---------------------------------------------------------------------------
# Zamanlama gerekçesi (kullanıcı kararı 2026-10-16): n8n tahminleri 06:00 UTC'de yazar,
# beyaz liste maçları o anda bellidir ve kullanıcı sabahtan itibaren sayfaya bakar.
# Kickoff'a 6 sa kala çalışmak kartı günün büyük kısmında boş bırakır. Kaynak tarihi
# (asOf) kartta göründüğü için 24 sa öncesinin bayatlayabileceği kullanıcıya açıktır.
# Maç günü ikinci tur (−3 sa) retrospektifler gerek gösterirse eklenir.
DAILY_HOURS_AHEAD = 30.0      # kickoff ≤ now + 30 sa (ertesi günün tüm maçları)
DAILY_MIN_LEAD_H = 2.0        # kickoff ≥ now + 2 sa (çok yakın maçı atla; kickoff-sonrası üretim olmasın)
DAILY_BUDGET_USD = 3.0        # bir turda harcanacak tavan (Haiku ~$0.03/maç → ~100 maç)
DAILY_MAX_FIXTURES = 40
DAILY_STATUSES = ("whitelist",)


def coverage_league_ids(statuses=DAILY_STATUSES) -> set:
    """league_coverage: beyaz liste (ve istenirse observe) lig id'leri. Sezonluk id'ler de tabloda."""
    rows = sb_select("league_coverage", {"select": "league_id,status", "status": f"in.({','.join(statuses)})", "limit": "1000"})
    return {int(r["league_id"]) for r in rows if r.get("league_id") is not None}


def plan_daily(candidates: List[Dict[str, Any]], existing: set, league_ids: set, now: datetime,
               min_lead_h: float = DAILY_MIN_LEAD_H, hours_ahead: float = DAILY_HOURS_AHEAD) -> List[Dict[str, Any]]:
    """Saf: aday satırlar → analiz edilecekler (pencere içinde, ligi listede, daha önce analiz edilmemiş), kickoff sırasıyla."""
    lo = now + timedelta(hours=min_lead_h)
    hi = now + timedelta(hours=hours_ahead)
    out = []
    seen = set()
    for c in candidates:
        fid = c.get("fixture_id")
        if fid is None or fid in seen or fid in existing:
            continue
        try:
            ko = datetime.fromisoformat(str(c["kickoff"]).replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        if not (lo <= ko <= hi):
            continue
        if c.get("league_id") not in league_ids:
            continue
        seen.add(fid)
        out.append({**c, "kickoff_dt": ko})
    out.sort(key=lambda x: x["kickoff_dt"])
    return out


def daily(write: bool, plan_only: bool, model_id: str, effort: str, lang: str, max_searches: int,
          agent_version: str, statuses=DAILY_STATUSES, hours_ahead: float = DAILY_HOURS_AHEAD,
          min_lead_h: float = DAILY_MIN_LEAD_H, budget_usd: float = DAILY_BUDGET_USD,
          max_fixtures: int = DAILY_MAX_FIXTURES, do_settle: bool = True, use_fallbacks: bool = True) -> Dict[str, Any]:
    """Cron gövdesi: (1) dünkü maçları skorla, (2) beyaz liste maçlarını analiz et. Hata bir maçı atlar, turu durdurmaz."""
    now = datetime.now(timezone.utc)
    print(f"daily {now.isoformat(timespec='minutes')} agent={agent_version} model={model_id} statuses={','.join(statuses)} "
          f"pencere +{min_lead_h:g}…+{hours_ahead:g} sa bütçe ${budget_usd:.2f}")
    summary: Dict[str, Any] = {"planned": 0, "done": 0, "failed": 0, "skipped_budget": 0, "cost_usd": 0.0, "settled": 0, "fixtures": []}
    if do_settle and not plan_only:
        try:
            summary["settled"] = len(settle(write))
        except Exception as e:  # noqa: BLE001
            print(f"  [uyarı] settle başarısız: {e}", file=sys.stderr)

    version = official_version()
    league_ids = coverage_league_ids(statuses)
    hi = (now + timedelta(hours=hours_ahead)).isoformat()
    lo = (now + timedelta(hours=min_lead_h)).isoformat()
    if not league_ids:
        print("  [uyarı] league_coverage'da seçilen durumda lig yok; tur boş", file=sys.stderr)
        return summary
    # Lig filtresi SORGUDA: cumartesi 30 saatte 500'den çok maç olabiliyor (2026-10-16 plan: limit doldu);
    # sıralı kesme pencerenin sonundaki beyaz liste maçlarını düşürürdü.
    cands = sb_select("engine_predictions", {
        "select": "fixture_id,league_id,league_name,home_name,away_name,kickoff",
        "model_version": f"eq.{version}", "kickoff": f"gte.{lo}", "and": f"(kickoff.lte.{hi})",
        "league_id": f"in.({','.join(str(i) for i in sorted(league_ids))})",
        "order": "kickoff.asc", "limit": "1000"})
    ids = sorted({c["fixture_id"] for c in cands})
    existing: set = set()
    if ids:
        ex = sb_select("engine_intel", {"select": "fixture_id", "agent_version": f"eq.{agent_version}",
                                        "fixture_id": f"in.({','.join(str(i) for i in ids)})", "limit": "1000"})
        existing = {r["fixture_id"] for r in ex}
    plan = plan_daily(cands, existing, league_ids, now, min_lead_h, hours_ahead)
    summary["planned"] = len(plan)
    print(f"  aday {len(cands)} → lig/pencere/yeni filtresi → {len(plan)} maç (mevcut {len(existing & {c['fixture_id'] for c in cands})} atlandı)")
    for c in plan[:max_fixtures]:
        print(f"   - {c['fixture_id']} {c['league_name']} | {c['home_name']} – {c['away_name']} | {c['kickoff']}")
    if len(plan) > max_fixtures:
        print(f"   … {len(plan) - max_fixtures} maç max_fixtures sınırı dışında")
    if plan_only:
        return summary

    for c in plan[:max_fixtures]:
        if summary["cost_usd"] >= budget_usd:
            summary["skipped_budget"] += 1
            continue
        try:
            res = analyze(c["fixture_id"], write, model_id, effort, lang, max_searches, False, version, use_fallbacks, agent_version)
            summary["done"] += 1
            summary["cost_usd"] += float(res["usage"].get("cost_usd") or 0)
            summary["fixtures"].append({"fixture_id": c["fixture_id"], "deviations": len(res["deviations"]), "cost": res["usage"].get("cost_usd")})
        except SystemExit as e:        # çıpa yok / kickoff geçti gibi beklenen atlamalar
            summary["failed"] += 1
            print(f"  [atlandı] {c['fixture_id']}: {e}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            summary["failed"] += 1
            print(f"  [hata] {c['fixture_id']}: {type(e).__name__}: {e}", file=sys.stderr)
    print(f"daily özet: planlanan {summary['planned']}, analiz {summary['done']}, hata {summary['failed']}, "
          f"bütçe-atlama {summary['skipped_budget']}, maliyet ${summary['cost_usd']:.3f}, skorlanan {summary['settled']}")
    return summary


def report(min_n: int = 50, agent_version: Optional[str] = None, llm_model: Optional[str] = None) -> Dict[str, Any]:
    """Sonuçlanmış engine_intel satırlarında baseline vs final: ΔBrier, ΔLL, eşleştirilmiş bootstrap %95.
    Filtre yoksa önce (agent_version, llm_model) grup başına özet, sonra toplam — modeller karıştırılmaz."""
    params = {
        "select": "fixture_id,agent_version,llm_model,brier_baseline,brier_final,ll_baseline,ll_final,"
                  "brier_ou25_baseline,brier_ou25_final,brier_btts_baseline,brier_btts_final,deviations,"
                  "issued_after_kickoff,grade",
        "settled": "eq.true", "issued_after_kickoff": "eq.false", "limit": "5000"}
    if agent_version:
        params["agent_version"] = f"eq.{agent_version}"
    if llm_model:
        params["llm_model"] = f"eq.{llm_model}"
    rows = sb_select("engine_intel", params)
    groups = sorted({(r.get("agent_version"), r.get("llm_model")) for r in rows})
    if len(groups) > 1:
        for av, lm in groups:
            sub = [r for r in rows if (r.get("agent_version"), r.get("llm_model")) == (av, lm)]
            print(f"--- {av} / {lm}")
            _report_rows(sub, min_n)
        print("--- TOPLAM (karışık modeller, yalnız bilgi)")
    return _report_rows(rows, min_n)


def _report_rows(rows: List[Dict[str, Any]], min_n: int) -> Dict[str, Any]:
    n = len(rows)
    out: Dict[str, Any] = {"n": n, "min_n": min_n}
    if n == 0:
        print("report: sonuçlanmış analiz yok")
        return out
    d_brier = [float(r["brier_final"]) - float(r["brier_baseline"]) for r in rows]
    d_ll = [float(r["ll_final"]) - float(r["ll_baseline"]) for r in rows]
    with_dev = [r for r in rows if (r.get("deviations") or [])]
    out.update({
        "mean_brier_baseline": sum(float(r["brier_baseline"]) for r in rows) / n,
        "mean_brier_final": sum(float(r["brier_final"]) for r in rows) / n,
        "delta_brier": sum(d_brier) / n, "delta_brier_ci95": paired_bootstrap_ci(d_brier),
        "delta_ll": sum(d_ll) / n, "delta_ll_ci95": paired_bootstrap_ci(d_ll),
        "n_with_deviation": len(with_dev),
        "accuracy_final": sum(1 for r in rows if r.get("grade") == "correct") / n,
    })
    for mk in ("ou25", "btts"):
        pairs = [(float(r[f"brier_{mk}_baseline"]), float(r[f"brier_{mk}_final"])) for r in rows
                 if r.get(f"brier_{mk}_baseline") is not None and r.get(f"brier_{mk}_final") is not None]
        if pairs:
            out[f"delta_brier_{mk}"] = sum(b - a for a, b in pairs) / len(pairs)
            out[f"n_{mk}"] = len(pairs)
    print(f"report: n={n} (sapmalı {len(with_dev)}), isabet(final) {out['accuracy_final']*100:.1f}%")
    print(f"  Brier  baseline {out['mean_brier_baseline']:.4f} → final {out['mean_brier_final']:.4f} | Δ {out['delta_brier']:+.4f} "
          f"[{out['delta_brier_ci95'][0]:+.4f}, {out['delta_brier_ci95'][1]:+.4f}]")
    print(f"  LL     Δ {out['delta_ll']:+.4f} [{out['delta_ll_ci95'][0]:+.4f}, {out['delta_ll_ci95'][1]:+.4f}]")
    for mk in ("ou25", "btts"):
        if f"delta_brier_{mk}" in out:
            print(f"  {mk:5s} ΔBrier {out[f'delta_brier_{mk}']:+.4f} (n={out[f'n_{mk}']})")
    if n < min_n:
        print(f"  ⚠️ n < {min_n}: yorum yapma, veri biriksin.")
    else:
        verdict = "LLM katmanı Brier'i düşürüyor (negatif Δ)" if out["delta_brier"] < 0 else \
                  "LLM katmanı Brier'i DÜŞÜRMÜYOR → sapma sınırını ±0.05'e çek ya da faktör türünü yasakla"
        print(f"  Kapı: {verdict}")
    return out


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default="", help=".env.local gibi KEY=VALUE dosyası (mevcut env'i ezmez)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze", help="tek maç: çıpa → istihbarat → sapma → (opsiyonel) engine_intel")
    a.add_argument("fixture_id", type=int)
    a.add_argument("--write", action="store_true", help="engine_intel'e upsert (varsayılan dry-run)")
    a.add_argument("--model", default=DEFAULT_MODEL)
    a.add_argument("--effort", default=DEFAULT_EFFORT, choices=["low", "medium", "high", "xhigh", "max"])
    a.add_argument("--lang", default=DEFAULT_LANG, choices=["tr", "en", "de", "it"])
    a.add_argument("--max-searches", type=int, default=3)
    a.add_argument("--version", default=None, help="çıpa model_version (varsayılan resmi sürüm)")
    a.add_argument("--force", action="store_true", help="kickoff geçmişse de üret (karneye girmez)")
    a.add_argument("--no-fallbacks", action="store_true", help="sunucu taraflı refusal fallback'ini kapat")
    a.add_argument("--agent-version", default=AGENT_VERSION, help="engine_intel.agent_version (model karşılaştırması için ayrı etiket)")
    a.add_argument("--json", action="store_true", help="tam analiz JSON'unu stdout'a bas")
    s = sub.add_parser("settle", help="biten maçları engine_predictions sonucuyla skorla")
    s.add_argument("--write", action="store_true")
    d = sub.add_parser("daily", help="cron: settle + beyaz liste maçlarını ~24 sa önceden analiz et")
    d.add_argument("--write", action="store_true", help="engine_intel'e yaz (varsayılan dry-run: API çağrılır, yazılmaz)")
    d.add_argument("--plan", action="store_true", help="yalnız adayları listele; API çağrısı ve yazım yok")
    d.add_argument("--model", default=DEFAULT_MODEL)
    d.add_argument("--effort", default=DEFAULT_EFFORT, choices=["low", "medium", "high", "xhigh", "max"])
    d.add_argument("--lang", default=DEFAULT_LANG, choices=["tr", "en", "de", "it"])
    d.add_argument("--max-searches", type=int, default=3)
    d.add_argument("--agent-version", default=AGENT_VERSION)
    d.add_argument("--statuses", default=",".join(DAILY_STATUSES), help="league_coverage durumları, virgülle (whitelist[,observe])")
    d.add_argument("--hours-ahead", type=float, default=DAILY_HOURS_AHEAD)
    d.add_argument("--min-lead", type=float, default=DAILY_MIN_LEAD_H)
    d.add_argument("--budget-usd", type=float, default=DAILY_BUDGET_USD)
    d.add_argument("--max-fixtures", type=int, default=DAILY_MAX_FIXTURES)
    d.add_argument("--no-settle", action="store_true")
    d.add_argument("--no-fallbacks", action="store_true")
    r = sub.add_parser("report", help="baseline vs final karne")
    r.add_argument("--min-n", type=int, default=50)
    r.add_argument("--agent-version", default=None)
    r.add_argument("--llm-model", default=None)
    args = ap.parse_args(argv)
    if args.env:
        load_env_file(args.env)

    if args.cmd == "analyze":
        res = analyze(args.fixture_id, args.write, args.model, args.effort, args.lang, args.max_searches,
                      args.force, args.version, not args.no_fallbacks, args.agent_version)
        if args.json:
            print(json.dumps(res, ensure_ascii=False, indent=2, default=str))
    elif args.cmd == "settle":
        settle(args.write)
    elif args.cmd == "daily":
        res = daily(args.write, args.plan, args.model, args.effort, args.lang, args.max_searches, args.agent_version,
                    tuple(x.strip() for x in args.statuses.split(",") if x.strip()), args.hours_ahead, args.min_lead,
                    args.budget_usd, args.max_fixtures, not args.no_settle, not args.no_fallbacks)
        if not args.plan and res["planned"] > 0 and res["done"] == 0:
            return 1
    elif args.cmd == "report":
        report(args.min_n, args.agent_version, args.llm_model)
    return 0


if __name__ == "__main__":
    sys.exit(main())
