#!/usr/bin/env python3
"""Toggle CI between GitHub-hosted runners and self-hosted pools.

Port of toggle-runner.sh.

Why this exists:
  GitHub Actions has no native runner-failover. When GitHub billing breaks
  or hosted-runner capacity is exhausted, every workflow targeted at
  `ubuntu-latest` fails fast. Flipping repo variables re-routes instrumented
  workflows on their next run.

Two independent knobs:
  RUNNER_GENERIC — generic CI (lint/build/test style). Pi build pool only.
  RUNNER_X64     — browser suites (Lighthouse / Playwright / a11y). Legion WSL
                   only — NEVER point this at omv/Pi.

Usage:
  python3 .github/scripts/toggle-runner.py status
  python3 .github/scripts/toggle-runner.py pi|hosted
  python3 .github/scripts/toggle-runner.py x64-legion|x64-hosted

Notes:
  - Already-queued jobs are NOT re-routed; cancel + re-run after toggling.
  - Opt-in:
      runs-on: ${{ fromJSON(vars.RUNNER_GENERIC || '"ubuntu-latest"') }}
      runs-on: ${{ fromJSON(vars.RUNNER_X64 || '"ubuntu-latest"') }}
"""

import json
import os
import subprocess
import sys

REPO = os.environ.get("REPO", "Themis128/cloudless.gr")
VAR_GENERIC = "RUNNER_GENERIC"
VAR_X64 = "RUNNER_X64"
PI_VALUE = '["self-hosted","omv","build"]'
LEGION_VALUE = '["self-hosted","legion","x64"]'


def gh(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=False
    )


def show_runners() -> None:
    print("\nRegistered runners:")
    r = gh("api", f"repos/{REPO}/actions/runners")
    if r.returncode != 0:
        print("  (unable to query — check gh auth)")
        return
    try:
        runners = json.loads(r.stdout).get("runners", [])
    except json.JSONDecodeError:
        print("  (unable to parse runner list)")
        return
    for runner in runners:
        busy = " (busy)" if runner.get("busy") else ""
        labels = ",".join(lbl.get("name", "") for lbl in runner.get("labels", []))
        print(f"  - {runner.get('name')}: {runner.get('status')}{busy} — [{labels}]")


def show_var(name: str) -> None:
    r = gh("variable", "list", "--repo", REPO, "--json", "name,value")
    current = ""
    if r.returncode == 0:
        try:
            for var in json.loads(r.stdout):
                if var.get("name") == name:
                    current = var.get("value", "")
        except json.JSONDecodeError:
            pass
    if not current:
        print(f"  {name}: unset → ubuntu-latest")
    else:
        print(f"  {name}: {current}")


def show_status() -> None:
    print(f"Runner variables on {REPO}:")
    show_var(VAR_GENERIC)
    show_var(VAR_X64)
    show_runners()


cmd = sys.argv[1] if len(sys.argv) > 1 else "status"

if cmd == "status":
    show_status()
elif cmd in ("pi", "self-hosted"):
    print(f"==> Setting {VAR_GENERIC}={PI_VALUE} on {REPO}")
    gh("variable", "set", VAR_GENERIC, "--repo", REPO, "--body", PI_VALUE)
    print("==> Done. Cancel + re-run any queued workflows to pick up the change.")
    show_status()
elif cmd in ("hosted", "gh", "github"):
    print(f"==> Clearing {VAR_GENERIC} on {REPO} (back to ubuntu-latest)")
    gh("variable", "delete", VAR_GENERIC, "--repo", REPO)
    show_status()
elif cmd == "x64-legion":
    print(f"==> Setting {VAR_X64}={LEGION_VALUE} on {REPO}")
    print("    (Lighthouse / e2e / a11y only — do not use omv for these)")
    gh("variable", "set", VAR_X64, "--repo", REPO, "--body", LEGION_VALUE)
    show_status()
elif cmd == "x64-hosted":
    print(f"==> Clearing {VAR_X64} on {REPO} (browser suites → ubuntu-latest)")
    gh("variable", "delete", VAR_X64, "--repo", REPO)
    show_status()
else:
    print(f"Usage: {sys.argv[0]} [status|pi|hosted|x64-legion|x64-hosted]", file=sys.stderr)
    sys.exit(2)
