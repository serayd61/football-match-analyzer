#!/usr/bin/env python3
"""Calibration table for the model's picks, standard library only.

Groups matches by the probability the model gave its pick and compares that
probability with how often the pick came in. A calibrated model has the two
columns close to each other.

    python3 examples/calibration.py            # reads data/all.csv
    python3 examples/calibration.py some.csv
"""
import csv
import sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "all.csv"
PROB = {"1": "p_home", "X": "p_draw", "2": "p_away"}
EDGES = [0.0, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70, 1.01]

bins = [[0, 0.0, 0] for _ in EDGES[:-1]]  # matches, summed probability, hits
with path.open(encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row["pick"] not in PROB or row["pick_correct"] == "":
            continue
        p = float(row[PROB[row["pick"]]])
        for i in range(len(bins)):
            if EDGES[i] <= p < EDGES[i + 1]:
                bins[i][0] += 1
                bins[i][1] += p
                bins[i][2] += int(row["pick_correct"])
                break

print(f"{'pick probability':<18}{'matches':>8}{'mean predicted':>16}{'observed':>10}")
for i, (n, total, hits) in enumerate(bins):
    if not n:
        continue
    label = f"{EDGES[i]:.2f} to {min(EDGES[i + 1], 1.0):.2f}"
    print(f"{label:<18}{n:>8}{total / n:>15.1%}{hits / n:>10.1%}")
