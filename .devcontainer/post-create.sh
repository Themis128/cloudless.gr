#!/usr/bin/env bash
set -euo pipefail
echo "==> Installing dependencies (frozen lockfile)..."
pnpm install --frozen-lockfile
echo "==> Dev container ready."
