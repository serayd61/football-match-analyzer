---
license: cc-by-4.0
pretty_name: Football match predictions — pre-match probabilities and results
language:
  - en
task_categories:
  - tabular-classification
tags:
  - football
  - soccer
  - sports
  - forecasting
  - calibration
  - probabilistic-forecasting
size_categories:
  - 1K<n<10K
configs:
  - config_name: default
    data_files:
      - split: train
        path: data/all.csv
---

# Football match predictions: pre-match probabilities and results

Every settled prediction of the [Football Analytics](https://footballanalytics.pro) model: for each finished match in a covered competition, the 1X2 probabilities the model stored before kick-off, its goal expectations, its pick, and the final score. Nothing is filtered by outcome.

- Canonical source and documentation: <https://footballanalytics.pro/en/data>
- Live track record with calibration: <https://footballanalytics.pro/en/performance>
- Daily-refreshed mirror with per-competition files: <GITHUB_URL>

## Load

```python
from datasets import load_dataset

ds = load_dataset("HF_OWNER/HF_REPO", split="train")
df = ds.to_pandas()
```

## Columns

| Column | Meaning |
|---|---|
| `fixture_id` | Match identifier. |
| `kickoff_utc` | Kick-off in UTC, ISO 8601. |
| `league`, `league_slug`, `country` | Competition name, slug and country. |
| `home_team`, `away_team` | Club names. |
| `home_score`, `away_score` | Final goals after 90 minutes plus stoppage time. |
| `result` | `1` home win, `X` draw, `2` away win. |
| `p_home`, `p_draw`, `p_away` | Model probabilities stored before kick-off (0–1). |
| `lambda_home`, `lambda_away` | Model goal expectation for each side (Poisson rate). |
| `pick`, `pick_correct` | The model's pre-match 1X2 pick, and whether it came in (1/0). |
| `model_version` | Version of the model that produced the row. |
| `match_url` | Public match page with the settled verdict. |

## Intended use

A benchmark for match-outcome models (score your own forecasts on the same fixtures), teaching material for calibration and proper scoring rules, and analysis of how forecast quality varies by competition.

## Limitations

- Settled matches only; upcoming predictions are not included.
- Covered competitions only; the model is fitted per competition.
- Goal expectations are Dixon-Coles / Poisson model estimates, not shot-based xG.
- No bookmaker odds are included.
- The probabilities are a statistical model's output, not betting advice.

## Licence and citation

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit Football Analytics and link to <https://footballanalytics.pro/data>.

> Football Analytics. Settled model predictions dataset: pre-match 1X2 probabilities and results. https://footballanalytics.pro/data. Licence: CC BY 4.0.
