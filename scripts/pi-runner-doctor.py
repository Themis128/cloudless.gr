#!/usr/bin/env python3
"""pi-runner-doctor.py — diagnose Pi-runner outages + auto-remediate.

Companion to skills/pi-runner-failover/SKILL.md.

Usage:
  python3 scripts/pi-runner-doctor.py              # diagnose only
  python3 scripts/pi-runner-doctor.py --auto-flip  # flip
      RUNNER_GENERIC to hosted if BOTH Pi runners are offline

Exit: 0 healthy/flipped; 2 offline w/o --auto-flip; 3 healthy but
RUNNER_GENERIC still hosted (leftover from a recent flip)."""

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
os.chdir(REPO_ROOT)

REPO = os.environ.get("REPO", "Themis128/cloudless.gr")
AUTO_FLIP = "--auto-flip" in sys.argv[1:]

print("=== Pi runner doctor ===")
print(f"Repo: {REPO}\n")

print("## 1. Self-hosted runners")
r = subprocess.run(["gh", "api", f"/repos/{REPO}/actions/runners"],
                   capture_output=True, text=True)
try:
    runners = json.loads(r.stdout)["runners"]
except Exception:
    sys.exit(f"  ! Failed to fetch runner list: "
             f"{r.stdout.strip() or r.stderr.strip()}")

for run in runners:
    labels = ",".join(lb["name"] for lb in run.get("labels", []))
    print(f"  - {run['name']}: status={run['status']} "
          f"busy={run['busy']} labels={labels}")

pi_online = sum(1 for r in runners
                if r["status"] == "online" and any(
                    lb["name"] == "pi" for lb in r["labels"]))
pi_offline = sum(1 for r in runners
                 if r["status"] == "offline" and any(
                     lb["name"] == "pi" for lb in r["labels"]))
print(f"\nPi runners: {pi_online} online, {pi_offline} offline\n")

print("## 2. RUNNER_GENERIC repo variable")
r = subprocess.run(["gh", "variable", "get", "RUNNER_GENERIC"],
                   capture_output=True, text=True)
rg_value = r.stdout.strip() if r.returncode == 0 else ""
if not rg_value:
    print("  RUNNER_GENERIC is UNSET → flexible workflows use "
          "ubuntu-latest")
    rg_mode = "hosted"
else:
    print(f"  RUNNER_GENERIC = {rg_value}")
    rg_mode = "pi"
print()

print("## 3. Workflows currently queued")
r = subprocess.run(["gh", "run", "list", "--status", "queued",
                    "--limit", "30", "--json",
                    "databaseId,workflowName,createdAt"],
                   capture_output=True, text=True)
try:
    queued = json.loads(r.stdout)
except Exception:
    queued = []
if not queued:
    print("  (none)")
else:
    for q in queued:
        print(f"  - {q['databaseId']}\t{q['workflowName']}"
              f"\t({q['createdAt']})")
print()

print("## 4. Workflows pinned to [self-hosted, omv, pi, *]")
import re
wf_dir = Path(".github/workflows")
pinned = []
if wf_dir.is_dir():
    pat = re.compile(r"runs-on:.*self-hosted.*omv.*pi"
                     r"|runs-on:.*omv.*pi.*build")
    for f in wf_dir.glob("*.yml"):
        if pat.search(f.read_text()):
            pinned.append(f.name)
print("\n".join(f"  - {n}" for n in pinned) or "  (none)")
print()

print("## 5. Recommendation")
if pi_offline > 0 and pi_online == 0:
    print("  ALL Pi runners offline.")
    if rg_mode == "pi":
        print("      RUNNER_GENERIC is still pointing at Pi labels "
              "— flexible")
        print("      workflows will queue forever until a Pi "
              "runner comes back.\n")
        if AUTO_FLIP:
            print("  -> Flipping RUNNER_GENERIC to hosted "
                  "(--auto-flip)...")
            r = subprocess.run(
                ["bash", ".github/scripts/toggle-runner.sh",
                 "hosted"], capture_output=True, text=True)
            print("\n".join(
                (r.stdout + r.stderr).splitlines()[-5:]))
            print("\n  Done. Now cancel any queued runs and "
                  "re-trigger them.")
            sys.exit(0)
        else:
            print("  -> Run with --auto-flip to flip "
                  "RUNNER_GENERIC to hosted, OR")
            print("    run manually: .github/scripts/"
                  "toggle-runner.sh hosted\n")
            print("  Then cancel queued runs targeting Pi and "
                  "re-trigger them.")
            print("  See skills/pi-runner-failover/SKILL.md for "
                  "the full playbook.")
            sys.exit(2)
    else:
        print("      RUNNER_GENERIC is already on hosted - "
              "flexible workflows OK.")
        print("      Hard-pinned workflows (Section 4) are still "
              "stuck until")
        print("      a Pi runner comes back. See SKILL.md Step 4 "
              "for restore.")
        sys.exit(0)
elif pi_online > 0 and rg_mode == "hosted":
    print("  Pi runners are healthy but RUNNER_GENERIC is on "
          "hosted.")
    print("      This is fine, but if you want to push load back "
          "to Pi:")
    print("      .github/scripts/toggle-runner.sh pi")
    sys.exit(3)
else:
    print("  Pi runners healthy. No action needed.")
    sys.exit(0)
