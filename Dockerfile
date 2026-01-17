# FootballAnalytics.pro - Railway Dockerfile
# ==========================================

FROM python:3.11-slim

# Timezone
ENV TZ=Europe/Istanbul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Working directory
WORKDIR /app

# System dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Environment
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV RAILWAY_ENVIRONMENT=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run with gunicorn
CMD gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120 railway_app:app
