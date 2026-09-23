# Stages 3 & 4 — AI analysis (anchored) + verification & self-learning

## Stage 3 — AI analysis: anchor to baseline, deviate only with named intel

The failure mode to avoid: an LLM that "just predicts" emits probabilities that look
authoritative but are mostly noise, and which you can neither verify nor improve. The fix is to
make the AI's contribution legible: it starts from the calibrated baseline and only moves it for
reasons it can name.

### Prompt discipline (put in the analysis system prompt)

1. The calibrated ensemble probability is your **starting point** (baseline). Do NOT invent a
   fresh probability set.
2. Deviate **only** with specific, nameable info the baseline lacks: confirmed XI missing a key
   player, suspension, dead-rubber rotation/motivation, stark tactical mismatch, extreme
   weather. Each deviation must record `factor`, direction+magnitude (`shift`), and `reason`. No
   such info → output the baseline and leave deviations empty. **No vibes-nudging.**
3. Keep single-factor moves bounded (≈ ±0.08 unless overwhelming, e.g. two key starters out).
4. `probabilities = baseline + Σ(deviations)`, renormalized. If deviations is empty,
   `probabilities == baseline`.
5. Probabilities are **independent of the market price**. The market is only for sizing/edge
   *after* you have a probability — never an input to forming it. (Anchoring to the market = the
   AI adds nothing; you'd just use the price.)

### Output shape

```json
{
  "baseline": { "home": 0.0, "draw": 0.0, "away": 0.0 },
  "deviations": [ { "factor": "key DM suspended", "shift": "home -0.05, draw +0.03, away +0.02", "reason": "..." } ],
  "probabilities": { "home": 0.0, "draw": 0.0, "away": 0.0 },
  "confidence": "low|medium|high",
  "keyFactors": ["..."], "narrative": "short summary"
}
```

### What to feed the AI

The data pack should clearly mark the ensemble baseline as **"the calibrated starting point"**,
show its two components (Elo / attack-defense), the Monte-Carlo simulation (same anchor, for
uncertainty/CI), and the **web-sourced intel from Stage 1** (form, ranking, style, lineups,
injuries). The web intel is exactly what justifies legitimate deviations on thin-data matches.

### Persist for verification

Store, per analysis: the **ground-truth baseline** (the ensemble probs, not the AI's echo) and
the AI's final probabilities (so you can later compute the AI-vs-baseline delta and score both).

## Stage 4 — Verify and self-learn against real results

### Quantitative: does the AI actually beat the baseline?

After matches settle, join each analysis to the real result and compute Brier/log-loss for BOTH
the pure baseline and the AI-final. Report which is lower overall and on the subset where the AI
deviated. This is the only honest answer to "is the AI adding value?" If AI-final is worse, the
AI's deviations are net noise → shrink its allowed deviation and trust the baseline more. (Needs
a few dozen settled matches to be meaningful; say so, don't over-read small samples.)

### Qualitative: replay, critique, learn

For each settled match with an analysis, have the AI **replay** it — feed back its pre-match
analysis (baseline, final, deviations, key factors) plus the real result, final score, and goal
timeline — and produce:

```json
{
  "grade": "correct|partial|wrong",
  "critique": "where it was right/wrong, which factor it over/under-weighted, what it missed",
  "lessons": [ { "category": "e.g. defensive-opponent-underrated", "lesson": "reusable rule" } ]
}
```

### Close the loop (the part that makes it "learn")

Aggregate lessons across retrospectives, find the **recurring** ones, and inject the top few
back into the analysis system prompt as "past mistakes to avoid this time." Now the pipeline
improves itself: prediction → outcome → critique → updated behavior. Without this feedback step
the retrospective is just a report; with it, the AI stops repeating its own errors.

### Watch for

- Don't let the AI grade itself leniently — prompt for honesty ("don't excuse yourself").
- A correct *direction* with a bad *probability* still counts as a calibration miss; track both.
- Recurring lessons that are really *baseline* problems (not AI problems) should route back to
  Stage 2 re-calibration, not the AI prompt.
