# Football Analytics - Quick Testing Guide

**Purpose**: Verify all systems are working correctly  
**Time Required**: 10-15 minutes  
**Status**: Ready for production testing  

---

## ✅ Pre-Test Checklist

- [ ] Repository pulled and up to date
- [ ] Node dependencies installed: `npm install`
- [ ] `.env.local` file created with API keys:
  - `SPORTMONKS_API_KEY=your_key`
  - `OPENAI_API_KEY=sk-...` OR `ANTHROPIC_API_KEY=sk-ant-...` OR `GEMINI_API_KEY=...`

---

## 🧪 Test Sequence

### Test 1: System Verification (30 seconds)

```bash
# Start dev server (if not already running)
npm run dev

# In another terminal, verify system:
curl http://localhost:3000/api/v3/test/verify
```

**Expected Response**:
```json
{
  "success": true,
  "status": "production-ready",
  "verificationResults": [
    {
      "service": "Sportmonks",
      "status": "ok",
      "message": "API key valid and responding"
    },
    {
      "service": "OpenAI",
      "status": "ok",
      "message": "API key valid"
    },
    {
      "service": "System",
      "status": "ok",
      "message": "Football analyzer system is running"
    }
  ],
  "summary": {
    "passed": 3,
    "failed": 0,
    "warnings": 0
  },
  "status": "production-ready"
}
```

**What to look for**:
- ✅ All services show `"status": "ok"`
- ✅ `"success": true`
- ✅ 0 failures

---

### Test 2: Live Fixtures Endpoint (2 minutes)

#### 2A. Get Raw Fixture Data

```bash
curl "http://localhost:3000/api/v3/test/live-fixture?days=3&format=raw" | jq '.'
```

**Expected Response** (sample):
```json
{
  "success": true,
  "count": 5,
  "fixtures": [
    {
      "fixtureId": 123456,
      "homeTeamId": 1,
      "homeTeam": "Liverpool",
      "awayTeamId": 2,
      "awayTeam": "Chelsea",
      "league": "Premier League",
      "leagueId": 5,
      "date": "2025-02-15",
      "status": "scheduled"
    },
    ...
  ],
  "timestamp": "2025-02-13T10:30:00.000Z"
}
```

**What to verify**:
- ✅ `"success": true`
- ✅ `count` > 0 (fixtures found)
- ✅ Each fixture has: `fixtureId`, team info, league, date

#### 2B. Get Analysis-Ready Data

```bash
curl "http://localhost:3000/api/v3/test/live-fixture?days=3&format=analyze" | jq '.fixtures[0]'
```

**Expected Response** (sample structure):
```json
{
  "match": {
    "homeTeam": "Liverpool",
    "awayTeam": "Chelsea",
    "homeTeamId": 1,
    "awayTeamId": 2,
    "league": "Premier League",
    "date": "2025-02-15",
    "fixtureId": 123456
  },
  "homeStats": {
    "name": "Liverpool",
    "form": "WWDLW",
    "avgGF": 2.4,
    "avgGA": 0.8,
    "homeWinRate": 75,
    "xGFor": 2.15,
    "xGAgainst": 0.72
  },
  "awayStats": {
    "name": "Chelsea",
    "form": "WDWDL",
    "avgGF": 1.8,
    "avgGA": 1.2,
    "awayWinRate": 55,
    "xGFor": 1.85,
    "xGAgainst": 1.15
  },
  "h2h": {
    "matches": 25,
    "homeWins": 12,
    "draws": 6,
    "awayWins": 7,
    "avgGoals": 2.8,
    "bttsPercent": 60,
    "over25Percent": 72
  },
  "dataQuality": {
    "homeXGAvailable": true,
    "awayXGAvailable": true,
    "h2hMatches": 25,
    "confidence": "high"
  }
}
```

**What to verify**:
- ✅ `match` contains all teams, date, league
- ✅ `homeStats` has form, goals, xG values
- ✅ `awayStats` populated similarly
- ✅ `h2h` has historical data
- ✅ `dataQuality.confidence` shows data reliability

---

### Test 3: Analysis Pipeline (3 minutes)

#### 3A. Get Test Data

```bash
curl -s "http://localhost:3000/api/v3/test/live-fixture?days=1&format=analyze" | jq '.fixtures[0]' > /tmp/test_fixture.json
```

#### 3B. Send to Analysis Endpoint

```bash
curl -X POST http://localhost:3000/api/v3/analyze \
  -H "Content-Type: application/json" \
  -d @/tmp/test_fixture.json | jq '.'
```

**Expected Response** (sample):
```json
{
  "success": true,
  "match": {
    "homeTeam": "Liverpool",
    "awayTeam": "Chelsea"
  },
  "agents": {
    "istatistik": {
      "homeWinPercent": 62,
      "drawPercent": 18,
      "awayWinPercent": 20,
      "expectedGoals": 2.7,
      "bttsProb": 65,
      "over25Prob": 78,
      "confidence": "high",
      "analysis": "..."
    },
    "forma": {
      "homeMomentum": 8,
      "awayMomentum": 6,
      "favoriteShift": "Liverpool",
      "analysis": "Liverpool strong form, Chelsea improving"
    },
    "h2h": {
      "homeH2HEdge": 7,
      "awayH2HEdge": 4,
      "likelyPattern": "...",
      "bttsHistoric": 60,
      "over25Historic": 72
    }
  },
  "consensus": {
    "prediction": "1",
    "confidence": 68,
    "recommendation": "Home Win (Strong)",
    "analysis": "...",
    "odds": {
      "recommended": "1.80-2.00",
      "reasoning": "72% consensus with xG advantage"
    }
  },
  "dataQuality": {
    "confidence": "high",
    "sources": "Sportmonks (xG, stats, H2H)"
  }
}
```

**What to verify**:
- ✅ Response completes without errors
- ✅ All 4 agents provided analysis (istatistik, forma, h2h)
- ✅ Consensus prediction included
- ✅ Confidence scores provided
- ✅ xG-based probabilities included (over2.5%, bttsProb%)
- ✅ Betting recommendations provided

---

## 📊 Performance Benchmarks

### Expected Response Times

| Endpoint | Expected | Acceptable |
|----------|----------|-----------|
| `/api/v3/test/verify` | < 2 sec | < 5 sec |
| `/api/v3/test/live-fixture` (raw) | 2-4 sec | < 10 sec |
| `/api/v3/test/live-fixture` (analyze) | 4-8 sec | < 15 sec |
| `/api/v3/analyze` | 8-12 sec | < 20 sec |

**How to measure**:
```bash
time curl "http://localhost:3000/api/v3/test/live-fixture?days=1"
```

---

## 🔍 Data Quality Checks

### 1. Fixture Data Completeness
```bash
# Check how many fixtures have xG data
curl -s "http://localhost:3000/api/v3/test/live-fixture?days=3&format=analyze" | \
  jq '[.fixtures[] | select(.dataQuality.homeXGAvailable == true)] | length'

# Should be >= 80% of total fixtures
```

### 2. H2H Data Sample Size
```bash
# Check H2H match history
curl -s "http://localhost:3000/api/v3/test/live-fixture?days=1&format=analyze" | \
  jq '.fixtures[0].h2h.matches'

# Should be > 0 (ideally > 10 for "high" confidence)
```

### 3. API Response Consistency
```bash
# Run same request 3 times, should return consistent data
for i in {1..3}; do
  curl -s "http://localhost:3000/api/v3/test/live-fixture?days=1" | jq '.count'
done

# All 3 should return same number
```

---

## 🚨 Troubleshooting

### Issue: "No fixtures found"

**Causes**:
1. Invalid Sportmonks API key
2. No matches scheduled for the date range
3. Network connectivity issue

**Solutions**:
```bash
# Verify API key
curl "https://api.sportmonks.com/v3/football/fixtures?api_token=YOUR_KEY&per_page=1"

# Try extended date range
curl "http://localhost:3000/api/v3/test/live-fixture?days=7"

# Check network
curl -I https://api.sportmonks.com/v3/football/
```

---

### Issue: "Missing team stats"

**Causes**:
1. Team not in Sportmonks database
2. Team has no recent matches (pre-season)
3. API rate limit exceeded

**Solutions**:
```bash
# Verify team exists
curl "https://api.sportmonks.com/v3/football/teams?api_token=YOUR_KEY" | grep -i "teamname"

# Wait 1 minute and try again (rate limit reset)
sleep 60
curl "http://localhost:3000/api/v3/test/live-fixture?days=1"
```

---

### Issue: "Analysis endpoint timeout"

**Causes**:
1. AI API key invalid
2. Network latency
3. AI service under load

**Solutions**:
```bash
# Test with fewer fixtures
curl "http://localhost:3000/api/v3/test/live-fixture?days=1&format=analyze" | jq '.count'
# If > 3, try: ?days=0

# Verify AI API key
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
# Should return model list
```

---

## ✅ Post-Test Validation

After all tests pass:

- [ ] All 3 test endpoints respond correctly
- [ ] Response times within acceptable ranges
- [ ] Data appears complete (stats, xG, H2H)
- [ ] xG values reasonable (typically 0.5 - 3.0)
- [ ] H2H percentages make sense (0-100%)
- [ ] Analysis probabilities add up correctly
- [ ] No API key errors in responses
- [ ] No network timeouts

---

## 🎯 Sample cURL Commands for Quick Testing

```bash
# 1. Verify system
curl http://localhost:3000/api/v3/test/verify | jq '.status'

# 2. Get upcoming fixtures
curl http://localhost:3000/api/v3/test/live-fixture | jq '.count'

# 3. Get first fixture analysis data
curl http://localhost:3000/api/v3/test/live-fixture | jq '.fixtures[0].match'

# 4. Test AI analysis
curl -X POST http://localhost:3000/api/v3/analyze \
  -H "Content-Type: application/json" \
  -d @/tmp/test_fixture.json | jq '.consensus.prediction'
```

---

## 📱 API Documentation Reference

- **Sportmonks**: https://docs.sportmonks.com/football/
- **OpenAI**: https://platform.openai.com/docs/api-reference/
- **Anthropic**: https://docs.anthropic.com/claude/reference/
- **Gemini**: https://ai.google.dev/api/rest/

---

## 🎉 Success Criteria

✅ **Test is successful when**:
1. All API keys verified (green checkmarks in `/verify`)
2. Live fixture endpoint returns fixtures with data
3. Analysis-ready format contains all required fields
4. Analysis endpoint processes data and returns predictions
5. Response times acceptable (< 15 seconds per step)
6. Data quality confidence level is "high" or "medium"

**Congratulations! Your Football Analytics system is production-ready.** 🚀

---

**Documentation**: Complete in SETUP.md  
**Issues**: Check SETUP.md Troubleshooting section  
**Support**: Sportmonks docs / AI provider API docs
