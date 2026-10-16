# Google Play listing — de-DE

Quelle für den Play-Console-Eintrag (Deutsch). Limits: Titel ≤ 30, Kurzbeschreibung ≤ 80, vollständige Beschreibung ≤ 4000 Zeichen. Vor dem Einfügen `node scripts/aso-validate.js` ausführen. Gesperrte Wörter: Tipps, Wett-Tipps, sichere Wette, Bonus, garantiert.

Alle Aussagen beschreiben vorhandene Funktionen (11 Ligen laut `src/lib/site/leagues.ts`, Märkte, Bilanzseite, Ligaseiten, 4 Sprachen, Dark Mode). Keine Angaben zu Rankings, Downloads oder Suchvolumen.

## Title

```text
Football Analytics Pro
```

## Short description

```text
Fussball-Statistik & Spielwahrscheinlichkeiten, jede Prognose öffentlich geprüft
```

## Full description

```text
Football Analytics Pro macht aus Fussball-Statistik Spielwahrscheinlichkeiten. Ein statistisches Dixon-Coles-Modell bewertet jede Partie in 11 Ligen vor dem Anpfiff, und jede Prognose wird nach dem Abpfiff öffentlich abgerechnet – Treffer wie Fehlschläge.

SPIELWAHRSCHEINLICHKEITEN & FUSSBALL-STATISTIK
• 1X2 (Heim / Remis / Auswärts), Über/Unter 2,5 und «Beide Teams treffen» für jedes bewertete Spiel
• Expected Goals (xG), wahrscheinliche Resultate und Asian-Handicap-Linien
• Edge gegenüber dem Markt: Abstand der Modell-Wahrscheinlichkeit zum impliziten Preis des Buchmachers
• Konfidenzring und Risiko-Label Niedrig / Mittel / Hoch bei jeder Prognose

TABELLEN, FORM & DIREKTVERGLEICH
• Tabelle, aktuelle Form, Ausfälle und Direktvergleich zu jeder Partie
• Ligaseiten mit der abgerechneten Bilanz jeder Liga
• Spielplan der nächsten sieben Tage und Ergebnisarchiv

EINE ÖFFENTLICHE BILANZ
• Jede Prognose wird vor dem Anpfiff mit Zeitstempel fixiert und ist danach nicht mehr änderbar
• Trefferquote, Brier-Score, Kalibrierung und Flat-Stake-Rendite, jeden Montag aktualisiert
• Schwache Monate bleiben sichtbar: die Historie wird nie gekürzt

ABGEDECKTE LIGEN
Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Liga Portugal, UEFA Champions League, Brasileirão, Süper Lig. Spiele ausserhalb dieser Ligen erscheinen ohne Modellbewertung und zählen nicht zur Bilanz.

SO FUNKTIONIERT DAS MODELL
1. Modell: Dixon-Coles (bivariate Poisson) mit xG, Elo und isotonischer Kalibrierung, gemischt mit Marktquoten.
2. Prognose: Veröffentlichung am Vorabend des Spiels mit Zeitstempel.
3. Abrechnung: nach dem Spiel wird die Prognose bewertet und auf der Bilanzseite veröffentlicht.
Die Methodik-Seite erklärt jeden Schritt.

FÜR DEN TÄGLICHEN GEBRAUCH
• Helles und dunkles Design, folgt der Systemeinstellung
• Deutsch, Englisch, Italienisch und Türkisch
• Auf Smartphone, Tablet und im Web mit demselben Konto

PLÄNE
Spielvorschauen, Tabellen und die öffentliche Bilanz sind kostenlos. Mitglieder erhalten Wahrscheinlichkeiten, Konfidenz und Risiko zu jedem Spiel, wahrscheinliche Resultate, die Edge-Ansicht und das vollständige Archiv.

WICHTIG
Football Analytics Pro ist ein Informations- und Statistikdienst. Es werden keine Wetten angeboten oder angenommen; keine Verbindung zu Buchmachern. Wahrscheinlichkeiten sind statistische Schätzungen, keine Finanzberatung. 18+. Bitte spielen Sie verantwortungsvoll.
```

## Keyword-Sets (Kandidaten, nicht gemessen)

| Intention | Primär | Sekundär |
|---|---|---|
| Statistik | Fussball Statistik, Fußball Statistiken, Spielstatistik | Expected Goals, xG, Brier-Score, Kalibrierung |
| Wahrscheinlichkeit | Spielwahrscheinlichkeiten, Fussball Prognose, Spielvorhersage | 1X2, Über/Unter, Beide Teams treffen |
| Kontext | Tabelle, Tabellenstand, Direktvergleich, Form | Spielplan, Ergebnisse |
| Ligen | Bundesliga, Premier League, La Liga, Serie A, Ligue 1 | Champions League, Eredivisie, Süper Lig |
| Vertrauen | Bilanz, Trefferquote, transparente Prognosen | öffentliche Bilanz, abgerechnete Prognosen |

Hinweis: Im Store-Eintrag «Fussball» (CH-Schreibweise, wie im bestehenden Eintrag) beibehalten oder durchgehend «Fußball» verwenden – eine Entscheidung des Inhabers; die Suche in Play ist gegenüber ß/ss tolerant, aber nicht garantiert.

## Vor Veröffentlichung zu prüfen
- «jeden Montag aktualisiert» nur, solange der Montags-Job läuft.
- «Ausfälle» (Verletzungen via API-Football) nur, solange die Datenquelle besteht.
- Ligenliste muss jede Saison `src/lib/site/leagues.ts` entsprechen.
