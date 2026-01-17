#!/bin/bash

# Railway Deployment Script
# ========================

echo "🚀 Railway Deployment Başlatılıyor..."
echo ""

# Railway CLI kontrolü
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI kurulu değil!"
    echo ""
    echo "Kurulum için:"
    echo "  npm i -g @railway/cli"
    echo "  railway login"
    echo ""
    exit 1
fi

# Railway login kontrolü
if ! railway whoami &> /dev/null; then
    echo "⚠️  Railway'a giriş yapılmamış!"
    echo ""
    echo "Giriş yapmak için:"
    echo "  railway login"
    echo ""
    exit 1
fi

echo "✅ Railway CLI hazır"
echo ""

# Proje oluştur
echo "📦 Railway projesi oluşturuluyor..."
railway init

# Environment variables
echo ""
echo "🔐 Environment variables ayarlanıyor..."
echo ""

read -p "SPORTMONKS_API_TOKEN'ı gir: " SPORTMONKS_TOKEN
railway variables set SPORTMONKS_API_TOKEN="$SPORTMONKS_TOKEN"

read -p "PORT (default: 5000): " PORT
PORT=${PORT:-5000}
railway variables set PORT="$PORT"

# Deploy
echo ""
echo "🚀 Deploy başlatılıyor..."
railway up

# Public URL al
echo ""
echo "🌐 Public URL alınıyor..."
PUBLIC_URL=$(railway domain 2>/dev/null || railway status | grep -oP 'https://[^\s]+' | head -1)

if [ -z "$PUBLIC_URL" ]; then
    echo "⚠️  Public URL otomatik alınamadı"
    echo "   Railway dashboard'dan manuel olarak alabilirsin"
else
    echo ""
    echo "✅ Deploy tamamlandı!"
    echo ""
    echo "📋 Sonraki Adımlar:"
    echo ""
    echo "1. Vercel Dashboard'a git:"
    echo "   https://vercel.com/dashboard"
    echo ""
    echo "2. Project → Settings → Environment Variables"
    echo ""
    echo "3. Yeni variable ekle:"
    echo "   Name:  PYTHON_DATA_SERVICE_URL"
    echo "   Value: $PUBLIC_URL"
    echo ""
    echo "4. Deploy'u yeniden başlat"
    echo ""
    echo "5. Test et:"
    echo "   curl \"https://footballanalytics.pro/api/test-data-sources?league=premier-league&test=fixtures\""
    echo ""
fi
