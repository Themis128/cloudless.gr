#!/usr/bin/env bash
# Clean dev server restart — handles port conflicts, stale Turbopack cache,
# missing .env.local, and waits for the server to actually be ready.
#
# Usage: bash scripts/dev-server-restart.sh [--clean]
#   --clean: also delete .next/ and tmp/ before restart

set -euo pipefail

REPO="/home/tbaltzakis/cloudless.gr"
PORT=4000
CLEAN=${1:-}

cd "$REPO"

echo "==> Killing anything on port ${PORT}..."
fuser -k "${PORT}/tcp" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

if [ "$CLEAN" = "--clean" ]; then
  echo "==> Clearing Turbopack/Next cache..."
  rm -rf "${REPO}/.next" "${REPO}/tmp"
fi

# Verify .env.local exists with the critical vars
if [ ! -f "${REPO}/.env.local" ]; then
  echo "==> .env.local missing — creating from .dev.vars.example..."
  if [ -f "${REPO}/.dev.vars.example" ]; then
    cp "${REPO}/.dev.vars.example" "${REPO}/.env.local"
    # Ensure AUTH_URL points to the correct dev port
    if ! grep -q "AUTH_URL" "${REPO}/.env.local" 2>/dev/null; then
      echo "AUTH_URL=http://localhost:${PORT}" >> "${REPO}/.env.local"
    fi
    if ! grep -q "AUTH_TRUST_HOST" "${REPO}/.env.local" 2>/dev/null; then
      echo "AUTH_TRUST_HOST=true" >> "${REPO}/.env.local"
    fi
    echo "    Created .env.local from .dev.vars.example"
    echo "    Edit it to set AUTH_SECRET, SESSION_SECRET, and other secrets"
  else
    echo "    WARNING: No .env.local and no .dev.vars.example found"
    echo "    Create .env.local with at least:"
    echo "      AUTH_SECRET=<random-32-byte-string>"
    echo "      AUTH_TRUST_HOST=true"
    echo "      AUTH_URL=http://localhost:${PORT}"
    echo "      SESSION_SECRET=<random-32-byte-string>"
  fi
fi

echo "==> Memory check..."
AVAIL=$(free -m | awk '/^Mem:/ {print $7}')
echo "    Available: ${AVAIL} MB"
if [ "$AVAIL" -lt 1500 ]; then
  echo "    WARN: < 1.5 GB available. Consider stopping Tabby/other heavy processes."
fi

echo "==> Starting dev server..."
nohup pnpm dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
echo "    PID: ${DEV_PID}"
echo "    Logs: tail -f /tmp/dev-server.log"

echo "==> Waiting for /api/health (max 30s)..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:${PORT}/api/health" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "    Ready after ${i}s"
    break
  fi
  sleep 1
done

echo ""
echo "==> Status:"
curl -s "http://localhost:${PORT}/api/health" | python3 -m json.tool 2>/dev/null || echo "Health check failed"

echo ""
echo "==> URLs:"
WSL_IP=$(ip -4 addr show eth0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -1)
echo "    From WSL:     http://localhost:${PORT}"
echo "    From Windows: http://${WSL_IP}:${PORT}  (always works)"
echo "                  http://localhost:${PORT}  (if mirrored mode active)"
