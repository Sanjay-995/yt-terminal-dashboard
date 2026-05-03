#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env.local if present
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export PORT="${PORT:-3001}"

exec pnpm --filter @workspace/api-server run dev
