#!/usr/bin/env python3
"""Cowork pre-flight sanity check for the cloudless.gr repo.

Port of cowork-preflight.sh.
Catches the known Windows-mount issues before they cost a debug detour.
Exit non-zero if anything looks corrupt.

Usage: python3 cowork-preflight.py
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent.parent
os.chdir(REPO_ROOT)


def red(msg: str) -> None:
    print(f"\033[31m{msg}\033[0m")


def yellow(msg: str) -> None:
    print(f"\033[33m{msg}\033[0m")


def green(msg: str) -> None:
    print(f"\033[32m{msg}\033[0m")


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    return r.stdout or ""


fail = 0

# Check 1: .git/index.lock stuck?
if Path(".git/index.lock").is_file():
    yellow("WARN .git/index.lock exists. Windows side is holding it.")
    yellow("     From Windows: Remove-Item .git\\index.lock -Force")
    fail += 1
else:
    green("OK   .git/index.lock is clear.")

# Check 2: working tree state
status_lines = [line for line in git("status", "-s").splitlines() if line.strip()]
if status_lines:
    yellow(f"INFO Working tree has {len(status_lines)} modified or untracked entries:")
    for line in status_lines:
        print(f"       {line}")
else:
    green("OK   Working tree is clean.")

# Check 3: do any modified text files show corruption signatures?
TEXT_EXTS = (
    ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".json", ".md",
    ".yml", ".yaml", ".sh", ".py", ".ps1", ".css",
)
suspect = 0
mods = [m for m in git("diff", "--name-only", "HEAD").splitlines() if m.strip()]
for f in mods:
    path = Path(f)
    if not path.is_file():
        continue
    if not (f.endswith(TEXT_EXTS) or path.name.startswith(".env")):
        continue

    try:
        data = path.read_bytes()
    except OSError:
        continue

    nulls = data.count(b"\x00")
    if nulls:
        red(f"FAIL {f} has {nulls} NUL byte(s) — partial-flush corruption.")
        suspect += 1
        continue

    head = git("show", f"HEAD:{f}")
    if head:
        head_sz = len(head.encode("utf-8", "replace"))
        sz_delta = head_sz - len(data)
        if sz_delta > 50:
            diff = git("diff", "--", f)
            del_lines = sum(1 for line in diff.splitlines() if line.startswith("-"))
            if del_lines < 3:
                red(f"FAIL {f} shrank by {sz_delta} bytes vs HEAD with only {del_lines} '-' lines — likely truncation.")
                suspect += 1
                continue

    if data[-4:].rstrip().endswith(b"</"):
        red(f"FAIL {f} ends with '</' — looks truncated mid-closing-tag.")
        suspect += 1

if suspect:
    fail += 1
elif status_lines:
    green("OK   None of the modified files show known corruption signatures.")

# Check 4: can the sandbox actually write to the repo?
try:
    fd, tmp = tempfile.mkstemp(prefix=".cowork-preflight-", dir=REPO_ROOT)
    try:
        os.write(fd, b"preflight")
    finally:
        os.close(fd)
    if Path(tmp).read_text() == "preflight":
        green("OK   Sandbox can write into the repo.")
    else:
        red("FAIL Sandbox write returned different content — mount is unreliable.")
        fail += 1
    try:
        Path(tmp).unlink()
    except OSError:
        yellow("WARN could not rm probe file — Windows perm issue (harmless).")
except OSError:
    red("FAIL Sandbox cannot write into the repo at all.")
    fail += 1

print()
if fail == 0:
    green("Preflight passed.")
    sys.exit(0)
else:
    red(f"Preflight found {fail} issue(s). Heal from Windows before continuing.")
    sys.exit(1)
