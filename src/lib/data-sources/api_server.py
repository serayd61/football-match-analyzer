"""
Flask API Server for SoccerData Integration
===========================================
Python servisi olarak çalışır, TypeScript'ten çağrılır
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from hybrid_pipeline import HybridDataManager
import os
import pandas as pd

app = Flask(__name__)
CORS(app)  # CORS hatası önlemek için

# Manager oluştur
sportmonks_token = os.getenv("SPORTMONKS_API_TOKEN", "")
manager = HybridDataManager(sportmonks_token)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'soccerdata-api',
        'sources': {
            'soccerdata': manager.sd_available,
            'sportmonks': manager.sm_available
        }
    })

@app.route('/api/fixtures/<league>/<season>', methods=['GET'])
def get_fixtures(league, season):
    """Maç verileri al"""
    try:
        prefer = request.args.get('prefer', 'auto')
        df = manager.get_fixtures(league, season, prefer=prefer)
        
        if df.empty:
            return jsonify({
                'success': False,
                'error': 'No fixtures found',
                'data': []
            }), 404
        
        # DataFrame'i dict listesine çevir
        fixtures = []
        for _, row in df.iterrows():
            fixture = {
                'fixtureId': int(row.get('fixture_id', 0)) if 'fixture_id' in row else 0,
                'date': str(row.get('date', '')),
                'homeTeam': str(row.get('home_team', '')),
                'awayTeam': str(row.get('away_team', '')),
                'homeScore': int(row.get('home_score', 0)) if pd.notna(row.get('home_score')) else None,
                'awayScore': int(row.get('away_score', 0)) if pd.notna(row.get('away_score')) else None,
                'venue': str(row.get('venue', '')) if 'venue' in row else None,
                'source': str(row.get('source', 'soccerdata'))
            }
            fixtures.append(fixture)
        
        return jsonify({
            'success': True,
            'count': len(fixtures),
            'source': 'soccerdata',
            'data': fixtures
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/xg/<league>/<season>', methods=['GET'])
def get_xg(league, season):
    """xG verileri al"""
    try:
        df = manager.get_xg_data(league, season)
        
        if df.empty:
            return jsonify({
                'success': False,
                'error': 'No xG data found',
                'data': []
            }), 404
        
        xg_data = df.to_dict('records')
        return jsonify({
            'success': True,
            'count': len(xg_data),
            'source': 'soccerdata',
            'data': xg_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/shots/<league>/<season>', methods=['GET'])
def get_shots(league, season):
    """Şut koordinatları al"""
    try:
        df = manager.get_shot_map_data(league, season)
        
        if df.empty:
            return jsonify({
                'success': False,
                'error': 'No shot data found',
                'data': []
            }), 404
        
        shots = df.to_dict('records')
        return jsonify({
            'success': True,
            'count': len(shots),
            'source': 'soccerdata',
            'data': shots
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/elo', methods=['GET'])
def get_elo():
    """Elo ratings al"""
    try:
        df = manager.get_elo_ratings()
        
        if df.empty:
            return jsonify({
                'success': False,
                'error': 'No Elo data found',
                'data': []
            }), 404
        
        elo = df.to_dict('records')
        return jsonify({
            'success': True,
            'count': len(elo),
            'source': 'soccerdata',
            'data': elo
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    import pandas as pd  # Import here to avoid issues
    import socket
    
    # Port 5000 kullanımda ise 5001'e geç
    def find_free_port(start_port=5000):
        port = start_port
        while port < start_port + 10:  # Max 10 port dene
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('', port))
                    return port
            except OSError:
                port += 1
        return start_port  # Fallback
    
    default_port = int(os.getenv('PORT', 5000))
    port = find_free_port(default_port)
    
    if port != default_port:
        print(f"⚠️  Port {default_port} kullanımda, port {port} kullanılıyor")
    
    print(f"🚀 Starting SoccerData API server on port {port}")
    print(f"📊 SoccerData: {'✅ Available' if manager.sd_available else '❌ Not available'}")
    print(f"📊 Sportmonks: {'✅ Available' if manager.sm_available else '❌ Not available'}")
    print(f"🌐 URL: http://localhost:{port}")
    print(f"💚 Health check: http://localhost:{port}/health")
    app.run(host='0.0.0.0', port=port, debug=True)
