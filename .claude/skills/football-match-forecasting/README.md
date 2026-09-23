## Football Match Forecasting

Purpose
- Provide a disciplined, data-first pipeline that pairs a calibrated quantitative baseline with targeted LLM adjustments so predictions are verifiable and improve over time.

Core principles
- The calibrated quantitative model is the anchor; the LLM only adjusts when it has specific, nameable intel.
- Make every model claim verifiable against real results; prioritize calibration and reproducibility over intuition.

Quick overview (4 stages)
1. Collect data & fill gaps
   - Pull structured sources (Elo, xG, form, lineups, injuries, market odds, weather).
   - For missing national-team data, use web search to gather form, lineups, injuries, tactics, head-to-head and treat these as first-class inputs.
2. Build the calibrated quantitative baseline
   - Ensemble of: Elo→Poisson/Dixon-Coles mapping and per-team attack/defense ratings.
   - Calibrate the Elo→goals coefficient (example: ~0.45 found vs default 0.32) and total-goals base (≈2.5) by minimizing log-loss/Brier.
   - Average 1X2 probabilities from both components as the baseline.
3. AI analysis: anchor + named deviation
   - Start from the calibrated baseline; only deviate with specific, named intel (e.g., confirmed lineup change, suspension, rotation, weather).
   - State factor, direction, magnitude (bounded ≈ ±0.08 unless overwhelming), and reason for any deviation.
4. Verify & self-learn
   - After matches, compare AI vs baseline using Brier/log-loss.
   - Have the AI replay results, grade itself, extract lessons, and feed recurring lessons back into the analysis prompt.

What’s included in this repo
- scripts/build_team_ratings.py — fit per-team attack/defense ratings from results CSV.
- scripts/calibrate_backtest.py — rolling-Elo backtest and calibration (grid-search Elo→goals coefficient and total-goals base).
- references/ — detailed docs for each stage (data collection, quant & calibration, AI analysis & learning).

Data expectations
- Results CSV columns: date,home_team,away_team,home_score,away_score,tournament,neutral
- Suggested public dataset: martj42/international_results for international fixtures.

Limitations & guidance
- Single-match upsets are low-probability; focus on correct probabilities and identifying high-variance matchups.
- The closing market is a strong predictor; diverge only with named, verifiable reasons.
- Recalibrate coefficients for the exact Elo source used in production.
