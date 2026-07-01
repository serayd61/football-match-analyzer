#!/usr/bin/env bash
# ============================================================================
# xG-DC haftalık çalıştırma (cron bunu çağırır). Env dosyasını yükler, --write yapar.
# Kullanım:  bash scripts/run-xg-fit.sh
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
ENVF="$REPO/engine/.xg-env"
PY="$REPO/src/lib/data-sources/venv/bin/python"

# gizli env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SOCCERDATA_DIR)
if [ -f "$ENVF" ]; then
  set -a; . "$ENVF"; set +a
fi
export SOCCERDATA_DIR="${SOCCERDATA_DIR:-/opt/soccerdata}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ "${SUPABASE_SERVICE_ROLE_KEY:-}" = "BURAYA_SERVICE_ROLE_KEY_YAPISTIR" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY tanımlı değil ($ENVF). Kurulumu tamamla."
  exit 1
fi

echo "[$(date -u +%FT%TZ)] xG-fit başlıyor"
cd "$REPO/engine"
"$PY" publish_xg.py --write
echo "[$(date -u +%FT%TZ)] xG-fit bitti"

# ELO snapshot (Faz 2) — team_elo tablosuna güncel Club Elo + eşleme
echo "[$(date -u +%FT%TZ)] ELO-snapshot başlıyor"
"$PY" publish_elo.py --write
echo "[$(date -u +%FT%TZ)] ELO-snapshot bitti"
