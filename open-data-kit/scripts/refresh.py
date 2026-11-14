#!/usr/bin/env python3
"""Refresh the dataset files from footballanalytics.pro.

Downloads the canonical file (https://footballanalytics.pro/data/all.csv),
writes data/all.csv, one file per league under data/leagues/, data/summary.json,
and rewrites the statistics block in README.md.

Standard library only. Run from anywhere:  python3 scripts/refresh.py
The output is deterministic for a given source file, so a scheduled run only
produces a commit when new matches were settled.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from collections import OrderedDict
from pathlib import Path

SOURCE = "https://footballanalytics.pro/data/all.csv"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
README = ROOT / "README.md"
START, END = "<!-- stats:start -->", "<!-- stats:end -->"

COLUMNS = [
    "fixture_id", "kickoff_utc", "league", "league_slug", "country", "home_team", "away_team",
    "home_score", "away_score", "result", "p_home", "p_draw", "p_away", "lambda_home",
    "lambda_away", "pick", "pick_correct", "model_version", "match_url",
]
# A fetch that returns far fewer rows than we already hold is a bad fetch, not news.
MAX_SHRINK = 0.2


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "open-data-refresh/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8")


def parse(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames != COLUMNS:
        raise SystemExit(f"unexpected columns: {reader.fieldnames}")
    rows = list(reader)
    for r in rows:
        if r["result"] not in ("1", "X", "2"):
            raise SystemExit(f"bad result in fixture {r['fixture_id']}")
        total = float(r["p_home"]) + float(r["p_draw"]) + float(r["p_away"])
        if abs(total - 1) > 0.01:
            raise SystemExit(f"probabilities of fixture {r['fixture_id']} sum to {total}")
    return rows


def brier(r: dict[str, str]) -> float:
    return sum(
        ((r["result"] == k) - float(r[p])) ** 2
        for k, p in (("1", "p_home"), ("X", "p_draw"), ("2", "p_away"))
    )


def stats(rows: list[dict[str, str]]) -> dict:
    picked = [r for r in rows if r["pick_correct"] != ""]
    return {
        "matches": len(rows),
        "picks": len(picked),
        "pick_hit_rate": round(sum(int(r["pick_correct"]) for r in picked) / len(picked), 4) if picked else None,
        "home_win_rate": round(sum(r["result"] == "1" for r in rows) / len(rows), 4),
        "brier": round(sum(brier(r) for r in rows) / len(rows), 4),
    }


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:.1f}%"


def stats_block(summary: dict) -> str:
    a = summary["all"]
    lines = [
        START,
        f"**{a['matches']:,} settled matches · {len(summary['leagues'])} competitions · "
        f"{summary['first_kickoff_utc'][:10]} to {summary['last_kickoff_utc'][:10]}**",
        "",
        "| | Value | Reference |",
        "|---|---|---|",
        f"| Pick hit rate (1X2) | {pct(a['pick_hit_rate'])} | always picking the home side: {pct(a['home_win_rate'])} |",
        f"| Brier score (sum over 1/X/2, lower is better) | {a['brier']:.4f} | uniform ⅓ guess: 0.6667 |",
        "",
        "| Competition | Matches | Pick hit rate | Brier | File |",
        "|---|---:|---:|---:|---|",
    ]
    for slug, s in summary["leagues"].items():
        lines.append(
            f"| {s['league']} | {s['matches']} | {pct(s['pick_hit_rate'])} | {s['brier']:.4f} | "
            f"[`{slug}.csv`](data/leagues/{slug}.csv) |"
        )
    lines.append(END)
    return "\n".join(lines)


def main() -> None:
    rows = parse(fetch(SOURCE))
    if not rows:
        raise SystemExit("source returned no rows")

    previous = DATA / "all.csv"
    if previous.exists():
        with previous.open(encoding="utf-8") as f:
            had = sum(1 for _ in f) - 1
        if len(rows) < had * (1 - MAX_SHRINK):
            raise SystemExit(f"source has {len(rows)} rows, repository has {had}: refusing to shrink")

    by_league: "OrderedDict[str, list[dict[str, str]]]" = OrderedDict()
    for r in rows:
        by_league.setdefault(r["league_slug"], []).append(r)

    write_csv(DATA / "all.csv", rows)
    leagues_dir = DATA / "leagues"
    if leagues_dir.exists():
        for old in leagues_dir.glob("*.csv"):
            if old.stem not in by_league:
                old.unlink()
    for slug, part in by_league.items():
        write_csv(leagues_dir / f"{slug}.csv", part)

    summary = {
        "source": SOURCE,
        "license": "CC-BY-4.0",
        "first_kickoff_utc": rows[0]["kickoff_utc"],
        "last_kickoff_utc": rows[-1]["kickoff_utc"],
        "all": stats(rows),
        "leagues": OrderedDict(
            (slug, {"league": part[0]["league"], "country": part[0]["country"], **stats(part)})
            for slug, part in sorted(by_league.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        ),
    }
    (DATA / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    text = README.read_text(encoding="utf-8")
    if START not in text or END not in text:
        raise SystemExit("README.md has no statistics block markers")
    head, rest = text.split(START, 1)
    tail = rest.split(END, 1)[1]
    README.write_text(head + stats_block(summary) + tail, encoding="utf-8")
    print(f"{len(rows)} matches, {len(by_league)} competitions, last kick-off {rows[-1]['kickoff_utc']}", file=sys.stderr)


if __name__ == "__main__":
    main()
