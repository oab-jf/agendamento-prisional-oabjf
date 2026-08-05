#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/public"
curl -L --fail "https://central.juizdefora-oabmg.org.br/oab-logo.png" -o "$ROOT/public/oab-logo.png"
curl -L --fail "https://central.juizdefora-oabmg.org.br/favicon.png" -o "$ROOT/public/favicon.png"
echo "Assets baixados para public/."
