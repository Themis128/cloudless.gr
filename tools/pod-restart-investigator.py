#!/usr/bin/env python3
"""pod-restart-investigator.py — Investigate high-restart pods in the k3s cluster.

Port of pod-restart-investigator.sh.
Usage: python3 tools/pod-restart-investigator.py [namespace] [pod_name]

If no args provided, lists all pods with >2 restarts across all namespaces.
If namespace+pod provided, does a deep dive on that specific pod.
"""

import json
import subprocess
import sys
from datetime import UTC, datetime

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"


def kubectl(*args: str) -> str:
    r = subprocess.run(
        ["kubectl", *args], capture_output=True, text=True, timeout=60, check=False
    )
    return (r.stdout or "") + (r.stderr or "")


ts = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
print(f"{CYAN}╔══════════════════════════════════════════════════════════════╗{NC}")
print(f"{CYAN}║  Pod Restart Investigator — {ts}{NC}")
print(f"{CYAN}╚══════════════════════════════════════════════════════════════╝{NC}")

# ─── Mode 1: List all high-restart pods ───
if len(sys.argv) == 1:
    print(f"\n{CYAN}── High-Restart Pods (>2 restarts) ──{NC}\n")
    try:
        pods = json.loads(kubectl("get", "pods", "--all-namespaces", "-o", "json"))
    except json.JSONDecodeError:
        pods = {}

    for pod in pods.get("items", []):
        meta = pod.get("metadata", {})
        ns, name = meta.get("namespace", ""), meta.get("name", "")
        for cs in pod.get("status", {}).get("containerStatuses") or []:
            if cs.get("restartCount", 0) <= 2:
                continue
            restarts = cs["restartCount"]
            term = cs.get("lastState", {}).get("terminated", {})
            reason = term.get("reason") or "none"
            exitcode = term.get("exitCode", 0)
            if reason == "OOMKilled":
                print(f"{RED}✗{NC} {ns}/{name} — {restarts} restarts, last: {reason} (exit {exitcode})")
            elif reason == "Error":
                print(f"{YELLOW}⚠{NC} {ns}/{name} — {restarts} restarts, last: {reason} (exit {exitcode})")
            elif reason == "Completed":
                print(f"{GREEN}○{NC} {ns}/{name} — {restarts} restarts, last: {reason} (exit {exitcode}) [normal job behavior]")
            else:
                print(f"{YELLOW}?{NC} {ns}/{name} — {restarts} restarts, last: {reason} (exit {exitcode})")

    print(f"\n{CYAN}── Exit Code Reference ──{NC}")
    print("  0   = Completed (normal)")
    print("  143 = SIGTERM (pod was terminated by kubelet/controller)")
    print("  137 = SIGKILL (OOMKilled or force-killed)")
    print("  1   = Application error\n")
    print(f"To deep-dive a specific pod: {CYAN}python3 tools/pod-restart-investigator.py <namespace> <pod_name>{NC}")
    sys.exit(0)

# ─── Mode 2: Deep dive on a specific pod ───
ns = sys.argv[1] if len(sys.argv) > 1 else "default"
pod_name = sys.argv[2] if len(sys.argv) > 2 else ""

if not pod_name:
    print(f"{RED}Error: Pod name required{NC}")
    print("Usage: python3 tools/pod-restart-investigator.py <namespace> <pod_name>")
    sys.exit(1)

print(f"\n{CYAN}── Deep Dive: {ns}/{pod_name} ──{NC}")

# 1. Pod status
print(f"\n{CYAN}1. Pod Status{NC}")
print(kubectl("get", "pod", "-n", ns, pod_name, "-o", "wide").rstrip())

try:
    pod = json.loads(kubectl("get", "pod", "-n", ns, pod_name, "-o", "json"))
except json.JSONDecodeError:
    pod = {}

# 2. Container status with restart info
print(f"\n{CYAN}2. Container Status (restart details){NC}")
cs0 = (pod.get("status", {}).get("containerStatuses") or [{}])[0]
print(json.dumps({
    "restartCount": cs0.get("restartCount"),
    "lastState": cs0.get("lastState"),
    "state": cs0.get("state"),
    "ready": cs0.get("ready"),
    "started": cs0.get("started"),
}, indent=2))

# 3. Resource limits/requests
print(f"\n{CYAN}3. Resource Limits & Requests{NC}")
resources = (pod.get("spec", {}).get("containers") or [{}])[0].get("resources", {})
print(json.dumps(resources, indent=2))

# 4. Node context
print(f"\n{CYAN}4. Node Context{NC}")
node = pod.get("spec", {}).get("nodeName", "")
print(f"Pod is on node: {node}")
if node:
    print(f"\nNode {node} conditions:")
    try:
        node_json = json.loads(kubectl("get", "node", node, "-o", "json"))
        conditions = [
            {
                "type": c.get("type"),
                "status": c.get("status"),
                "reason": c.get("reason"),
                "message": c.get("message"),
            }
            for c in node_json.get("status", {}).get("conditions", [])
        ]
        print(json.dumps(conditions, indent=2))
    except json.JSONDecodeError:
        pass
    print(f"\nNode {node} memory:")
    desc = kubectl("describe", "node", node)
    lines = desc.splitlines()
    for i, line in enumerate(lines):
        if "Allocated resources" in line:
            print("\n".join(lines[i : i + 10]))
            break

# 5. Recent events
print(f"\n{CYAN}5. Recent Events (last 20){NC}")
events = kubectl(
    "get",
    "events",
    "-n",
    ns,
    "--field-selector",
    f"involvedObject.name={pod_name}",
    "--sort-by=.lastTimestamp",
)
print("\n".join(events.splitlines()[-20:]))

# 6. Logs
print(f"\n{CYAN}6. Last 50 Log Lines{NC}")
logs = kubectl("logs", "-n", ns, pod_name, "--tail=50")
print(logs.rstrip() or "(logs unavailable)")

# 7. Previous container logs (if restarted)
print(f"\n{CYAN}7. Previous Container Logs (if available){NC}")
prev = kubectl("logs", "-n", ns, pod_name, "--previous", "--tail=30")
print(prev.rstrip() or "(no previous logs available)")

print(f"\n{CYAN}═══════════════════════════════════════════════════════════════{NC}")
