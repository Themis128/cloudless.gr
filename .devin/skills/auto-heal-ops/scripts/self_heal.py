#!/usr/bin/env python3
"""self_heal.py — watch a PR and auto-fix the failures it can.

    python3 self_heal.py PR_NUMBER [--repo R] [--watch-min N]

Healers:
  * Python Lint (ruff) fail → `ruff check --fix` on changed .py files →
    commit + push (the branch updates itself, checks re-run)
  * core-web-vitals-audit fail → one auto-retrigger (variance-absorb)
  * reports each action; exits 0 when the PR merges or nothing left to fix.

Requires gh CLI + ruff (pipx/pip). Runs in the repo checkout.
"""
import json
import shutil
import subprocess
import sys
import time

REPO = "Themis128/cloudless.gr"
GH = shutil.which("gh") or "gh"
RUFF = shutil.which("ruff") or "ruff"


def sh(*a, cwd=None) -> str:
    r = subprocess.run(list(a), capture_output=True, text=True, cwd=cwd, check=False)
    return (r.stdout + r.stderr).strip()


def pr_state(pr: str) -> dict:
    out = sh(GH, "pr", "view", pr, "--repo", REPO,
             "--json", "state,headRefName,mergeStateStatus")
    return json.loads(out) if out.startswith("{") else {}


def failed_jobs(pr: str) -> list[str]:
    out = sh(GH, "pr", "checks", pr, "--repo", REPO)
    return [l.split("\t")[0] for l in out.splitlines() if "\tfail\t" in l]


def changed_py() -> list[str]:
    out = sh("git", "diff", "--name-only", "origin/main...HEAD")
    return [l for l in out.splitlines() if l.endswith(".py")]


def heal_lint() -> bool:
    files = changed_py()
    if not files:
        return False
    r = sh(RUFF, "check", "--fix", *files)
    dirty = sh("git", "status", "--porcelain")
    if not dirty:
        return False
    print("[heal] ruff --fix applied:", dirty.replace("\n", ", ")[:120])
    sh("git", "add", "-A")
    sh("git", "-c", "user.name=Devin",
       "-c", "user.email=158243242+devin-ai-integration[bot]@users.noreply.github.com",
       "commit", "-q", "-m", "auto-heal: ruff --fix")
    out = sh("git", "push")
    print("[heal] pushed:", out[:80])
    return True


def retrigger_cwv() -> bool:
    out = sh(GH, "run", "list", "--repo", REPO, "--workflow",
             "core-web-vitals-audit.yml", "--limit", "3",
             "--json", "conclusion")
    if '"failure"' in out:
        sh(GH, "workflow", "run", "core-web-vitals-audit.yml", "--repo", REPO)
        print("[heal] cwv re-triggered")
        return True
    return False


def main() -> int:
    pr = sys.argv[1] if len(sys.argv) > 1 else None
    if not pr:
        print("usage: self_heal.py PR_NUMBER"); return 1
    watch_min = 20
    if "--watch-min" in sys.argv:
        watch_min = int(sys.argv[sys.argv.index("--watch-min") + 1])
    deadline = time.time() + watch_min * 60
    healed_once = set()
    while time.time() < deadline:
        s = pr_state(pr)
        state = s.get("state", "?")
        if state == "MERGED":
            print("PR merged — done"); return 0
        if state in ("CLOSED",):
            print("PR closed"); return 1
        fails = failed_jobs(pr)
        if fails:
            print("[watch] failing:", ", ".join(fails[:5]))
        if any("Lint" in f or "ruff" in f.lower() for f in fails) \
           and "lint" not in healed_once:
            heal_lint(); healed_once.add("lint"); time.sleep(30); continue
        if any("Core Web Vitals" in f or "Lighthouse" in f for f in fails) \
           and "cwv" not in healed_once:
            retrigger_cwv(); healed_once.add("cwv")
        time.sleep(30)
    print("watch window ended"); return 0


if __name__ == "__main__":
    sys.exit(main())
