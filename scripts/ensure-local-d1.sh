#!/usr/bin/env bash
# Create / migrate the wrangler local user-auth-db sqlite used by `next dev`.
# AUTH_DB must be bound for local health to be "ok" (dbConnected: true).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WRANGLER="$ROOT/node_modules/.bin/wrangler"
if [[ ! -x "$WRANGLER" ]]; then
  echo "[d1] missing $WRANGLER — run pnpm install" >&2
  exit 1
fi

echo "[d1] applying local migrations for user-auth-db"
if ! "$WRANGLER" d1 migrations apply user-auth-db --local --config wrangler.jsonc; then
  echo "[d1] wrangler d1 migrations apply --local failed" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
root = Path(".").resolve()
dirs = [
    root / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
    root / ".wrangler/state/d1",
]
found = []
for d in dirs:
    if not d.is_dir():
        continue
    for p in d.glob("*.sqlite"):
        if p.name == "metadata.sqlite":
            continue
        found.append((p.stat().st_size, p))
if not found:
    raise SystemExit("[d1] no local user-auth-db sqlite after migrations")
found.sort(reverse=True)
print(f"[d1] local sqlite ready: {found[0][1]} ({found[0][0]} bytes)")
PY
