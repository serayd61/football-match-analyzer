#!/bin/bash

# Python Servisi Başlatma Script'i
# ===================================

cd "$(dirname "$0")"

# Virtual environment'ı aktif et
if [ ! -d "venv" ]; then
    echo "📦 Virtual environment oluşturuluyor..."
    python3 -m venv venv
fi

echo "🔌 Virtual environment aktif ediliyor..."
source venv/bin/activate

# Kütüphaneleri kontrol et ve kur
echo "📚 Kütüphaneler kontrol ediliyor..."
pip install -q -r requirements.txt

# Environment variable kontrolü
if [ -z "$SPORTMONKS_API_TOKEN" ]; then
    echo "⚠️  UYARI: SPORTMONKS_API_TOKEN environment variable ayarlanmamış!"
    echo "   Şu komutu çalıştır: export SPORTMONKS_API_TOKEN='your_token_here'"
    echo ""
fi

# Servisi başlat
echo "🚀 Python servisi başlatılıyor..."
echo "   URL: http://localhost:5000"
echo "   Health check: http://localhost:5000/health"
echo ""
echo "   Durdurmak için: Ctrl+C"
echo ""

python api_server.py
