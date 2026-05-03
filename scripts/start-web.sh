#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export PORT="${PORT:-3000}"
export BASE_PATH="${BASE_PATH:-/}"

exec pnpm --filter @workspace/data-app run dev
