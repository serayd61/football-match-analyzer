---
name: football-match-forecasting
description: >-
  Methodology for forecasting football/soccer match outcomes (1X2 win/draw/loss,
  scorelines, over/under) the way the WorldCupAI pipeline does it: gather data from
  many structured sports sources, fill the gaps national-team APIs miss with open
  web search, build a calibrated Elo + per-team attack/defense ensemble baseline,
  then let an LLM adjust that baseline ONLY with specific named intel, and finally
  verify and self-learn against real results. Use this skill whenever the user wants
  to predict or forecast a football/soccer match, build or improve a sports
  prediction/betting model, set up an Elo/Poisson/Dixon-Coles model, calibrate match
  probabilities, decide how to weight a model against the market, gather pre-match
  intel (form/injuries/lineups/tactics), or evaluate whether an AI's match calls beat
  a quant baseline — even if they don't name "WorldCupAI" or "Elo" explicitly.
---

# Football Match Forecasting

A disciplined, data-first pipeline for predicting football matches. It exists because
the naive approaches fail in predictable ways: a single Elo number under-rates clear
favorites and ignores team style; structured sports APIs are full of holes for national
teams; and an LLM left to "just predict" invents probabilities that are noise dressed as
insight. This method fixes each of those with a specific, verifiable technique.

The core philosophy: **a calibrated quantitative model is the objective anchor; the LLM
only earns its keep by adding the non-quantifiable intel the model can't see; and every
claim is settled by real results, not opinion.**

## The four stages

Apply them in order. Each stage has a dedicated reference — read it when you reach that
stage rather than loading everything up front.

1. **Collect data + fill gaps** → `references/data-collection.md`
2. **Build the calibrated quant baseline** → `references/quant-and-calibration.md`
3. **AI analysis: anchor + named deviation** → `references/ai-analysis-and-learning.md`
4. **Verify + self-learn** → `references/ai-analysis-and-learning.md`

## Stage 1 — Collect data, then fill the gaps like a sharp analyst

Pull what the structured sources give you: team strength ratings (Elo), recent
form (goals for/against), xG, lineups/injuries, market odds, weather, fixtures.

The trap: **structured sports APIs cover top club leagues well but are sparse for national
teams** — especially African/Asian/smaller federations. You'll see `unknown_default`
ratings, empty xG, missing lineups. Do NOT proceed on that thin data and do NOT silently
treat a default rating as real.

Instead, do what a smart human (or Grok) does: **open web search**. The intel exists in
news/media (ESPN, Sky, Sofascore, SportsMole, beat reporters) even when the APIs don't
carry it. Run a web search with the LLM's search tool and specifically gather, for BOTH
teams: recent form & results, relative strength / FIFA ranking, predicted lineups +
injuries + suspensions, tactical style + expected scoring tendency, and head-to-head.
Feed this back into the pipeline as first-class data, not a footnote. Details and the
search-prompt template are in `references/data-collection.md`.

## Stage 2 — Build a calibrated quant baseline (this is the anchor, get it right)

Two model components, ensembled:

- **Elo → Poisson/Dixon-Coles**: map the rating gap to expected goals, then a score grid.
  Crucial calibration finding: the default "0.32 goals per 100 Elo" **under-rates favorites**.
  Calibrate the coefficient against real historical results (we found ~0.45, total-goals
  base ~2.5) by minimizing log-loss/Brier — let the data pick it, never your gut.
- **Per-team attack/defense ratings (Dixon-Coles style)**: each team gets an attack and a
  defense rating fit from its actual goals-for/against history (opponent-adjusted). This
  captures team *style* (defensive sides → more draws/upsets) that a single Elo scalar
  structurally cannot, and gives a real strength estimate even when Elo is missing.

Ensemble the two by **averaging their 1X2 probabilities** — validated to beat either alone,
especially on the hard tail (upsets and draws). The whole point of calibration is that when
your model says 40%, the thing happens ~40% of the time; verify this with a reliability
check, not vibes. `scripts/calibrate_backtest.py` and `scripts/build_team_ratings.py` do
the calibration and rating-fit from a results CSV — use them rather than re-deriving by
hand. Full detail: `references/quant-and-calibration.md`.

## Stage 3 — AI analysis: anchor to the baseline, deviate only with named intel

This is where most "AI prediction" goes wrong. The rule:

- The calibrated ensemble probability is the **starting point**. The LLM does NOT invent its
  own probabilities from scratch.
- It may **deviate only when it has specific, nameable information** the baseline doesn't
  contain (confirmed lineup missing a key player, suspension, dead-rubber rotation, a stark
  tactical mismatch, extreme weather). Every deviation must state the factor, direction,
  magnitude, and reason. No specific intel → output the baseline unchanged. No vibes-nudging.
- Keep single-factor moves bounded (≈ ±0.08 unless overwhelming).
- Probabilities stay **independent of the market price** — the market is for sizing/edge
  *after* you have a probability, never an input to it (otherwise you're just echoing the
  crowd and the AI adds nothing).

Why this works: it forces the AI's contribution to be *legible* and *falsifiable* instead
of a black-box number. See `references/ai-analysis-and-learning.md`.

## Stage 4 — Verify and self-learn (settle everything with real results)

- **Quant check**: after matches settle, compare the AI's final probabilities vs the pure
  baseline using Brier/log-loss. This answers, with data, the only question that matters:
  *do the AI's deviations actually beat the baseline?* If not, trust the baseline more and
  tighten the AI's leash.
- **Qualitative retrospective**: have the AI replay each settled match (result + goal
  timeline) against its own pre-match analysis, grade itself, and extract reusable lessons.
  Aggregate recurring lessons and **feed the top ones back into the analysis prompt** so the
  AI stops repeating its own mistakes. This closes the loop from prediction → outcome →
  learning. Detail in `references/ai-analysis-and-learning.md`.

## Honest limits (state these; don't oversell)

- Single-match upsets and draws are, by definition, low-probability events. No model makes
  them the top pick — the goal is to assign them their *correct* (often higher) probability
  and flag high-variance matchups, not to "call" them.
- The sharp closing market is the best single pre-match predictor; an independent model that
  diverges from it by ~10 points is usually the one that's wrong. Diverge only where you have
  a real, nameable reason — that's also where any betting edge actually lives.
- Calibration coefficients depend on the Elo scale you feed in; re-calibrate against the
  exact ratings source you use in production.

## Scripts

- `scripts/build_team_ratings.py` — fit per-team attack/defense ratings from a results CSV,
  output JSON (run/refresh periodically as new results arrive).
- `scripts/calibrate_backtest.py` — rolling-Elo backtest over a results CSV; grid-search the
  Elo→goals coefficient and total-goals base to minimize log-loss; print reliability by
  Elo-gap bucket so you can see exactly where the model is mis-calibrated.

Both expect a CSV with columns: `date,home_team,away_team,home_score,away_score,tournament,neutral`
(the public `martj42/international_results` dataset is a good free source for international football).
