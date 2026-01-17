#!/bin/bash

# Python servisinin hangi port'ta çalıştığını bul

for port in 5000 5001 5002 5003 5004; do
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ Python servisi port $port'da çalışıyor"
        echo "   URL: http://localhost:$port"
        echo "   Health: http://localhost:$port/health"
        exit 0
    fi
done

echo "❌ Python servisi bulunamadı (5000-5004 portları kontrol edildi)"
echo "   Servisi başlat: cd src/lib/data-sources && source venv/bin/activate && python api_server.py"
