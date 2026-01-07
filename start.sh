#!/usr/bin/env bash
set -euo pipefail

# Railpack entry: build and serve frontend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/frontend"

export NODE_ENV=production

npm install --no-audit --no-fund
npm run build

PORT="${PORT:-10000}"
exec npm run preview -- --port "${PORT}" --host

