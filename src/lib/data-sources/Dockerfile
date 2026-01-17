FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Sadece Python dosyalarını kopyala (Next.js dosyalarını ignore et)
COPY requirements.txt .
COPY hybrid_pipeline.py .
COPY api_server.py .

# Debug: requirements.txt içeriğini göster ve dosya varlığını kontrol et
RUN echo "=== PWD ===" && pwd && \
    echo "=== LS ===" && ls -la && \
    echo "=== requirements.txt içeriği ===" && \
    if [ -f requirements.txt ]; then \
        cat requirements.txt && \
        echo "=== Dosya boyutu ===" && \
        wc -l requirements.txt; \
    else \
        echo "❌ requirements.txt BULUNAMADI!" && \
        exit 1; \
    fi && \
    echo "=== Son ==="

# Python bağımlılıklarını kur
RUN pip install --no-cache-dir -r requirements.txt

# Port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Servisi başlat
CMD ["python", "api_server.py"]
