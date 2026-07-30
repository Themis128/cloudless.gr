#!/usr/bin/env bash
# db-d1-pull.sh — export Cloudflare D1 databases to .local/db/*.sqlite for SQLTools.
#
# D1 has no TCP endpoint SQLTools can open. This pulls a remote snapshot via
# `wrangler d1 export`, then loads it into a local SQLite file.
#
# Usage:
#   bash scripts/db-d1-pull.sh              # all known D1 DBs
#   bash scripts/db-d1-pull.sh user-auth-db
#   bash scripts/db-d1-pull.sh auth-db-preview
#   bash scripts/db-d1-pull.sh cloudless-auth
#
# Docs: Cloudflare D1 → SQLTools
#
# See docs/databases/ (folder index + omv-cluster.md).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.local/db"
mkdir -p "$OUT"

# name → used as both wrangler D1 name and local basename
ALL_DBS=(
  "user-auth-db"
  "auth-db-preview"
  "cloudless-auth"
)

need_wrangler() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found" >&2
    exit 1
  fi
}

sql_to_sqlite() {
  local sql_path="$1" sqlite_path="$2"
  python3 - "$sql_path" "$sqlite_path" <<'PY'
import sqlite3, sys
from pathlib import Path

sql_path = Path(sys.argv[1])
sqlite_path = Path(sys.argv[2])
sql = sql_path.read_text(encoding="utf-8", errors="replace").strip()
if sqlite_path.exists():
    sqlite_path.unlink()
con = sqlite3.connect(str(sqlite_path))
try:
    if sql:
        con.executescript(sql)
    else:
        con.execute("PRAGMA user_version = 1")
    con.commit()
finally:
    con.close()
# ensure non-empty file even for schema-less dumps
con = sqlite3.connect(str(sqlite_path))
con.execute("PRAGMA user_version = 1")
con.commit()
n = con.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
con.close()
print(f"→ {sqlite_path} ({n} tables, {sqlite_path.stat().st_size} bytes)")
PY
}

pull_one() {
  local name="$1"
  local sql_path="$OUT/${name}.sql"
  local sqlite_path="$OUT/${name}.sqlite"
  echo "exporting D1 ${name} (remote) …"
  (
    cd "$ROOT"
    pnpm exec wrangler d1 export "$name" --remote --output "$sql_path" -y
  )
  echo "loading into SQLite …"
  sql_to_sqlite "$sql_path" "$sqlite_path"
}

need_wrangler

if [[ "${1:-}" != "" ]]; then
  pull_one "$1"
else
  failed=0
  for name in "${ALL_DBS[@]}"; do
    if ! pull_one "$name"; then
      echo "FAIL $name" >&2
      failed=1
    fi
  done
  if [[ "$failed" -ne 0 ]]; then
    exit 1
  fi
fi

echo
echo "Open SQLTools connections under group cloudflare-d1."
echo "Snapshots are copies — re-run after remote writes."
