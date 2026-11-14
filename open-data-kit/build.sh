#!/usr/bin/env bash
# Assemble the public dataset repository from this kit.
#
#   ./build.sh OWNER/REPO [OUT_DIR]
#
# Copies the repository files to OUT_DIR (default: ./dist), fills in the
# repository name, downloads the current data and builds the statistics block.
# OUT_DIR is then ready for `git init` + push, and holds the Kaggle and
# Hugging Face upload folders. Nothing is published by this script.
set -euo pipefail

REPO="${1:?usage: build.sh OWNER/REPO [OUT_DIR]}"
KIT="$(cd "$(dirname "$0")" && pwd)"
OUT="${2:-$KIT/dist}"
GITHUB_URL="https://github.com/$REPO"

rm -rf "$OUT"
mkdir -p "$OUT/repo" "$OUT/kaggle" "$OUT/huggingface"

# 1. GitHub repository
cp "$KIT/README.md" "$KIT/LICENSE" "$KIT/CITATION.cff" "$KIT/.zenodo.json" "$OUT/repo/"
cp -R "$KIT/scripts" "$KIT/examples" "$KIT/.github" "$OUT/repo/"
sed -i.bak "s#OWNER/REPO#$REPO#g" "$OUT/repo/README.md" && rm "$OUT/repo/README.md.bak"
python3 "$OUT/repo/scripts/refresh.py"

# 2. Kaggle upload folder (kaggle datasets create -p dist/kaggle)
cp "$OUT/repo/data/all.csv" "$OUT/kaggle/"
sed "s#GITHUB_URL#$GITHUB_URL#g" "$KIT/kaggle/dataset-metadata.json" > "$OUT/kaggle/dataset-metadata.json"

# 3. Hugging Face upload folder (README.md is the dataset card)
mkdir -p "$OUT/huggingface/data"
cp "$OUT/repo/data/all.csv" "$OUT/huggingface/data/"
sed "s#<GITHUB_URL>#<$GITHUB_URL>#g" "$KIT/huggingface/README.md" > "$OUT/huggingface/README.md"

echo "Built $OUT"
