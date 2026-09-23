# Stage 1 — Data collection & web-search gap-filling

## Structured sources (use what's available)

| Signal | Typical source | National-team coverage |
|---|---|---|
| Team strength | eloratings.net (Elo) | poor for smaller federations → `unknown_default` |
| Recent form (GF/GA) | results feed / TheSportsDB | partial |
| xG | API-Football / FBref | poor for national teams |
| Lineups / injuries | Sportmonks / API-Football | partial, often only near kickoff |
| Market odds | the-odds-api / Pinnacle | sometimes no coverage for the specific match |
| Weather / venue | weather API | ok |
| Fixtures / live state | Sportmonks | ok |

Record a **data-completeness score** so the downstream model can widen its uncertainty when
inputs are thin. Never pass a default/placeholder rating downstream as if it were real —
flag it.

## The key move: fill gaps with open web search

Structured APIs miss intel that plainly exists in news/media. When coverage is thin (national
teams especially), run the LLM's web-search tool to gather it — the same way a sharp human or
Grok would. This routinely recovers form, ranking, lineups, injuries, and style that the APIs
returned empty.

### Two-step web search (robust against proxies)

Some API gateways pass the web_search server tool but return results as text without
auto-synthesizing. So split into two calls:

1. **Search call** — model + `web_search` tool enabled. Keep the *user message* a short seed
   query (long messages get used verbatim as the query by some proxies and find nothing); put
   the detailed coverage instructions in the *system* prompt, and tell it to run follow-up
   searches.
2. **Synthesis call** — no tools; feed the gathered text back and ask for strict JSON.

### Seed query (short)

```
<Home> vs <Away> <competition> <year> preview: recent form & results, FIFA ranking,
predicted lineups, injuries, tactical style, head-to-head
```

### Search system prompt (coverage requirements)

Instruct the model to run web_search plus follow-up queries and cover ALL of, for both teams:

1. Recent form & results (last 5–10: W/D/L, GF/GA, streaks, qualifier performance)
2. Relative strength: FIFA ranking each side, who's favoured and how strongly
3. Predicted lineups / XI, injuries, fitness doubts, suspensions, rotation, team news
4. Tactical style (attacking/defensive, pressing) + expected scoring tendency (low/cagey vs open)
5. Head-to-head history + analyst/pundit consensus

Rules: must actually call web_search; news favors last 72h, but form/ranking/style may use the
broader recent record; never fabricate (write "无"/"unverified" if absent); downgrade
confidence for second-hand/social sources.

### Synthesis output schema (JSON)

```json
{
  "recentForm": { "home": "...", "away": "..." },
  "strength": { "homeRank": "FIFA rank or null", "awayRank": "...", "note": "who's favoured + gap" },
  "style": { "home": "...", "away": "...", "scoringTendency": "low|medium|high + why" },
  "h2h": "one line or '无'",
  "home": { "injuries": [{"player":"","status":"confirmed_out|doubtful|questionable|fit","reason":"","source":"","asOf":""}], "lineupNews":"", "teamNews":"" },
  "away": { "injuries":[...], "lineupNews":"", "teamNews":"" },
  "expertViews": [{"source":"","view":"","lean":"home|draw|away","asOf":""}],
  "evidence": [{"source":"","type":"news|x|official","summary":"","asOf":"","url":""}],
  "consensus": "", "sentiment": {"home":"bullish|neutral|bearish","away":"..."},
  "confidence": "high|medium|low", "asOf": "YYYY-MM-DD HH:mm UTC"
}
```

Treat the result as real searched intel only if web_search actually fired AND there's
non-stale evidence; otherwise mark it low-confidence so the analysis doesn't over-trust it.

### Feed it forward

Surface these fields explicitly to the analysis step (recent form, strength/ranking, style,
head-to-head, injuries/lineups), clearly labeled as web-sourced. This is what lets the AI
correct a quant baseline built on missing/default structured data.
