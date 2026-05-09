#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.sample ]; then
  echo ".env.sample not found in repo root" >&2
  exit 2
fi

if [ ! -f .env ]; then
  cp .env.sample .env
  echo "Created .env from .env.sample (edit credentials before running)."
else
  echo ".env already exists; not overwriting."
fi

if [ "${1:-}" = "install-deps" ]; then
  if [ -f .venv/bin/activate ]; then
    echo "Using existing .venv"
  else
    python3 -m venv .venv
  fi
  . .venv/bin/activate
  pip install --upgrade pip
  pip install -r services/extraction_service/requirements.txt
fi

if [ "${2:-}" = "start-infra" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found; install Docker to start infra" >&2
    exit 3
  fi
  docker compose up -d
fi

echo "Setup complete. Edit .env with credentials before running the pipeline."
