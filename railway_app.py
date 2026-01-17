"""
FootballAnalytics.pro - Railway Production Data Service
=======================================================
Railway'de soccerdata yerine Sportmonks API kullanır.
SoccerData scraping için TLS kütüphanesi gerekli ve Railway'de sorunlu.

Çözüm: Production'da Sportmonks API, Development'ta SoccerData
"""

import os
import json
import time
import hashlib
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from functools import lru_cache
import logging

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

class Config:
    """Railway Environment Configuration"""
    
    # Sportmonks API (Production)
    SPORTMONKS_TOKEN = os.getenv("SPORTMONKS_API_TOKEN", "")
    SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football"
    
    # Environment
    ENVIRONMENT = os.getenv("RAILWAY_ENVIRONMENT", "development")
    IS_PRODUCTION = ENVIRONMENT == "production"
    
    # Cache settings
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL", 300))  # 5 dakika
    
    # Rate limiting
    RATE_LIMIT_DELAY = 0.5  # saniye
    
    # League IDs (Sportmonks)
    LEAGUE_IDS = {
        'super-lig': 600,
        'premier-league': 8,
        'la-liga': 564,
        'bundesliga': 82,
        'serie-a': 384,
        'ligue-1': 301,
        'eredivisie': 72,
        'primeira-liga': 462,
        'champions-league': 2,
        'europa-league': 5,
    }

config = Config()

# ============================================================
# SIMPLE MEMORY CACHE (Railway Free Tier - No Redis)
# ============================================================

class SimpleCache:
    """Basit memory cache - Railway free tier için"""
    
    def __init__(self):
        self._cache: Dict[str, tuple] = {}  # key: (data, timestamp)
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now().timestamp() - timestamp < config.CACHE_TTL_SECONDS:
                logger.info(f"Cache HIT: {key}")
                return data
            else:
                del self._cache[key]
        logger.info(f"Cache MISS: {key}")
        return None
    
    def set(self, key: str, data: Any):
        self._cache[key] = (data, datetime.now().timestamp())
        logger.info(f"Cache SET: {key}")
    
    def clear(self):
        self._cache.clear()

cache = SimpleCache()

# ============================================================
# SPORTMONKS API CLIENT
# ============================================================

class SportmonksClient:
    """Sportmonks API Client for Railway Production"""
    
    def __init__(self):
        self.token = config.SPORTMONKS_TOKEN
        self.base_url = config.SPORTMONKS_BASE_URL
        
        if not self.token:
            logger.warning("⚠️ SPORTMONKS_API_TOKEN not set!")
    
    def _request(self, endpoint: str, params: dict = None) -> dict:
        """Make API request with caching and rate limiting"""
        
        if not self.token:
            raise ValueError("Sportmonks API token required. Set SPORTMONKS_API_TOKEN env var.")
        
        # Build cache key
        cache_key = f"sm:{endpoint}:{json.dumps(params or {}, sort_keys=True)}"
        
        # Check cache
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Make request
        url = f"{self.base_url}/{endpoint}"
        params = params or {}
        params['api_token'] = self.token
        
        time.sleep(config.RATE_LIMIT_DELAY)
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Cache response
            cache.set(cache_key, data)
            
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Sportmonks API error: {e}")
            raise
    
    def health_check(self) -> dict:
        """API bağlantı kontrolü"""
        try:
            data = self._request("leagues", {"per_page": 1})
            return {
                "status": "ok",
                "message": "Sportmonks API connected",
                "rate_limit_remaining": data.get('rate_limit', {}).get('remaining', 'unknown')
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    # ==================
    # FIXTURES / MATCHES
    # ==================
    
    def get_fixtures_by_date(self, date: str) -> List[dict]:
        """
        Belirli tarihteki maçları getir
        
        Args:
            date: YYYY-MM-DD format
        """
        data = self._request(
            f"fixtures/date/{date}",
            {
                "include": "participants,scores,league,venue,state",
                "per_page": 100
            }
        )
        return data.get('data', [])
    
    def get_fixtures_between(self, start_date: str, end_date: str, 
                             league_id: int = None) -> List[dict]:
        """Tarih aralığındaki maçları getir"""
        params = {
            "include": "participants,scores,league",
            "per_page": 100
        }
        
        if league_id:
            params["filters"] = f"fixtureLeagues:{league_id}"
        
        data = self._request(f"fixtures/between/{start_date}/{end_date}", params)
        return data.get('data', [])
    
    def get_fixture_details(self, fixture_id: int) -> dict:
        """Tek maç detayları"""
        data = self._request(
            f"fixtures/{fixture_id}",
            {
                "include": "participants,scores,events,lineups,statistics,venue,state"
            }
        )
        return data.get('data', {})
    
    def get_live_scores(self) -> List[dict]:
        """Canlı maçlar"""
        data = self._request(
            "livescores/inplay",
            {
                "include": "participants,scores,events,league,state"
            }
        )
        return data.get('data', [])
    
    # ==================
    # STANDINGS
    # ==================
    
    def get_standings(self, season_id: int) -> List[dict]:
        """Puan durumu"""
        data = self._request(
            f"standings/seasons/{season_id}",
            {
                "include": "participant,details"
            }
        )
        return data.get('data', [])
    
    def get_live_standings(self, league_id: int) -> List[dict]:
        """Canlı puan durumu"""
        data = self._request(
            f"standings/live/leagues/{league_id}",
            {
                "include": "participant"
            }
        )
        return data.get('data', [])
    
    # ==================
    # TEAMS & PLAYERS
    # ==================
    
    def get_team(self, team_id: int) -> dict:
        """Takım detayları"""
        data = self._request(
            f"teams/{team_id}",
            {
                "include": "players,coaches,venue"
            }
        )
        return data.get('data', {})
    
    def get_team_statistics(self, team_id: int, season_id: int) -> dict:
        """Takım sezon istatistikleri"""
        data = self._request(
            f"statistics/seasons/teams/{team_id}",
            {
                "filters": f"seasonId:{season_id}"
            }
        )
        return data.get('data', {})
    
    # ==================
    # LEAGUES & SEASONS
    # ==================
    
    def get_leagues(self) -> List[dict]:
        """Tüm ligler"""
        data = self._request(
            "leagues",
            {
                "include": "currentSeason",
                "per_page": 100
            }
        )
        return data.get('data', [])
    
    def get_league(self, league_id: int) -> dict:
        """Lig detayları"""
        data = self._request(
            f"leagues/{league_id}",
            {
                "include": "currentSeason,seasons"
            }
        )
        return data.get('data', {})
    
    # ==================
    # XG DATA (Add-on gerekli)
    # ==================
    
    def get_xg_fixture(self, fixture_id: int) -> List[dict]:
        """Maç xG verisi"""
        try:
            data = self._request(
                f"expected/fixtures",
                {
                    "filters": f"fixtureId:{fixture_id}"
                }
            )
            return data.get('data', [])
        except:
            return []
    
    # ==================
    # PREDICTIONS (Add-on gerekli)
    # ==================
    
    def get_predictions(self, fixture_id: int) -> dict:
        """Maç tahminleri"""
        try:
            data = self._request(f"predictions/probabilities/fixtures/{fixture_id}")
            return data.get('data', {})
        except:
            return {}
    
    # ==================
    # HEAD TO HEAD
    # ==================
    
    def get_head_to_head(self, team1_id: int, team2_id: int) -> List[dict]:
        """İki takım arası geçmiş maçlar"""
        data = self._request(
            f"fixtures/head-to-head/{team1_id}/{team2_id}",
            {
                "include": "participants,scores",
                "per_page": 20
            }
        )
        return data.get('data', [])


# ============================================================
# DATA SERVICE (Flask routes için)
# ============================================================

class FootballDataService:
    """High-level data service for Flask API"""
    
    def __init__(self):
        self.client = SportmonksClient()
    
    def get_today_matches(self) -> dict:
        """Bugünkü maçlar"""
        today = datetime.now().strftime("%Y-%m-%d")
        matches = self.client.get_fixtures_by_date(today)
        
        return {
            "date": today,
            "total_matches": len(matches),
            "matches": self._format_matches(matches)
        }
    
    def get_live_matches(self) -> dict:
        """Canlı maçlar"""
        matches = self.client.get_live_scores()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "live_count": len(matches),
            "matches": self._format_live_matches(matches)
        }
    
    def get_league_fixtures(self, league: str, days: int = 7) -> dict:
        """Lig maçları (önümüzdeki X gün)"""
        league_id = config.LEAGUE_IDS.get(league.lower())
        if not league_id:
            return {"error": f"Unknown league: {league}"}
        
        start = datetime.now().strftime("%Y-%m-%d")
        end = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
        
        matches = self.client.get_fixtures_between(start, end, league_id)
        
        return {
            "league": league,
            "league_id": league_id,
            "period": f"{start} - {end}",
            "total_matches": len(matches),
            "matches": self._format_matches(matches)
        }
    
    def get_match_details(self, fixture_id: int) -> dict:
        """Maç detayları"""
        fixture = self.client.get_fixture_details(fixture_id)
        
        if not fixture:
            return {"error": "Fixture not found"}
        
        # xG varsa ekle
        xg = self.client.get_xg_fixture(fixture_id)
        
        return {
            "fixture": self._format_fixture_detail(fixture),
            "xg": xg
        }
    
    def get_standings(self, league: str) -> dict:
        """Puan durumu"""
        league_id = config.LEAGUE_IDS.get(league.lower())
        if not league_id:
            return {"error": f"Unknown league: {league}"}
        
        # Get current season
        league_data = self.client.get_league(league_id)
        current_season = league_data.get('currentSeason', {})
        season_id = current_season.get('id')
        
        if not season_id:
            return {"error": "Current season not found"}
        
        standings = self.client.get_standings(season_id)
        
        return {
            "league": league,
            "season": current_season.get('name', ''),
            "standings": self._format_standings(standings)
        }
    
    # ==================
    # FORMATTERS
    # ==================
    
    def _format_matches(self, matches: List[dict]) -> List[dict]:
        """Maç listesi formatla"""
        formatted = []
        for m in matches:
            participants = m.get('participants', [])
            scores = m.get('scores', [])
            
            home_team = next((p for p in participants if p.get('meta', {}).get('location') == 'home'), {})
            away_team = next((p for p in participants if p.get('meta', {}).get('location') == 'away'), {})
            
            home_score = next((s.get('score', {}).get('goals') for s in scores 
                              if s.get('description') == 'CURRENT' and s.get('score', {}).get('participant') == 'home'), None)
            away_score = next((s.get('score', {}).get('goals') for s in scores 
                              if s.get('description') == 'CURRENT' and s.get('score', {}).get('participant') == 'away'), None)
            
            formatted.append({
                "id": m.get('id'),
                "date": m.get('starting_at'),
                "home_team": home_team.get('name', ''),
                "home_team_id": home_team.get('id'),
                "away_team": away_team.get('name', ''),
                "away_team_id": away_team.get('id'),
                "home_score": home_score,
                "away_score": away_score,
                "state": m.get('state', {}).get('name', ''),
                "league": m.get('league', {}).get('name', ''),
                "venue": m.get('venue', {}).get('name', '')
            })
        
        return formatted
    
    def _format_live_matches(self, matches: List[dict]) -> List[dict]:
        """Canlı maç formatla"""
        formatted = self._format_matches(matches)
        
        for i, m in enumerate(matches):
            if i < len(formatted):
                formatted[i]['minute'] = m.get('minute', 0)
                formatted[i]['period'] = m.get('state', {}).get('name', '')
        
        return formatted
    
    def _format_fixture_detail(self, fixture: dict) -> dict:
        """Maç detay formatla"""
        base = self._format_matches([fixture])[0] if fixture else {}
        
        # Events
        events = []
        for e in fixture.get('events', []):
            events.append({
                "minute": e.get('minute'),
                "type": e.get('type', {}).get('name', ''),
                "player": e.get('player', {}).get('name', ''),
                "team_id": e.get('participant_id')
            })
        base['events'] = events
        
        # Statistics
        stats = {}
        for s in fixture.get('statistics', []):
            stat_name = s.get('type', {}).get('name', '')
            location = s.get('location', '')
            value = s.get('data', {}).get('value', 0)
            
            if stat_name not in stats:
                stats[stat_name] = {}
            stats[stat_name][location] = value
        base['statistics'] = stats
        
        return base
    
    def _format_standings(self, standings: List[dict]) -> List[dict]:
        """Puan durumu formatla"""
        formatted = []
        
        for group in standings:
            for row in group.get('standings', {}).get('data', []):
                details = {d.get('type', {}).get('name', ''): d.get('value') 
                          for d in row.get('details', [])}
                
                formatted.append({
                    "position": row.get('position'),
                    "team": row.get('participant', {}).get('name', ''),
                    "team_id": row.get('participant', {}).get('id'),
                    "played": details.get('Matches Played', 0),
                    "won": details.get('Won', 0),
                    "drawn": details.get('Draw', 0),
                    "lost": details.get('Lost', 0),
                    "goals_for": details.get('Goals For', 0),
                    "goals_against": details.get('Goals Against', 0),
                    "goal_diff": details.get('Goal Difference', 0),
                    "points": row.get('points', 0)
                })
        
        return sorted(formatted, key=lambda x: x['position'])


# ============================================================
# FLASK APP
# ============================================================

from flask import Flask, jsonify, request
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    service = FootballDataService()
    
    @app.route('/health')
    def health():
        api_health = service.client.health_check()
        return jsonify({
            "status": "ok",
            "environment": config.ENVIRONMENT,
            "sportmonks": api_health,
            "cache_ttl": config.CACHE_TTL_SECONDS
        })
    
    @app.route('/api/matches/today')
    def today_matches():
        return jsonify(service.get_today_matches())
    
    @app.route('/api/matches/live')
    def live_matches():
        return jsonify(service.get_live_matches())
    
    @app.route('/api/leagues/<league>/fixtures')
    def league_fixtures(league):
        days = request.args.get('days', 7, type=int)
        return jsonify(service.get_league_fixtures(league, days))
    
    @app.route('/api/leagues/<league>/standings')
    def league_standings(league):
        return jsonify(service.get_standings(league))
    
    @app.route('/api/matches/<int:fixture_id>')
    def match_details(fixture_id):
        return jsonify(service.get_match_details(fixture_id))
    
    @app.route('/api/leagues')
    def available_leagues():
        return jsonify({
            "leagues": list(config.LEAGUE_IDS.keys()),
            "ids": config.LEAGUE_IDS
        })
    
    return app


# ============================================================
# ENTRY POINT
# ============================================================

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = not config.IS_PRODUCTION
    
    logger.info(f"🚀 Starting FootballAnalytics API on port {port}")
    logger.info(f"📊 Environment: {config.ENVIRONMENT}")
    logger.info(f"🔑 Sportmonks Token: {'✅ Set' if config.SPORTMONKS_TOKEN else '❌ Not set'}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
