{
    "success": true,
    "reports": {
        "scout": {
            "summary": "Both teams have poor form with no wins in their last 5 matches",
            "homeTeamStatus": "Poor form, no injuries reported",
            "awayTeamStatus": "Poor form, no injuries reported",
            "injuries": [],
            "suspensions": [],
            "keyFactors": [
                "Both teams have poor form",
                "No injuries reported for either team"
            ],
            "weather": null,
            "homeAdvantage": "normal",
            "note": "Low total injuries impact, both teams have similar poor form",
            "injuryDetails": {
                "home": [],
                "away": [],
                "totalCount": 0
            }
        },
        "stats": {
            "formAnalysis": "Both teams have unknown form, so no comparison can be made",
            "goalExpectancy": 2.2,
            "overUnder": "Over",
            "overUnderReasoning": "The expected total goals (2.20) is close to the over 2.5 threshold, and both teams have a 50% over 2.5 rate in their respective matches",
            "confidence": 60,
            "matchResult": "X",
            "matchResultReasoning": "The head-to-head matches have resulted in two draws, and the expected goals for both teams are equal (1.10)",
            "btts": "Yes",
            "bttsReasoning": "Both teams have a 50% BTTS rate in their respective matches, but the head-to-head matches have not seen any goals, making this prediction less confident",
            "keyStats": [
                "Both teams have the same goal scoring and conceding averages",
                "Head-to-head matches have been goalless",
                "Both teams have a 50% over 2.5 and BTTS rate"
            ],
            "riskFactors": [
                "Unknown form of both teams",
                "Low goal expectancy in head-to-head matches"
            ],
            "_calculatedStats": {
                "expectedTotal": "2.20",
                "homeExpected": "1.10",
                "awayExpected": "1.10",
                "avgOver25": 16833,
                "avgBtts": 16833
            }
        },
        "odds": {
            "oddsAnalysis": "The odds suggest a closely contested match with similar probabilities for a home win, draw, and away win. The over/under 2.5 goals market is evenly priced, indicating a balanced expectation for goal scoring.",
            "recommendation": "Under",
            "confidence": 60,
            "matchWinnerValue": "draw",
            "bttsValue": "no",
            "valueRating": "Medium"
        },
        "strategy": {
            "riskAssessment": "Medium",
            "recommendedBets": [
                {
                    "type": "Both Teams to Score (BTTS)",
                    "selection": "Yes",
                    "confidence": 60,
                    "reasoning": "Stats Agent Analysis suggests a high goal expectancy and recommends BTTS Yes, despite the Odds Agent Analysis suggesting the opposite."
                },
                {
                    "type": "Match Result",
                    "selection": "Draw",
                    "confidence": 60,
                    "reasoning": "Both Stats and Odds Agent Analyses agree on the match result being a draw, increasing confidence in this selection."
                }
            ],
            "avoidBets": [
                "Over/Under: Under",
                "Match Winner: Either team"
            ],
            "stakeSuggestion": "Medium",
            "overallStrategy": "A balanced approach considering both analyses. Focus on BTTS Yes and the match result being a draw. Avoid betting on the match winner or Under in Over/Under markets due to conflicting recommendations and medium confidence levels."
        },
        "weightedConsensus": {
            "overUnder": {
                "prediction": "Under",
                "confidence": 53,
                "reasoning": "Stats (40%) + Odds (35%) + Strategy (25%) weighted analysis",
                "votes": 3
            },
            "matchResult": {
                "prediction": "X",
                "confidence": 85,
                "reasoning": "3 agent consensus",
                "votes": 3
            },
            "btts": {
                "prediction": "Yes",
                "confidence": 45,
                "reasoning": "Based on goal statistics",
                "votes": 2
            },
            "bestBet": {
                "type": "Match Result",
                "selection": "X",
                "confidence": 85,
                "reasoning": "Highest weighted confidence score",
                "votes": 3
            },
            "agentContributions": {
                "stats": "40% weight",
                "odds": "35% weight",
                "strategy": "25% weight"
            }
        }
    },
    "timing": 15732,
    "errors": [],
    "multiModel": {
        "enabled": true,
        "predictions": [
            {
                "model": "llama-3.3-70b-instruct",
                "overUnder": "Over",
                "confidence": 60,
                "matchResult": "X",
                "btts": "Yes",
                "reasoning": "Based on the expected total goals and H2H avg goals, the match is likely to have over 2.5 goals, and the draw in H2H matches suggests a possible draw."
            },
            {
                "model": "llama-3.1-nemotron-70b-instruct",
                "overUnder": "Over",
                "confidence": 60,
                "matchResult": "X",
                "btts": "Yes",
                "reasoning": "Expected Total Goals (2.40) and H2H Avg Goals (2.5) suggest a high-scoring match, while H2H draws (2) indicate a likely stalemate."
            },
            {
                "model": "deepseek-r1-distill-llama-70b",
                "overUnder": "Over",
                "confidence": 55,
                "matchResult": "X",
                "btts": "Yes",
                "reasoning": "Both teams have similar averages and H2H matches ended in draws with moderate goals."
            },
            {
                "model": "mistral-small-24b-instruct-2501",
                "overUnder": "Over",
                "confidence": 70,
                "matchResult": "X",
                "btts": "Yes",
                "reasoning": "Expected total goals of 2.40 and historical data suggest a high likelihood of both teams scoring."
            }
        ],
        "consensus": {
            "overUnder": {
                "prediction": "Over",
                "votes": 4,
                "confidence": 61
            },
            "matchResult": {
                "prediction": "X",
                "votes": 4,
                "confidence": 65
            },
            "btts": {
                "prediction": "Yes",
                "votes": 4,
                "confidence": 65
            }
        },
        "unanimousDecisions": [
            "Over/Under: Over (4/4)",
            "Match Result: X (4/4)",
            "BTTS: Yes (4/4)"
        ],
        "conflictingDecisions": [],
        "bestBet": {
            "type": "Match Result",
            "selection": "X",
            "confidence": 65,
            "reasoning": "4/4 AI models agree on this prediction"
        },
        "modelAgreement": 100
    },
    "dataUsed": {
        "hasOdds": false,
        "hasHomeForm": false,
        "hasAwayForm": false,
        "hasH2H": true,
        "hasInjuries": false,
        "homeMatchCount": 0,
        "awayMatchCount": 0,
        "h2hMatchCount": 2,
        "homeInjuryCount": 0,
        "awayInjuryCount": 0
    },
    "rawStats": {
        "home": {
            "form": "N/A",
            "points": 0,
            "maxPoints": 15,
            "record": "0W-0D-0L",
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "avgGoalsScored": "1.20",
            "avgGoalsConceded": "1.00",
            "avgGoals": "1.20",
            "avgConceded": "1.00",
            "totalGoalsScored": 0,
            "totalGoalsConceded": 0,
            "over25Percentage": "50",
            "over25Count": 0,
            "bttsPercentage": "50",
            "bttsCount": 0,
            "cleanSheets": 0,
            "cleanSheetPercentage": 0,
            "failedToScore": 0,
            "failedToScorePercentage": 0,
            "matches": [],
            "matchDetails": [],
            "matchCount": 0
        },
        "away": {
            "form": "N/A",
            "points": 0,
            "maxPoints": 15,
            "record": "0W-0D-0L",
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "avgGoalsScored": "1.20",
            "avgGoalsConceded": "1.00",
            "avgGoals": "1.20",
            "avgConceded": "1.00",
            "totalGoalsScored": 0,
            "totalGoalsConceded": 0,
            "over25Percentage": "50",
            "over25Count": 0,
            "bttsPercentage": "50",
            "bttsCount": 0,
            "cleanSheets": 0,
            "cleanSheetPercentage": 0,
            "failedToScore": 0,
            "failedToScorePercentage": 0,
            "matches": [],
            "matchDetails": [],
            "matchCount": 0
        },
        "h2h": {
            "totalMatches": 2,
            "homeWins": 0,
            "awayWins": 0,
            "draws": 2,
            "totalHomeGoals": 0,
            "totalAwayGoals": 0,
            "avgHomeGoals": "0.00",
            "avgAwayGoals": "0.00",
            "avgTotalGoals": "0.00",
            "avgGoals": "0.00",
            "over25Percentage": "0",
            "over25Count": 0,
            "bttsPercentage": "0",
            "bttsCount": 0,
            "matchDetails": [
                {
                    "date": "2021-05-08 17:30:00",
                    "homeTeam": "Fatih Karagümrük",
                    "awayTeam": "Gençlerbirliği",
                    "score": "0-0",
                    "winner": "Draw"
                },
                {
                    "date": "2021-01-15 16:00:00",
                    "homeTeam": "Gençlerbirliği",
                    "awayTeam": "Fatih Karagümrük",
                    "score": "0-0",
                    "winner": "Draw"
                }
            ]
        },
        "injuries": {
            "home": [],
            "away": []
        }
    }
}
