# Football match predictions: pre-match probabilities and results

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24216824.svg)](https://doi.org/10.5281/zenodo.24216824)

Every settled prediction of the [Football Analytics](https://footballanalytics.pro) model as flat CSV files: for each finished match in a covered competition, the 1X2 probabilities the model stored before kick-off, its goal expectations, its pick, and the final score.

Nothing is filtered by outcome. The losing picks are in the file next to the winners, so the record can be checked and scored by anyone.

- Canonical source and documentation: <https://footballanalytics.pro/en/data>
- Live track record with calibration: <https://footballanalytics.pro/en/performance>
- How the model works: <https://footballanalytics.pro/en/methodology>
- Licence: [CC BY 4.0](LICENSE)

## Current snapshot

<!-- stats:start -->
<!-- stats:end -->

The files in this repository are refreshed once a day from the canonical source, which itself updates hourly as matches are settled. The commit history goes back to 17 October 2026 and shows each day's additions, so the record can be audited against any earlier date.

## Files

| Path | Contents |
|---|---|
| `data/all.csv` | Every settled match, kick-off order |
| `data/leagues/{slug}.csv` | The same rows, one file per competition |
| `data/summary.json` | Row counts, hit rate and Brier score, overall and per competition |

One row per match, UTF-8, comma-separated, header row.

## Columns

| Column | Meaning |
|---|---|
| `fixture_id` | Match identifier (stable; the trailing number of the match URL). |
| `kickoff_utc` | Kick-off in UTC, ISO 8601. |
| `league` | Competition name. |
| `league_slug` | Competition slug, as used in the file names. |
| `country` | Country or confederation of the competition. |
| `home_team`, `away_team` | Club names. |
| `home_score`, `away_score` | Final goals after 90 minutes plus stoppage time; no extra time. |
| `result` | Final result from the score: `1` home win, `X` draw, `2` away win. |
| `p_home`, `p_draw`, `p_away` | Model probabilities stored before kick-off (0–1). They sum to 1 within rounding. |
| `lambda_home`, `lambda_away` | Model goal expectation for each side (Poisson rate). |
| `pick` | The model's pre-match 1X2 pick (the most likely outcome). |
| `pick_correct` | `1` if the pick matched the result, `0` if not. |
| `model_version` | Version of the model that produced the row. |
| `match_url` | Public match page with the settled verdict. |

## Quick start

Python:

```python
import pandas as pd

df = pd.read_csv("https://raw.githubusercontent.com/OWNER/REPO/main/data/all.csv")
df["brier"] = (
    ((df.result == "1") - df.p_home) ** 2
    + ((df.result == "X") - df.p_draw) ** 2
    + ((df.result == "2") - df.p_away) ** 2
)
print(df.groupby("league").agg(matches=("brier", "size"), brier=("brier", "mean"), hit_rate=("pick_correct", "mean")))
```

R:

```r
df <- read.csv("https://raw.githubusercontent.com/OWNER/REPO/main/data/all.csv")
mean(df$pick_correct, na.rm = TRUE)
```

DuckDB, straight over HTTP:

```sql
SELECT league, count(*) AS matches, avg(pick_correct) AS hit_rate
FROM read_csv_auto('https://raw.githubusercontent.com/OWNER/REPO/main/data/all.csv')
GROUP BY league ORDER BY matches DESC;
```

A calibration check that needs only the standard library is in [`examples/calibration.py`](examples/calibration.py).

## What the data is, and is not

- **Pre-match figures only.** Every probability was written before kick-off and never revised. The match page behind `match_url` shows the same numbers.
- **Settled matches only.** A fixture appears once it has a final score. Postponed or abandoned matches are absent, not marked. Upcoming predictions are not in the file.
- **Covered competitions only.** The model is fitted per competition; matches outside the covered set are not included.
- **Goal expectations are model estimates** from a Dixon-Coles / Poisson attack-and-defence model, not shot-based xG from event data.
- **No bookmaker odds.** The odds are third-party data and are not redistributed here.
- **One official model version per match.** Versions under evaluation are never published.

## Ideas for use

- A benchmark: score your own model on the same fixtures and compare Brier scores.
- Teaching material for probability calibration, proper scoring rules and Poisson goal models.
- Checking how prediction quality varies by competition, by favourite strength or over a season.

## Licence and citation

Published under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). You may copy, redistribute, transform and build on the data for any purpose, including commercially, as long as you credit Football Analytics and link to <https://footballanalytics.pro/data>.

> Football Analytics. Settled model predictions dataset: pre-match 1X2 probabilities and results. https://footballanalytics.pro/data. https://doi.org/10.5281/zenodo.24216824. Licence: CC BY 4.0.

The DOI above always resolves to the latest archived version on Zenodo; each release also has its own DOI for citing a fixed snapshot.

A machine-readable citation is in [`CITATION.cff`](CITATION.cff).

## Corrections

If a score, a team name or a kick-off time looks wrong, open an issue with the `fixture_id`. Corrections are made at the source and reach this repository with the next daily refresh.
