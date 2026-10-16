# Google Play listing — en-US

Source of truth for the Play Console "Main store listing" (English). Limits: title ≤ 30, short description ≤ 80, full description ≤ 4000 characters. Validate with `node scripts/aso-validate.js` before pasting into the Console. Banned words (Google Ads gambling-certification language, see `marketing/google-play-store-listing.md` §2): tips, picks, sure bet, bonus, guaranteed.

Everything below describes features that exist in the app today (`src/lib/site/leagues.ts` = 11 leagues; markets, performance page, league pages, 4 languages, dark mode). Nothing is claimed about rankings, download numbers or keyword volumes.

## Title

```text
Football Analytics Pro
```

Alternative if the Console allows the extra characters and we want a descriptor (30 max):

```text
Football Analytics Pro: Stats
```

## Short description

```text
Football stats & match probabilities from a model, every prediction scored.
```

## Full description

```text
Football Analytics Pro turns football statistics into match probabilities. A Dixon-Coles statistical model rates every fixture in 11 leagues before kick-off, and every prediction is scored in public after the final whistle, wins and losses alike.

MATCH PROBABILITIES & FOOTBALL STATS
• 1X2 (home / draw / away), over/under 2.5 and both-teams-to-score probabilities for every rated match
• Expected goals (xG), likely scorelines and Asian handicap lines
• Edge vs market: how far the model's probability sits from the bookmaker's implied price
• A confidence ring and a Low / Medium / High risk label on every prediction

LEAGUE TABLES, FORM & HEAD-TO-HEAD
• Standings, recent form, absences and head-to-head for every fixture
• League pages with each league's settled record
• Fixtures for the next seven days and a results archive

A PUBLIC TRACK RECORD
• Every prediction is time-stamped before kick-off and cannot be edited afterwards
• Hit rate, Brier score, calibration and flat-stake returns, refreshed every Monday
• Bad months stay on the page: the performance history is never trimmed

LEAGUES COVERED
Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Liga Portugal, UEFA Champions League, Brasileirão, Süper Lig. Fixtures outside these leagues appear without a model rating and are not counted in the record.

HOW THE MODEL WORKS
1. Model: a Dixon-Coles bivariate Poisson model with xG, Elo and isotonic calibration, blended with market odds.
2. Predict: predictions are published the night before kick-off with a timestamp.
3. Settle: after the match the prediction is scored and published on the performance page.
The methodology page explains every step.

BUILT FOR DAILY USE
• Light and dark theme, follows your system setting
• English, German, Italian and Turkish
• Works on phone, tablet and the web with the same account

PLANS
Match previews, league tables and the public performance record are free. Members get the model's probabilities, confidence and risk for every match, likely scores, the edge view and the full archive.

IMPORTANT
Football Analytics Pro is an information and statistics service. It does not offer betting, does not accept stakes and is not affiliated with any bookmaker. Probabilities are statistical estimates, not financial advice. 18+. Please play responsibly.
```

## Keyword sets (candidates, not measured)

No keyword-volume tool was used; these are the terms the copy above is built around, grouped by search intent. Validate against Play Console → "Store performance" once the app is public.

| Intent | Primary | Secondary |
|---|---|---|
| Statistics | football statistics, football stats, match statistics | expected goals, xG, Brier score, calibration |
| Probabilities | match probabilities, football probabilities, match prediction | 1X2, over under, both teams to score |
| Context | league tables, standings, head to head, form | fixtures, results archive |
| Leagues | Premier League, La Liga, Serie A, Bundesliga, Ligue 1 | Championship, Eredivisie, Süper Lig, Champions League, Brasileirão |
| Trust | track record, performance history, transparent predictions | settled predictions, public record |

## Claims that need an owner to verify before publishing
- "Refreshed every Monday" (performance page weeklyMeta in `messages/en.json` says computed every Monday) — keep only while the Monday job runs.
- "Absences" (injuries via API-Football) — present on match pages; remove if the data source changes.
- "Asian handicap lines" — present on the member match page (`predictions/[matchId]`).
- League list — must match `src/lib/site/leagues.ts` each season.
