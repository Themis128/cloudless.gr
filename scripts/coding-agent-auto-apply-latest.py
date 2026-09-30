#!/usr/bin/env python3
"""Auto-apply the latest (or given) saved CodingAgent patch onto a
fresh branch, run typecheck, optionally commit.

Usage:
  python3 scripts/coding-agent-auto-apply-latest.py [patch]
Env: AUTO_COMMIT=1 · RUN_TYPES=1"""

import os
import subprocess
import sys
import time
from pathlib import Path

PROJECT_DIR = Path("/home/tbaltzakis/cloudless.gr")
os.chdir(PROJECT_DIR)

PATCH_FILE = sys.argv[1] if len(sys.argv) > 1 else ""
AUTO_COMMIT = os.environ.get("AUTO_COMMIT") == "1"
RUN_TYPES = os.environ.get("RUN_TYPES") == "1"

if not PATCH_FILE:
    patches = sorted(
        Path("patches/coding-agent").glob("*.patch"),
        key=lambda p: -p.stat().st_mtime)
    PATCH_FILE = str(patches[0]) if patches else ""

if not PATCH_FILE:
    sys.exit("No saved patch found in patches/coding-agent/")
if not Path(PATCH_FILE).is_file():
    sys.exit(f"Patch file does not exist: {PATCH_FILE}")

print(f"==> Patch file: {PATCH_FILE}")


def git(*args: str) -> int:
    return subprocess.call(["git", *args])


if git("diff", "--quiet") != 0 or \
        git("diff", "--cached", "--quiet") != 0:
    print("Refusing to apply patch because working tree is "
          "not clean.\n")
    subprocess.call(["git", "status", "--short"])
    sys.exit(2)

print("==> Checking patch applies cleanly...")
if git("apply", "--check", PATCH_FILE) != 0:
    sys.exit(1)

branch = "agentic/apply-" + time.strftime("%Y%m%d-%H%M%S",
                                          time.gmtime())
print(f"==> Creating branch: {branch}")
if git("checkout", "-b", branch) != 0:
    sys.exit(1)

print("==> Applying patch...")
if git("apply", PATCH_FILE) != 0:
    print("\n❌ Failure detected. Rolling back working tree "
          f"on branch {branch}...")
    git("reset", "--hard", "HEAD")
    sys.exit(f"Rolled back. You are still on branch {branch}.")

print("==> Current diff:")
subprocess.call(["git", "diff", "--stat"])

if RUN_TYPES:
    print("==> Running cf:types...")
    if subprocess.call(["pnpm", "run", "cf:types"]) != 0:
        git("reset", "--hard", "HEAD")
        sys.exit(1)
    p = Path("worker-configuration.d.ts")
    if p.exists():
        p.write_text(
            "\n".join(l.rstrip() for l in
                      p.read_text().splitlines()) + "\n")

print("==> Running cf:typecheck...")
if subprocess.call(["pnpm", "run", "cf:typecheck"]) != 0:
    git("reset", "--hard", "HEAD")
    sys.exit(1)

print(f"\n✅ Patch applied and typecheck passed.\n"
      f"Branch: {branch}\n")

if AUTO_COMMIT:
    print("==> Auto-committing...")
    git("add", "-A")
    git("commit", "-m", "Apply structured CodingAgent patch")
    print("\n✅ Commit created.")
else:
    print("""Patch is applied but NOT committed.

Review with:
  git diff

If good:
  git add -A
  git commit -m "Apply structured CodingAgent patch"
""")

print(f"""Optional after review:
  pnpm run cf:deploy
  git push -u origin {branch}""")
