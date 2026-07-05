#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/tbaltzakis/cloudless.gr"
cd "$PROJECT_DIR"

PATCH_FILE="${1:-}"
AUTO_COMMIT="${AUTO_COMMIT:-0}"
RUN_TYPES="${RUN_TYPES:-0}"

if [ -z "$PATCH_FILE" ]; then
  PATCH_FILE="$(ls -t patches/coding-agent/*.patch 2>/dev/null | head -n1 || true)"
fi

if [ -z "$PATCH_FILE" ]; then
  echo "No saved patch found in patches/coding-agent/"
  exit 1
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "Patch file does not exist: $PATCH_FILE"
  exit 1
fi

echo "==> Patch file: $PATCH_FILE"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to apply patch because working tree is not clean."
  echo
  git status --short
  exit 2
fi

echo "==> Checking patch applies cleanly..."
git apply --check "$PATCH_FILE"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BRANCH="agentic/apply-$TIMESTAMP"

echo "==> Creating branch: $BRANCH"
git checkout -b "$BRANCH"

rollback() {
  echo
  echo "❌ Failure detected. Rolling back working tree on branch $BRANCH..."
  git reset --hard HEAD
  echo "Rolled back. You are still on branch $BRANCH."
}

trap rollback ERR

echo "==> Applying patch..."
git apply "$PATCH_FILE"

echo "==> Current diff:"
git diff --stat

if [ "$RUN_TYPES" = "1" ]; then
  echo "==> Running cf:types..."
  pnpm run cf:types

  python3 - <<'PY'
from pathlib import Path

p = Path("worker-configuration.d.ts")
if p.exists():
    p.write_text("\n".join(line.rstrip() for line in p.read_text().splitlines()) + "\n")
PY
fi

echo "==> Running cf:typecheck..."
pnpm run cf:typecheck

trap - ERR

echo
echo "✅ Patch applied and typecheck passed."
echo "Branch: $BRANCH"
echo

if [ "$AUTO_COMMIT" = "1" ]; then
  echo "==> Auto-committing..."
  git add -A
  git commit -m "Apply structured CodingAgent patch"
  echo
  echo "✅ Commit created."
else
  echo "Patch is applied but NOT committed."
  echo
  echo "Review with:"
  echo "  git diff"
  echo
  echo "If good:"
  echo "  git add -A"
  echo "  git commit -m \"Apply structured CodingAgent patch\""
fi

echo
echo "Optional after review:"
echo "  pnpm run cf:deploy"
echo "  git push -u origin $BRANCH"
