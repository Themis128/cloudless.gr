#!/usr/bin/env python3
"""Apply the 2026-05-31 cluster memory relief plan in safe order.

Port of apply-memory-relief.sh.

Run on omv-main (or anywhere with kubectl context configured).

Each step is idempotent. The script will:
  1. Apply LimitRanges + per-deployment caps  (admission-time defaults)
  2. Scale down unused workloads              (frees memory immediately)
  3. Slim Prometheus scrape config            (forces pod restart)
  4. Label cluster-health ServiceMonitors    (re-allows the 6 keepers)
  5. Restart capped workloads                 (picks up new limits)
  6. Verify and report

Total expected memory freed on omv: ~1.85 GiB (from 6.1 GiB used → ~4.3 GiB)

Usage: python3 k8s/cluster-protection/apply-memory-relief.py
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

os.chdir(Path(__file__).resolve().parent)

KEEPERS = [
    "prometheus-node-exporter",
    "kube-prom-kube-state-metrics",
    "monitoring-prometheus",
    "kube-prom-kubelet",
    "kube-prom-apiserver",
    "kube-prom-coredns",
    "cloudflared",
    "tailscale",
]

RESTARTS = [
    ("analytics", "deployment/metabase"),
    ("n8n", "deployment/n8n"),
    ("ntfy", "deployment/ntfy"),
]


def kubectl(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    r = subprocess.run(
        ["kubectl", *args], capture_output=True, text=True, check=False
    )
    if check and r.returncode != 0:
        print(r.stderr or r.stdout, file=sys.stderr)
        sys.exit(1)
    return r


def wait_for_api() -> None:
    for attempt in range(1, 31):
        r = kubectl("get", "nodes", check=False)
        if r.returncode == 0:
            print("✓ k3s API responding")
            return
        print(f"  ... waiting for k3s API (attempt {attempt}/30)")
        time.sleep(10)
    print("❌ kubectl API not responding after 5 min — aborting", file=sys.stderr)
    sys.exit(1)


print("═══════════════════════════════════════════════════════════")
print("  Cluster memory relief — 2026-05-31")
print("═══════════════════════════════════════════════════════════\n")
wait_for_api()

print("\n── Step 1/6: Apply LimitRanges and deployment caps ──────────")
print(kubectl("apply", "-f", "memory-relief-2026-05-31.yaml").stdout, end="")

print("\n── Step 2/6: Scale down unused workloads ────────────────────")
print(kubectl("apply", "-f", "scale-down-unused.yaml").stdout, end="")

print("\n── Step 3/6: Slim Prometheus scrape config ──────────────────")
print(kubectl("apply", "-f", "prometheus-slim.yaml").stdout, end="")

print("\n── Step 4/6: Label cluster-health ServiceMonitors ───────────")
# These are the ONLY scrape targets Prometheus will keep after step 3.
# Anything else gets dropped silently. After helm upgrade, re-run this step.
for sm in KEEPERS:
    if kubectl("get", "servicemonitor", "-n", "monitoring", sm, check=False).returncode == 0:
        kubectl(
            "label",
            "servicemonitor",
            "-n",
            "monitoring",
            sm,
            "cluster-protection.io/health=true",
            "--overwrite",
        )
        print(f"  ✓ labelled {sm}")
    else:
        print(f"  ⚠ servicemonitor {sm} not found (skip)")

print("\n── Step 5/6: Restart capped workloads to pick up new limits ─")
for ns, deploy in RESTARTS:
    if kubectl("get", "-n", ns, deploy, check=False).returncode == 0:
        kubectl("rollout", "restart", "-n", ns, deploy)
        print(f"  ✓ restarted {ns}/{deploy}")

print("\n── Step 6/6: Verify (wait 60 s for things to settle) ────────")
time.sleep(60)

print("\nNode memory:")
print(kubectl("top", "nodes").stdout, end="")

print("\nTop 10 pods by memory after relief:")
top = kubectl("top", "pods", "-A", "--no-headers", check=False).stdout


def mem_key(line: str) -> int:
    cols = line.split()
    if len(cols) < 4:
        return 0
    return int(re.sub(r"[^0-9]", "", cols[3]) or 0)


for line in sorted(top.splitlines(), key=mem_key, reverse=True)[:10]:
    print(line)

print("\nActive Prometheus targets (should be ~6 jobs):")
r = kubectl(
    "exec",
    "-n",
    "monitoring",
    "prometheus-monitoring-prometheus-0",
    "-c",
    "prometheus",
    "--",
    "wget",
    "-qO-",
    "http://localhost:9090/api/v1/targets",
    check=False,
)
try:
    targets = json.loads(r.stdout)
    jobs = sorted({t.get("labels", {}).get("job", "") for t in targets.get("data", {}).get("activeTargets", [])})
    for job in jobs:
        print(f'"job":"{job}"')
except (json.JSONDecodeError, AttributeError):
    jobs = sorted(set(re.findall(r'"job":"([^"]*)"', r.stdout)))
    if jobs:
        for job in jobs:
            print(f'"job":"{job}"')
    else:
        print("  (could not query — check pod status)")

print("\n✓ Done. If load is still > 6, run 'iostat -x 5' to inspect iowait.")
