#!/usr/bin/env bash
# ============================================================================
# xG-DC Hetzner KURULUM (tek sefer). venv + soccerdata + env şablonu + dry-run test.
# Kullanım:  bash scripts/setup-xg-hetzner.sh
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
VENVDIR="$REPO/src/lib/data-sources/venv"
PY="$VENVDIR/bin/python"
ENVF="$REPO/engine/.xg-env"
export SOCCERDATA_DIR="${SOCCERDATA_DIR:-/opt/soccerdata}"

echo "📁 Repo: $REPO"

# 1) venv + bağımlılıklar
if [ ! -x "$PY" ]; then
  echo "🐍 venv oluşturuluyor..."
  python3 -m venv "$VENVDIR"
fi
echo "📦 soccerdata + pandas + numpy kuruluyor..."
"$VENVDIR/bin/pip" install -q --upgrade pip
"$VENVDIR/bin/pip" install -q soccerdata pandas numpy

# 2) soccerdata cache dizini
mkdir -p "$SOCCERDATA_DIR"
echo "🗂️  SOCCERDATA_DIR=$SOCCERDATA_DIR"

# 3) gizli env dosyası (yoksa şablon)
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<EOF
SUPABASE_URL=https://njrpxhmdqadejjarizmj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=BURAYA_SERVICE_ROLE_KEY_YAPISTIR
SOCCERDATA_DIR=$SOCCERDATA_DIR
EOF
  chmod 600 "$ENVF"
  echo "⚠️  Oluşturuldu: $ENVF"
  echo "    → Supabase Dashboard → Project Settings → API → 'service_role' secret'ini kopyalayıp"
  echo "      bu dosyadaki SUPABASE_SERVICE_ROLE_KEY satırına yapıştır."
else
  echo "✅ Env dosyası zaten var: $ENVF"
fi

# 4) DRY-RUN test (DB'ye YAZMAZ)
echo ""
echo "🧪 DRY-RUN test (yazmaz, 5 lig kapsama+parite):"
cd "$REPO/engine"
SOCCERDATA_DIR="$SOCCERDATA_DIR" "$PY" publish_xg.py 2>&1 \
  | grep -E "PL:|PD:|SA:|BL1:|FL1:|EŞLEŞMEYEN|Çıktı" || true

echo ""
echo "✅ Kurulum bitti."
echo "   Sıradaki: (a) $ENVF içine service_role key'i yaz,"
echo "            (b) gerçek yazımı test et:  bash scripts/run-xg-fit.sh"
echo "            (c) cron ekle (README/docs)."
