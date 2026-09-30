#!/usr/bin/env python3
"""db-d1-pull.py — export Cloudflare D1 databases to .local/db/*.sqlite
for SQLTools.

D1 has no TCP endpoint — this pulls a remote snapshot via
`wrangler d1 export`, then loads it into a local SQLite file.

Usage:
  python3 scripts/db-d1-pull.py              # all known D1 DBs
  python3 scripts/db-d1-pull.py user-auth-db"""

import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".local" / "db"
OUT.mkdir(parents=True, exist_ok=True)

# cloudless-auth retired — see scripts/d1-retire-cloudless-auth.sh
ALL_DBS = ["user-auth-db", "auth-db-preview"]

if not shutil.which("pnpm"):
    print("pnpm not found", file=sys.stderr)
    sys.exit(1)


def sql_to_sqlite(sql_path: Path, sqlite_path: Path) -> None:
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
    con = sqlite3.connect(str(sqlite_path))
    con.execute("PRAGMA user_version = 1")
    con.commit()
    n = con.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
    con.close()
    print(f"→ {sqlite_path} ({n} tables, {sqlite_path.stat().st_size} bytes)")


def pull_one(name: str) -> None:
    sql_path = OUT / f"{name}.sql"
    sqlite_path = OUT / f"{name}.sqlite"
    print(f"exporting D1 {name} (remote) …")
    subprocess.run(
        [
            "pnpm",
            "exec",
            "wrangler",
            "d1",
            "export",
            name,
            "--remote",
            "--output",
            str(sql_path),
            "-y",
        ],
        cwd=ROOT,
        check=True,
    )
    print("loading into SQLite …")
    sql_to_sqlite(sql_path, sqlite_path)


if len(sys.argv) > 1:
    pull_one(sys.argv[1])
else:
    failed = 0
    for name in ALL_DBS:
        try:
            pull_one(name)
        except subprocess.CalledProcessError:
            print(f"FAIL {name}", file=sys.stderr)
            failed = 1
    if failed:
        sys.exit(1)

print()
print("Open SQLTools connections under group cloudflare-d1.")
print("Snapshots are copies — re-run after remote writes.")
