FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Python bağımlılıklarını kopyala ve kur
COPY requirements.txt .
# Debug: requirements.txt içeriğini göster
RUN echo "=== requirements.txt içeriği ===" && cat requirements.txt && echo "=== Son ==="
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyalarını kopyala
COPY hybrid_pipeline.py .
COPY api_server.py .

# Port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Servisi başlat
CMD ["python", "api_server.py"]
