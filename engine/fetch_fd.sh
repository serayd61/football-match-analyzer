#!/usr/bin/env bash
# football-data.co.uk CSV'lerini repo içine indirir (sandbox'ın ağı yok; bunu Mac'te çalıştır).
# Kullanım: bash engine/fetch_fd.sh            → engine/.cache/ffdata/<LIG>_<SEZON>.csv
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)/.cache/ffdata"; mkdir -p "$DIR"
LEAGUES="${LEAGUES:-E0 SP1 I1 D1 F1 N1 P1 E1 T1}"
SEASONS="${SEASONS:-1920 2021 2122 2223 2324 2425 2526}"
for L in $LEAGUES; do for S in $SEASONS; do
  f="$DIR/${L}_${S}.csv"
  if [ -s "$f" ] && [ "$S" != "2526" ]; then continue; fi
  curl -fsSL -A "Mozilla/5.0" "https://www.football-data.co.uk/mmz4281/$S/$L.csv" -o "$f" && echo "ok  $L $S ($(wc -l < "$f") satır)" || echo "YOK $L $S"
done; done
echo "bitti → $DIR"
