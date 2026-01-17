"""
Hibrit Futbol Veri Pipeline
============================
SoccerData + Sportmonks API birlikte çalıştırma

Her kaynağın güçlü yönlerini kullanarak:
- SoccerData: Tarihsel veri, xG şut koordinatları, ücretsiz
- Sportmonks: Canlı veri, güvenilirlik, geniş kapsam
"""

import os
import json
import time
import hashlib
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod

# ============================================================
# CONFIGURATION
# ============================================================

@dataclass
class Config:
    """Yapılandırma ayarları"""
    sportmonks_token: str = os.getenv("SPORTMONKS_API_TOKEN", "")
    cache_dir: str = "./data_cache"
    cache_ttl_hours: int = 24
    rate_limit_delay: float = 1.0  # saniye
    
    # Veri kaynağı öncelikleri
    PRIORITY_LIVE = "sportmonks"      # Canlı veri için
    PRIORITY_HISTORICAL = "soccerdata" # Tarihsel için
    PRIORITY_XG_SHOTS = "soccerdata"   # Şut koordinatları için
    PRIORITY_ODDS = "soccerdata"       # Tarihsel bahis oranları için

config = Config()

# ============================================================
# BASE DATA SOURCE CLASS
# ============================================================

class DataSource(ABC):
    """Veri kaynağı temel sınıfı"""
    
    def __init__(self, name: str):
        self.name = name
        self.cache_dir = os.path.join(config.cache_dir, name)
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def _cache_key(self, method: str, params: dict) -> str:
        """Cache anahtarı oluştur"""
        param_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(f"{method}:{param_str}".encode()).hexdigest()
    
    def _get_cache(self, key: str) -> Optional[pd.DataFrame]:
        """Cache'den veri al"""
        cache_file = os.path.join(self.cache_dir, f"{key}.parquet")
        meta_file = os.path.join(self.cache_dir, f"{key}.meta")
        
        if os.path.exists(cache_file) and os.path.exists(meta_file):
            with open(meta_file, 'r') as f:
                meta = json.load(f)
            
            cache_time = datetime.fromisoformat(meta['timestamp'])
            if datetime.now() - cache_time < timedelta(hours=config.cache_ttl_hours):
                return pd.read_parquet(cache_file)
        return None
    
    def _set_cache(self, key: str, data: pd.DataFrame):
        """Cache'e veri kaydet"""
        cache_file = os.path.join(self.cache_dir, f"{key}.parquet")
        meta_file = os.path.join(self.cache_dir, f"{key}.meta")
        
        data.to_parquet(cache_file)
        with open(meta_file, 'w') as f:
            json.dump({'timestamp': datetime.now().isoformat()}, f)
    
    @abstractmethod
    def get_fixtures(self, league: str, season: str) -> pd.DataFrame:
        pass
    
    @abstractmethod
    def get_team_stats(self, league: str, season: str) -> pd.DataFrame:
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        pass

# ============================================================
# SOCCERDATA SOURCE
# ============================================================

class SoccerDataSource(DataSource):
    """SoccerData kütüphanesi wrapper"""
    
    # Lig eşleştirme tablosu
    LEAGUE_MAPPING = {
        'premier-league': 'ENG-Premier League',
        'la-liga': 'ESP-La Liga',
        'bundesliga': 'GER-Bundesliga',
        'serie-a': 'ITA-Serie A',
        'ligue-1': 'FRA-Ligue 1',
        'super-lig': 'TUR-Süper Lig',
        'eredivisie': 'NED-Eredivisie',
    }
    
    def __init__(self):
        super().__init__("soccerdata")
        self._sd = None
    
    def _get_sd(self):
        """Lazy load soccerdata"""
        if self._sd is None:
            try:
                import soccerdata as sd
                self._sd = sd
            except ImportError:
                raise ImportError("soccerdata kurulu değil: pip install soccerdata")
        return self._sd
    
    def _map_league(self, league: str) -> str:
        """Lig adını SoccerData formatına çevir"""
        return self.LEAGUE_MAPPING.get(league.lower(), league)
    
    def is_available(self) -> bool:
        try:
            self._get_sd()
            return True
        except:
            return False
    
    def get_fixtures(self, league: str, season: str) -> pd.DataFrame:
        """Maç programı ve sonuçları"""
        cache_key = self._cache_key("fixtures", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        mapped_league = self._map_league(league)
        
        try:
            fbref = sd.FBref(mapped_league, season)
            df = fbref.read_schedule()
            df['source'] = 'soccerdata'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData fixtures hatası: {e}")
            return pd.DataFrame()
    
    def get_team_stats(self, league: str, season: str) -> pd.DataFrame:
        """Takım istatistikleri"""
        cache_key = self._cache_key("team_stats", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        mapped_league = self._map_league(league)
        
        try:
            fbref = sd.FBref(mapped_league, season)
            df = fbref.read_team_season_stats(stat_type="standard")
            df['source'] = 'soccerdata'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData team_stats hatası: {e}")
            return pd.DataFrame()
    
    def get_xg_data(self, league: str, season: str) -> pd.DataFrame:
        """xG verileri (Understat'tan)"""
        cache_key = self._cache_key("xg", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        mapped_league = self._map_league(league)
        
        try:
            understat = sd.Understat(mapped_league, season)
            df = understat.read_schedule()
            df['source'] = 'soccerdata_understat'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData xG hatası: {e}")
            return pd.DataFrame()
    
    def get_shot_data(self, league: str, season: str) -> pd.DataFrame:
        """Şut koordinatları (Şut haritaları için) - SADECE SOCCERDATA"""
        cache_key = self._cache_key("shots", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        mapped_league = self._map_league(league)
        
        try:
            understat = sd.Understat(mapped_league, season)
            df = understat.read_shot_events()
            df['source'] = 'soccerdata_understat'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData shots hatası: {e}")
            return pd.DataFrame()
    
    def get_odds_data(self, league: str, season: str) -> pd.DataFrame:
        """Tarihsel bahis oranları (Football-Data.co.uk)"""
        cache_key = self._cache_key("odds", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        mapped_league = self._map_league(league)
        
        try:
            fdata = sd.MatchHistory(mapped_league, season)
            df = fdata.read_games()
            df['source'] = 'soccerdata_footballdata'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData odds hatası: {e}")
            return pd.DataFrame()
    
    def get_elo_ratings(self) -> pd.DataFrame:
        """Güncel Elo ratings - SADECE SOCCERDATA"""
        cache_key = self._cache_key("elo", {"date": datetime.now().strftime("%Y-%m-%d")})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        sd = self._get_sd()
        
        try:
            elo = sd.ClubElo()
            df = elo.read_by_date()
            df['source'] = 'soccerdata_clubelo'
            self._set_cache(cache_key, df)
            return df
        except Exception as e:
            print(f"SoccerData elo hatası: {e}")
            return pd.DataFrame()

# ============================================================
# SPORTMONKS SOURCE
# ============================================================

class SportmonksSource(DataSource):
    """Sportmonks API wrapper"""
    
    BASE_URL = "https://api.sportmonks.com/v3/football"
    
    # Lig ID eşleştirme
    LEAGUE_IDS = {
        'premier-league': 8,
        'la-liga': 564,
        'bundesliga': 82,
        'serie-a': 384,
        'ligue-1': 301,
        'super-lig': 600,
        'eredivisie': 72,
        'champions-league': 2,
    }
    
    def __init__(self, api_token: str = None):
        super().__init__("sportmonks")
        self.api_token = api_token or config.sportmonks_token
    
    def is_available(self) -> bool:
        return bool(self.api_token)
    
    def _request(self, endpoint: str, params: dict = None) -> dict:
        """API isteği yap"""
        if not self.api_token:
            raise ValueError("Sportmonks API token gerekli")
        
        url = f"{self.BASE_URL}/{endpoint}"
        params = params or {}
        params['api_token'] = self.api_token
        
        time.sleep(config.rate_limit_delay)
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def _get_league_id(self, league: str) -> int:
        """Lig ID'si al"""
        return self.LEAGUE_IDS.get(league.lower(), 0)
    
    def get_fixtures(self, league: str, season: str) -> pd.DataFrame:
        """Maç programı ve sonuçları"""
        cache_key = self._cache_key("fixtures", {"league": league, "season": season})
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached
        
        league_id = self._get_league_id(league)
        if not league_id:
            return pd.DataFrame()
        
        try:
            data = self._request(
                f"fixtures",
                {
                    "filters": f"fixtureLeagues:{league_id}",
                    "include": "participants,scores,venue",
                    "per_page": 100
                }
            )
            
            fixtures = []
            for match in data.get('data', []):
                fixtures.append({
                    'fixture_id': match['id'],
                    'date': match['starting_at'],
                    'home_team': match.get('participants', [{}])[0].get('name', ''),
                    'away_team': match.get('participants', [{}])[1].get('name', '') if len(match.get('participants', [])) > 1 else '',
                    'home_score': match.get('scores', {}).get('localteam_score'),
                    'away_score': match.get('scores', {}).get('visitorteam_score'),
                    'venue': match.get('venue', {}).get('name', ''),
                    'source': 'sportmonks'
                })
            
            df = pd.DataFrame(fixtures)
            if not df.empty:
                self._set_cache(cache_key, df)
            return df
            
        except Exception as e:
            print(f"Sportmonks fixtures hatası: {e}")
            return pd.DataFrame()
    
    def get_team_stats(self, league: str, season: str) -> pd.DataFrame:
        """Takım istatistikleri"""
        # Sportmonks implementation
        return pd.DataFrame()  # Placeholder
    
    def get_live_scores(self) -> pd.DataFrame:
        """CANLI SKORLAR - SADECE SPORTMONKS"""
        try:
            data = self._request(
                "livescores/inplay",
                {"include": "participants,scores,events,statistics"}
            )
            
            matches = []
            for match in data.get('data', []):
                participants = match.get('participants', [])
                matches.append({
                    'fixture_id': match['id'],
                    'minute': match.get('minute', 0),
                    'home_team': participants[0].get('name', '') if participants else '',
                    'away_team': participants[1].get('name', '') if len(participants) > 1 else '',
                    'home_score': match.get('scores', {}).get('localteam_score', 0),
                    'away_score': match.get('scores', {}).get('visitorteam_score', 0),
                    'state': match.get('state', {}).get('name', ''),
                    'source': 'sportmonks_live'
                })
            
            return pd.DataFrame(matches)
            
        except Exception as e:
            print(f"Sportmonks live scores hatası: {e}")
            return pd.DataFrame()
    
    def get_xg_fixture(self, fixture_id: int) -> dict:
        """Maç xG verisi - SPORTMONKS (Add-on gerekli)"""
        try:
            data = self._request(
                f"fixtures/{fixture_id}",
                {"include": "xGFixture"}
            )
            return data.get('data', {}).get('expected', [])
        except Exception as e:
            print(f"Sportmonks xG hatası: {e}")
            return {}
    
    def get_predictions(self, fixture_id: int) -> dict:
        """Maç tahminleri - SADECE SPORTMONKS (Add-on)"""
        try:
            data = self._request(f"predictions/probabilities/fixtures/{fixture_id}")
            return data.get('data', {})
        except Exception as e:
            print(f"Sportmonks predictions hatası: {e}")
            return {}

# ============================================================
# HYBRID DATA MANAGER
# ============================================================

class HybridDataManager:
    """
    İki veri kaynağını akıllıca birleştiren manager
    
    Strateji:
    - Canlı veri → Sportmonks
    - Tarihsel veri → SoccerData (öncelikli, ücretsiz)
    - Şut koordinatları → SoccerData (Sportmonks'ta yok)
    - xG → Her ikisinden (karşılaştırma için)
    - Bahis oranları → SoccerData (tarihsel), Sportmonks (canlı)
    """
    
    def __init__(self, sportmonks_token: str = None):
        self.soccerdata = SoccerDataSource()
        self.sportmonks = SportmonksSource(sportmonks_token)
        
        # Availability check
        self.sd_available = self.soccerdata.is_available()
        self.sm_available = self.sportmonks.is_available()
        
        print(f"📊 Veri Kaynakları:")
        print(f"   SoccerData: {'✅ Aktif' if self.sd_available else '❌ Pasif'}")
        print(f"   Sportmonks: {'✅ Aktif' if self.sm_available else '❌ Pasif (Token gerekli)'}")
    
    # ==================
    # ANA VERİ METODLARI
    # ==================
    
    def get_fixtures(self, league: str, season: str, prefer: str = "auto") -> pd.DataFrame:
        """
        Maç verileri al
        
        prefer: "auto" | "soccerdata" | "sportmonks"
        """
        if prefer == "auto":
            # Önce SoccerData dene (ücretsiz)
            if self.sd_available:
                df = self.soccerdata.get_fixtures(league, season)
                if not df.empty:
                    return df
            
            # Fallback: Sportmonks
            if self.sm_available:
                return self.sportmonks.get_fixtures(league, season)
        
        elif prefer == "soccerdata" and self.sd_available:
            return self.soccerdata.get_fixtures(league, season)
        
        elif prefer == "sportmonks" and self.sm_available:
            return self.sportmonks.get_fixtures(league, season)
        
        return pd.DataFrame()
    
    def get_live_scores(self) -> pd.DataFrame:
        """Canlı skorlar - SADECE Sportmonks"""
        if not self.sm_available:
            print("⚠️ Canlı skorlar için Sportmonks token gerekli!")
            return pd.DataFrame()
        return self.sportmonks.get_live_scores()
    
    def get_xg_data(self, league: str, season: str, merge: bool = True) -> pd.DataFrame:
        """
        xG verileri al
        
        merge=True: Her iki kaynaktan al ve birleştir (karşılaştırma için)
        merge=False: Sadece SoccerData (ücretsiz)
        """
        sd_xg = pd.DataFrame()
        sm_xg = pd.DataFrame()
        
        if self.sd_available:
            sd_xg = self.soccerdata.get_xg_data(league, season)
        
        # Sportmonks xG için ek ücret gerekli, sadece merge=True ise dene
        # ve fixture bazlı çalışıyor
        
        return sd_xg if not sd_xg.empty else sm_xg
    
    def get_shot_map_data(self, league: str, season: str) -> pd.DataFrame:
        """
        Şut koordinatları (x, y) - SADECE SoccerData
        
        Sportmonks bu veriyi sağlamıyor!
        """
        if not self.sd_available:
            print("⚠️ Şut haritası için SoccerData gerekli!")
            return pd.DataFrame()
        return self.soccerdata.get_shot_data(league, season)
    
    def get_odds(self, league: str, season: str, live: bool = False) -> pd.DataFrame:
        """
        Bahis oranları
        
        live=False: Tarihsel oranlar (SoccerData - ücretsiz)
        live=True: Canlı oranlar (Sportmonks - ücretli)
        """
        if live:
            if not self.sm_available:
                print("⚠️ Canlı oranlar için Sportmonks token gerekli!")
                return pd.DataFrame()
            # Sportmonks live odds implementation
            return pd.DataFrame()
        else:
            if self.sd_available:
                return self.soccerdata.get_odds_data(league, season)
        return pd.DataFrame()
    
    def get_elo_ratings(self) -> pd.DataFrame:
        """Elo ratings - SADECE SoccerData"""
        if not self.sd_available:
            print("⚠️ Elo ratings için SoccerData gerekli!")
            return pd.DataFrame()
        return self.soccerdata.get_elo_ratings()
    
    def get_team_stats(self, league: str, season: str) -> pd.DataFrame:
        """Takım istatistikleri"""
        if self.sd_available:
            return self.soccerdata.get_team_stats(league, season)
        return pd.DataFrame()
    
    # ==================
    # YÜKSEK SEVİYE METODLAR
    # ==================
    
    def get_match_analysis(self, league: str, season: str, 
                           home_team: str, away_team: str) -> dict:
        """
        Tek bir maç için kapsamlı analiz
        Her iki kaynaktan veri birleştirir
        """
        analysis = {
            'home_team': home_team,
            'away_team': away_team,
            'league': league,
            'season': season,
            'data_sources': []
        }
        
        # 1. Takım istatistikleri (SoccerData)
        team_stats = self.get_team_stats(league, season)
        if not team_stats.empty:
            analysis['data_sources'].append('soccerdata_fbref')
            # Home team stats
            if home_team in team_stats.index:
                analysis['home_stats'] = team_stats.loc[home_team].to_dict()
            if away_team in team_stats.index:
                analysis['away_stats'] = team_stats.loc[away_team].to_dict()
        
        # 2. xG verileri (SoccerData/Understat)
        xg_data = self.get_xg_data(league, season)
        if not xg_data.empty:
            analysis['data_sources'].append('soccerdata_understat')
            # Filter for these teams
            home_xg = xg_data[xg_data['home_team'].str.contains(home_team, case=False, na=False)]
            away_xg = xg_data[xg_data['away_team'].str.contains(away_team, case=False, na=False)]
            
            if 'home_xg' in home_xg.columns:
                analysis['home_avg_xg'] = home_xg['home_xg'].mean()
            if 'away_xg' in away_xg.columns:
                analysis['away_avg_xg'] = away_xg['away_xg'].mean()
        
        # 3. Elo ratings (SoccerData/ClubElo)
        elo = self.get_elo_ratings()
        if not elo.empty:
            analysis['data_sources'].append('soccerdata_clubelo')
            if home_team in elo.index:
                analysis['home_elo'] = elo.loc[home_team, 'elo']
            if away_team in elo.index:
                analysis['away_elo'] = elo.loc[away_team, 'elo']
        
        # 4. Tarihsel bahis oranları (SoccerData)
        odds = self.get_odds(league, season)
        if not odds.empty:
            analysis['data_sources'].append('soccerdata_footballdata')
            # Son maçların oranlarını al
            relevant = odds[
                (odds['home_team'].str.contains(home_team, case=False, na=False)) |
                (odds['away_team'].str.contains(away_team, case=False, na=False))
            ]
            if not relevant.empty and 'B365H' in relevant.columns:
                analysis['historical_odds_sample'] = relevant[['date', 'home_team', 'away_team', 'B365H', 'B365D', 'B365A']].tail(5).to_dict('records')
        
        # 5. Canlı veriler (Sportmonks - varsa)
        if self.sm_available:
            live = self.get_live_scores()
            if not live.empty:
                analysis['data_sources'].append('sportmonks_live')
                # Check if this match is live
                live_match = live[
                    (live['home_team'].str.contains(home_team, case=False, na=False)) &
                    (live['away_team'].str.contains(away_team, case=False, na=False))
                ]
                if not live_match.empty:
                    analysis['live_data'] = live_match.iloc[0].to_dict()
        
        return analysis
    
    def build_prediction_features(self, league: str, season: str,
                                   home_team: str, away_team: str) -> dict:
        """
        ML modeli için özellik vektörü oluştur
        """
        features = {}
        
        # Team stats
        stats = self.get_team_stats(league, season)
        if not stats.empty:
            for col in ['goals', 'goals_against', 'xg', 'xga', 'wins', 'draws', 'losses']:
                if col in stats.columns:
                    if home_team in stats.index:
                        features[f'home_{col}'] = stats.loc[home_team, col]
                    if away_team in stats.index:
                        features[f'away_{col}'] = stats.loc[away_team, col]
        
        # Elo difference
        elo = self.get_elo_ratings()
        if not elo.empty:
            home_elo = elo.loc[home_team, 'elo'] if home_team in elo.index else 1500
            away_elo = elo.loc[away_team, 'elo'] if away_team in elo.index else 1500
            features['elo_diff'] = home_elo - away_elo
            features['home_elo'] = home_elo
            features['away_elo'] = away_elo
        
        # xG data
        xg = self.get_xg_data(league, season)
        if not xg.empty:
            home_matches = xg[xg['home_team'].str.contains(home_team, case=False, na=False)]
            away_matches = xg[xg['away_team'].str.contains(away_team, case=False, na=False)]
            
            if 'home_xg' in xg.columns:
                features['home_avg_xg_home'] = home_matches['home_xg'].mean() if not home_matches.empty else 0
                features['away_avg_xg_away'] = away_matches['away_xg'].mean() if not away_matches.empty else 0
        
        return features


# ============================================================
# USAGE EXAMPLE
# ============================================================

def main():
    """Örnek kullanım"""
    
    # Token varsa environment variable'dan al
    # export SPORTMONKS_API_TOKEN="your_token_here"
    
    print("=" * 60)
    print("HİBRİT FUTBOL VERİ SİSTEMİ")
    print("=" * 60)
    
    # Manager oluştur
    manager = HybridDataManager()
    
    print("\n" + "=" * 60)
    print("1. MAÇ VERİLERİ (SoccerData öncelikli)")
    print("=" * 60)
    
    fixtures = manager.get_fixtures('premier-league', '2023-2024')
    print(f"Toplam maç: {len(fixtures)}")
    if not fixtures.empty:
        print(fixtures.head(3))
    
    print("\n" + "=" * 60)
    print("2. TAKIM İSTATİSTİKLERİ")
    print("=" * 60)
    
    team_stats = manager.get_team_stats('premier-league', '2023-2024')
    if not team_stats.empty:
        print(team_stats.head())
    
    print("\n" + "=" * 60)
    print("3. xG VERİLERİ (Understat)")
    print("=" * 60)
    
    xg = manager.get_xg_data('premier-league', '2023-2024')
    if not xg.empty:
        print(xg.head(3))
    
    print("\n" + "=" * 60)
    print("4. ŞUT HARİTASI VERİLERİ (Sadece SoccerData)")
    print("=" * 60)
    
    shots = manager.get_shot_map_data('premier-league', '2023-2024')
    print(f"Toplam şut: {len(shots)}")
    if not shots.empty:
        print("Şut koordinatları mevcut ✅")
        print(shots.head(3))
    
    print("\n" + "=" * 60)
    print("5. ELO RATINGS (Sadece SoccerData)")
    print("=" * 60)
    
    elo = manager.get_elo_ratings()
    if not elo.empty:
        print("En yüksek Elo'ya sahip takımlar:")
        print(elo.sort_values('elo', ascending=False).head(10))
    
    print("\n" + "=" * 60)
    print("6. CANLI SKORLAR (Sadece Sportmonks)")
    print("=" * 60)
    
    live = manager.get_live_scores()
    if not live.empty:
        print(live)
    else:
        print("Canlı maç yok veya Sportmonks token gerekli")
    
    print("\n" + "=" * 60)
    print("7. MAÇ ANALİZİ (Hibrit)")
    print("=" * 60)
    
    analysis = manager.get_match_analysis(
        'premier-league', '2023-2024',
        'Manchester City', 'Arsenal'
    )
    print(f"Kullanılan veri kaynakları: {analysis['data_sources']}")
    print(f"Home Elo: {analysis.get('home_elo', 'N/A')}")
    print(f"Away Elo: {analysis.get('away_elo', 'N/A')}")
    
    print("\n" + "=" * 60)
    print("8. TAHMİN ÖZELLİKLERİ (ML için)")
    print("=" * 60)
    
    features = manager.build_prediction_features(
        'premier-league', '2023-2024',
        'Manchester City', 'Arsenal'
    )
    print("Feature vector:")
    for k, v in features.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
