# Stage 2 — Calibrated quant baseline

The baseline must be *calibrated*: when it says 40%, that outcome should happen ~40% of the
time over many matches. An uncalibrated model poisons everything downstream, so this stage is
where rigor pays off most. Calibrate against real historical results — never tune by intuition.

## Component A — Elo → Poisson / Dixon-Coles

```
diff      = elo_home + home_adv - elo_away          # home_adv ≈ 100 if not neutral, else 0
goalDiff  = (diff / 100) * COEFF                     # COEFF calibrated, see below
λ_home    = max(0.15, totalGoalsBase/2 + goalDiff/2)
λ_away    = max(0.15, totalGoalsBase/2 - goalDiff/2)
```

Then a Poisson score grid with a Dixon-Coles low-score correction τ(h,a,λh,λa,ρ); sum cells
into 1X2 / over-2.5 / BTTS and the top scorelines.

**Calibration finding (important):** the common default `COEFF = 0.32` *systematically
under-rates clear favorites*. Backtesting on real international results, log-loss/Brier
minimize around **COEFF ≈ 0.45, totalGoalsBase ≈ 2.5**. A single linear coefficient still
can't fully separate the extremes (Poisson structurally compresses big favorites), but ≈0.45
captures ~90% of the achievable gain. Re-run `scripts/calibrate_backtest.py` against YOUR Elo
source to confirm — the right value depends on the Elo scale.

Dixon-Coles ρ is a *low-score correlation* knob, not a global draw dial. Draw-rate error is
really *closeness-dependent* (draws cluster in evenly-matched games; a constant ρ can't fix
both ends). Don't abuse ρ to chase the overall draw rate.

## Component B — Per-team attack/defense ratings (Dixon-Coles style)

Each team gets an attack rating `att` and defense rating `dff`, fit from its actual
goals-for/against history, opponent-adjusted:

```
λ_home = exp(MU + att_home - dff_away + home_adv_log)
λ_away = exp(MU + att_away - dff_home)
```

Fit online over the match history (Elo-like gradient update on goal residuals), time-weighted,
with a global `MU = log(avg goals per team per match)`. This captures **team style** a single
Elo scalar can't: defensive sides (high `dff`) produce more low-scoring games and draws, and
under-rated/improving sides surface as "upsets" that are actually correct. It also yields a
real strength estimate when Elo is missing (e.g. national teams). `scripts/build_team_ratings.py`
fits these and writes a JSON ratings file; refresh it as new results arrive.

## Ensemble (the actual baseline)

Compute 1X2 from BOTH components and **average the probabilities** (50/50). Validated to beat
either model alone on overall log-loss AND, by a larger margin, on the upset+draw subset — the
hard cases that matter. When one team lacks attack/defense ratings, fall back to Elo-only (no
regression). Keep both components visible alongside the ensemble for transparency and as the
"baseline" the AI anchors to.

For the score distribution / over-under, run the same grid on a blended λ (or the ensemble) so
the headline 1X2 and the scoreline distribution stay consistent.

## How to know it's calibrated

`scripts/calibrate_backtest.py` prints, per Elo-gap bucket, **real** outcome frequencies vs the
model's predicted ones, plus log-loss/Brier. Read it like a reliability diagram: if "+150 Elo
favorites" win 72% in reality but the model says 53%, you have a favorite-compression problem to
fix (raise COEFF and/or add the attack/defense component). This is the objective scoreboard —
trust it over any single match.
