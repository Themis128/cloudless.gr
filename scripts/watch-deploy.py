#!/usr/bin/env python3
"""watch-deploy.py — watch a Pi deploy to completion: poll the workflow
run, the deployed SHA in SSM, and the live Insight Tag in the
production bundle. Exits 0 once the Partner ID literal appears in the
bundle (the truest signal that the new code is live).

Companion to scripts/linkedin-insight-doctor.py.

Flags:
  --run-id <id>      latest deploy-pi.yml run for current repo
  --target-sha <sha> current HEAD short SHA (12 chars)
  --interval <sec>   90
  --max-tries <n>    20 (~30 min)
  --slug <slug>      shop-online
  --locale <locale>  el

Exit: 0 = bundle now contains Partner ID literal; 1 = polling
exhausted; 2 = preconditions failed.

Requires: gh, aws."""

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

REPO = os.environ.get("GH_REPO", "Themis128/cloudless.gr")
run_id = target_sha = ""
interval, max_tries = 90, 20
slug, locale = "shop-online", "el"

i = 1
while i < len(sys.argv):
    arg = sys.argv[i]
    if arg in ("--run-id", "--target-sha", "--interval", "--max-tries", "--slug", "--locale"):
        val = sys.argv[i + 1]
        if arg == "--run-id":
            run_id = val
        elif arg == "--target-sha":
            target_sha = val
        elif arg == "--interval":
            interval = int(val)
        elif arg == "--max-tries":
            max_tries = int(val)
        elif arg == "--slug":
            slug = val
        else:
            locale = val
        i += 2
    elif arg in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    else:
        print(f"unknown arg: {arg}", file=sys.stderr)
        sys.exit(2)

for tool in ("gh", "aws"):
    if not shutil.which(tool):
        print(f"missing tool: {tool}", file=sys.stderr)
        sys.exit(2)

if not run_id:
    r = subprocess.run(
        [
            "gh",
            "run",
            "list",
            "--repo",
            REPO,
            "--workflow",
            "deploy-pi.yml",
            "--limit",
            "1",
            "--json",
            "databaseId",
            "--jq",
            ".[0].databaseId",
        ],
        capture_output=True,
        text=True,
    )
    run_id = r.stdout.strip()
    if not run_id or run_id == "null":
        print(
            "could not resolve latest deploy-pi.yml run; pass --run-id explicitly", file=sys.stderr
        )
        sys.exit(2)

if not target_sha:
    r = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
    target_sha = r.stdout.strip()[:12]
    if not target_sha:
        print("could not resolve HEAD SHA; pass --target-sha explicitly", file=sys.stderr)
        sys.exit(2)

print(f"watching run={run_id}, target-sha={target_sha}, slug={slug}, locale={locale}")
print(f"interval={interval}s, max-tries={max_tries} (~{interval * max_tries // 60} min ceiling)\n")

for i in range(1, max_tries + 1):
    print(f"=== try {i} @ {time.strftime('%H:%M:%SZ', time.gmtime())} ===")

    r = subprocess.run(
        [
            "gh",
            "run",
            "view",
            run_id,
            "--repo",
            REPO,
            "--json",
            "status,conclusion",
            "--jq",
            '.status + " " + .conclusion',
        ],
        capture_output=True,
        text=True,
    )
    parts = r.stdout.split()
    status = parts[0] if parts else "?"
    concl = parts[1] if len(parts) > 1 else "?"
    print(f"workflow: status={status} conclusion={concl}")

    r = subprocess.run(
        [
            "aws",
            "ssm",
            "get-parameter",
            "--name",
            "/cloudless/production/pi-sha",
            "--region",
            "us-east-1",
            "--query",
            "Parameter.Value",
            "--output",
            "text",
        ],
        capture_output=True,
        text=True,
    )
    pi_sha = r.stdout.strip() or "?"
    print(f"pi-sha SSM: {pi_sha}")

    script = ROOT / "scripts" / "linkedin-insight-doctor.py"
    if not script.exists():
        script = ROOT / "scripts" / "linkedin-insight-doctor.sh"
    cmd = [sys.executable, str(script)] if script.suffix == ".py" else ["bash", str(script)]
    r = subprocess.run([*cmd, "--slug", slug, "--locale", locale], capture_output=True, text=True)
    out = r.stdout + r.stderr
    for ln in out.splitlines():
        if re.search(r"Partner ID literal|HEALTHY|NOT HEALTHY", ln):
            print(ln)
            break
    else:
        print(out[:200])

    if "Partner ID literal found in bundle" in out:
        print("=== ✓ Partner ID is in the live bundle. Deploy is effective. ===")
        sys.exit(0)

    if pi_sha == target_sha and status == "completed" and "Partner ID literal found" not in out:
        print("=== ! Deploy finished but live bundle still missing Partner ID. ===")
        print("    Likely cause: Docker build cache reused stale chunks despite secret")
        print("    being set. Bust /opt/docker-cache on the build runner and re-deploy.")

    time.sleep(interval)

print(
    f"=== exhausted polls (~{interval * max_tries // 60} min). "
    "Deploy is taking longer than expected. ==="
)
sys.exit(1)
