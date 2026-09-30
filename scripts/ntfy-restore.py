#!/usr/bin/env python3
"""ntfy-restore.py — recover ntfy (push notification server) from Error
or CrashLoopBackOff state.

What it does:
  1. Checks ntfy pod state and restart count
  2. If OOMKilled: raises memory limit (default: 128Mi)
  3. If generic Error/CrashLoop: force-restarts the deployment
  4. Waits for Ready and reports

Idempotent — safe to re-run.

Env: NTFY_MEM_LIMIT (default 128Mi), NTFY_NS (default ntfy)."""

import json
import os
import subprocess
from datetime import UTC, datetime

NS = os.environ.get("NTFY_NS", "ntfy")
NTFY_MEM_LIMIT = os.environ.get("NTFY_MEM_LIMIT", "128Mi")


def note(msg: str) -> None:
    print(f"[ntfy-restore] {msg}")


def k(*args: str) -> str:
    r = subprocess.run(["kubectl", *args], capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def jpath(path: str, default: str = "") -> str:
    r = subprocess.run(
        ["kubectl", "-n", NS, "get", "pods", "-l", "app=ntfy", "-o", f"jsonpath={path}"],
        capture_output=True,
        text=True,
    )
    return r.stdout.strip() or default


note(f"=== ntfy-restore {datetime.now(UTC):%F %T}Z ===")

BASE = "{.items[0].status.containerStatuses[0"
RESTARTS = jpath(BASE + ".restartCount}", "0")
LAST_EXIT = jpath(BASE + ".lastState.terminated.reason}")
WAIT_REASON = jpath(BASE + ".state.waiting.reason}")
r = subprocess.run(
    [
        "kubectl",
        "-n",
        NS,
        "get",
        "deploy",
        "ntfy",
        "-o",
        "jsonpath={.spec.template.spec.containers[0].resources.limits.memory}",
    ],
    capture_output=True,
    text=True,
)
LIVE_LIMIT = r.stdout.strip() or "unknown"

note(
    f"ntfy: restarts={RESTARTS} lastExit={LAST_EXIT or 'none'} "
    f"waiting={WAIT_REASON or 'none'} liveLimit={LIVE_LIMIT}"
)

print("\n=== ntfy logs (last 20 lines before restore) ===")
print(k("-n", NS, "logs", "deploy/ntfy", "--tail=20"))

patched = False
if LAST_EXIT == "OOMKilled":
    note(f"OOMKilled → raising memory limit to {NTFY_MEM_LIMIT}")
    patch = json.dumps(
        {
            "spec": {
                "template": {
                    "spec": {
                        "containers": [
                            {
                                "name": "ntfy",
                                "resources": {
                                    "requests": {"memory": "32Mi", "cpu": "10m"},
                                    "limits": {"memory": NTFY_MEM_LIMIT, "cpu": "200m"},
                                },
                            }
                        ]
                    }
                }
            }
        }
    )
    kpatch = subprocess.run(
        ["kubectl", "-n", NS, "patch", "deploy", "ntfy", "--type=strategic", "-p", patch],
        capture_output=True,
    )
    note("  patched ntfy → " + NTFY_MEM_LIMIT if r.returncode == 0 else "  WARNING: patch failed")
    patched = r.returncode == 0

restarts = int(RESTARTS) if RESTARTS.isdigit() else 0
if LAST_EXIT == "Error" or WAIT_REASON == "CrashLoopBackOff" or restarts > 5 or patched:
    note("Restarting ntfy deployment...")
else:
    note("ntfy appears healthy — forcing restart to clear any stale state")
subprocess.run(["kubectl", "-n", NS, "rollout", "restart", "deploy/ntfy"], capture_output=True)
note("Waiting for ntfy rollout (up to 90s)...")
subprocess.run(
    ["kubectl", "-n", NS, "rollout", "status", "deploy/ntfy", "--timeout=90s"], capture_output=True
)

print("\n=== ntfy pod state after restore ===")
print(k("-n", NS, "get", "pods", "-o", "wide"))
r = subprocess.run(
    ["kubectl", "-n", NS, "get", "deploy", "ntfy", "-o", "jsonpath={.status.readyReplicas}"],
    capture_output=True,
    text=True,
)
note(f"ready replicas: {r.stdout.strip() or '0'}")

note("\n=== DONE ===")
