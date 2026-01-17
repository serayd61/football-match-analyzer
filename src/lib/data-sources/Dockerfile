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
    echo "=== requirements.txt varlık kontrolü ===" && \
    ls -lh requirements.txt 2>&1 || echo "❌ requirements.txt BULUNAMADI!" && \
    echo "=== requirements.txt içeriği ===" && \
    cat requirements.txt && \
    echo "=== Dosya boyutu (satır sayısı) ===" && \
    wc -l requirements.txt && \
    echo "=== Dosya boyutu (byte) ===" && \
    wc -c requirements.txt && \
    echo "=== Son ==="

# Python bağımlılıklarını kur
RUN echo "=== Pip install başlıyor ===" && \
    pip install --no-cache-dir --upgrade pip setuptools wheel && \
    echo "=== Pip güncellendi ===" && \
    echo "=== requirements.txt içeriği ===" && \
    cat requirements.txt && \
    echo "=== Pip install başlıyor (verbose mode) ===" && \
    pip install --no-cache-dir -v -r requirements.txt 2>&1 || (echo "❌ Pip install BAŞARISIZ!" && cat /tmp/pip-error.log 2>/dev/null || true && exit 1) && \
    echo "=== Pip install tamamlandı ===" && \
    echo "=== Kurulu paketler ===" && \
    pip list && \
    echo "=== Flask kontrol ===" && \
    python -c "import flask; print(f'Flask version: {flask.__version__}')" && \
    echo "=== Tüm paketler kuruldu ==="

# Port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Servisi başlat
CMD ["python", "api_server.py"]
