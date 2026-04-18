#!/usr/bin/env bash
set -euo pipefail

sample=".env.sample"
target=".env"

if [ ! -f "$sample" ]; then
  echo ".env.sample not found in $(pwd)" >&2
  exit 2
fi

if [ -f "$target" ]; then
  read -r -p ".env already exists — overwrite? (y/N) " ans
  case "$ans" in
    y|Y) ;;
    *) echo "Aborted; .env unchanged."; exit 0 ;;
  esac
fi

cp "$sample" "$target"
echo "Copied .env.sample -> .env"
