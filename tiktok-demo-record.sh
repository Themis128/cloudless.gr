#!/usr/bin/env bash
set -euo pipefail

cd /workspace

export NEXT_PUBLIC_E2E=1
export E2E_ADMIN_TOKEN=e2e-admin-token-do-not-use-in-prod

mkdir -p /out

node node_modules/next/dist/bin/next dev --port 4010 --hostname 0.0.0.0 &
NEXT_PID=$!

cleanup() {
  kill $NEXT_PID 2>/dev/null || true
  wait $NEXT_PID 2>/dev/null || true
}
trap cleanup EXIT

node /workspace/tiktok-demo-record.mjs
