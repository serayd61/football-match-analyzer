// Sportmonks'tan maç sonucu çek
async function getMatchResult(fixtureId: number): Promise<{
  finished: boolean;
  homeScore: number;
  awayScore: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) return null;

    // Finished states: 5=FT, 6=FT_PEN, 7=AET, 11=Awarded, 12=WO
    const finishedStates = [5, 6, 7, 11, 12];
    const finished = finishedStates.includes(fixture.state_id);

    let homeScore = 0;
    let awayScore = 0;

    if (fixture.scores && Array.isArray(fixture.scores)) {
      fixture.scores.forEach((s: any) => {
        if (s.description === 'CURRENT' || s.type_id === 1525) {
          if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
          if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
        }
      });
    }

    return { finished, homeScore, awayScore };
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureId}:`, error);
    return null;
  }
}
```

---

Ama önce şu URL'den maçın `state_id` değerini öğrenelim:
```
https://api.sportmonks.com/v3/football/fixtures/19427327?api_token=LVhKgzwe2bZEyzoPQa5Sgz9oFpr9wN8Nvu4lpOJU65iwvOdKRoQ3shhvUPF5&include=scores
