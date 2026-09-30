#!/usr/bin/env python3
"""cluster-health-audit.py — One-shot comprehensive health audit for the cloudless.gr k3s cluster.

Port of cluster-health-audit.sh.
Usage: python3 tools/cluster-health-audit.py [--json]

Checks:
  1. Node conditions (Ready, MemoryPressure, DiskPressure, PIDPressure)
  2. Node resource usage (kubectl top nodes)
  3. Pod status (all namespaces, flag non-Running and high-restart)
  4. PVC status (all namespaces, flag non-Bound)
  5. Recent events (Warnings and Unhealthy)
  6. Internal service health (NodePort HTTP checks)
  7. External web endpoint health (via Cloudflare Tunnel)
  8. Cloudless-app API health endpoint
  9. OOMKilled pod detection
 10. Memory pressure risk assessment (nodes near capacity)
"""

import json
import re
import subprocess
import sys
import urllib.request
from datetime import UTC, datetime

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"

# NodePort → service mapping (from infrastructure/cloudflare-tunnels/cloudflared-config.yml)
NODEPORTS = {
    "cloudless-app": 30300,
    "grafana": 30850,
    "kuma": 32501,
    "n8n": 30900,
    "ntfy": 30080,
    "espocrm": 30700,
    "meilisearch": 30902,
    "postiz": 30500,
    "appflowy": 30810,
    "docs": 30901,
    "alert-api": 30820,
}

# External endpoints (via Cloudflare Tunnel)
EXTERNAL_HOSTS = [
    "cloudless.gr",
    "grafana.cloudless.gr",
    "kuma.cloudless.gr",
    "n8n.cloudless.gr",
    "ntfy.cloudless.gr",
    "espocrm.cloudless.gr",
    "meili.cloudless.gr",
    "postiz.cloudless.gr",
    "docs.cloudless.gr",
    "appflowy.cloudless.gr",
]

OMV_IP = "192.168.1.128"
JSON_MODE = "--json" in sys.argv[1:]
ISSUES = 0
WARNINGS = 0


def out(text: str = "") -> None:
    if not JSON_MODE:
        print(text)


def issue(text: str) -> None:
    global ISSUES
    ISSUES += 1
    out(f"{RED}✗{NC} {text}")


def warn(text: str) -> None:
    global WARNINGS
    WARNINGS += 1
    out(f"{YELLOW}⚠{NC} {text}")


def ok(text: str) -> None:
    out(f"{GREEN}✓{NC} {text}")


def kubectl(*args: str) -> str:
    r = subprocess.run(
        ["kubectl", *args], capture_output=True, text=True, timeout=60, check=False
    )
    return r.stdout or r.stderr


def kubectl_json(*args: str) -> dict:
    try:
        return json.loads(kubectl(*args))
    except json.JSONDecodeError:
        return {}


def http_code(url: str, timeout: int) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cluster-health-audit"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return str(resp.status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return "000"


def http_get(url: str, timeout: int) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cluster-health-audit"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception:
        return "{}"


ts = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
if JSON_MODE:
    print("{")
    print(f'  "timestamp": "{ts}",')
    print('  "checks": {')
else:
    print(f"{CYAN}╔══════════════════════════════════════════════════════════════╗{NC}")
    print(f"{CYAN}║  Cloudless.gr Cluster Health Audit — {ts}{NC}")
    print(f"{CYAN}╚══════════════════════════════════════════════════════════════╝{NC}")

# ─── 1. Node Conditions ───
out(f"\n{CYAN}── 1. Node Conditions ──{NC}")
nodes = kubectl_json("get", "nodes", "-o", "json")
node_ready = any(
    c.get("type") == "Ready" and c.get("status") == "True"
    for item in nodes.get("items", [])
    for c in item.get("status", {}).get("conditions", [])
)
if node_ready:
    ok("All nodes Ready")
else:
    issue("Node not Ready!")

pressures = [
    c.get("type")
    for item in nodes.get("items", [])
    for c in item.get("status", {}).get("conditions", [])
    if c.get("type") != "Ready" and c.get("status") == "True"
]
if pressures:
    issue(f"Pressure condition: {' '.join(pressures)}")
else:
    ok("No MemoryPressure/DiskPressure/PIDPressure")

# ─── 2. Node Resource Usage ───
out(f"\n{CYAN}── 2. Node Resource Usage ──{NC}")
top_nodes = kubectl("top", "nodes")
out(top_nodes.rstrip())
for line in top_nodes.splitlines()[1:]:
    cols = line.split()
    if not cols:
        continue
    last = cols[-1].rstrip("%")
    if last.isdigit() and int(last) > 85:
        warn(f"High memory usage: {cols[0]}: {last}%")

# ─── 3. Pod Status ───
out(f"\n{CYAN}── 3. Pod Status (non-Running or high-restart) ──{NC}")
not_running = kubectl(
    "get",
    "pods",
    "--all-namespaces",
    "--field-selector",
    "status.phase!=Running,status.phase!=Succeeded",
)
if not not_running.strip() or "No resources found" in not_running:
    ok("All pods Running or Succeeded")
else:
    warn(f"Non-Running pods:\n{not_running.rstrip()}")

pods = kubectl_json("get", "pods", "--all-namespaces", "-o", "json")
high_restart = [
    f"{p['metadata']['namespace']}/{p['metadata']['name']} restarts={cs['restartCount']}"
    for p in pods.get("items", [])
    for cs in (p.get("status", {}).get("containerStatuses") or [])
    if cs.get("restartCount", 0) > 2
]
if high_restart:
    warn("High-restart pods:\n" + "\n".join(high_restart))
else:
    ok("No pods with >2 restarts")

# ─── 4. PVC Status ───
out(f"\n{CYAN}── 4. PVC Status ──{NC}")
pvc_out = kubectl("get", "pvc", "--all-namespaces")
pending_pvc = [
    line
    for line in pvc_out.splitlines()
    if "Bound" not in line and not line.startswith("NAMESPACE")
]
if not pending_pvc:
    ok("All PVCs Bound")
else:
    issue("Non-Bound PVCs:\n" + "\n".join(pending_pvc))

# ─── 5. Recent Events ───
out(f"\n{CYAN}── 5. Recent Warning Events ──{NC}")
warn_events = kubectl(
    "get", "events", "--all-namespaces", "--field-selector", "type=Warning"
)
warn_tail = "\n".join(warn_events.splitlines()[-10:])
if not warn_tail.strip() or "No resources found" in warn_tail:
    ok("No warning events")
else:
    warn(f"Recent warnings:\n{warn_tail}")

# ─── 6. Internal Service Health (NodePorts) ───
out(f"\n{CYAN}── 6. Internal Service Health (NodePorts on {OMV_IP}) ──{NC}")
for name, port in NODEPORTS.items():
    code = http_code(f"http://{OMV_IP}:{port}", 5)
    if code == "000":
        issue(f"{name} (port {port}): TIMEOUT")
    elif code.startswith(("2", "3")):
        ok(f"{name} (port {port}): HTTP {code}")
    else:
        warn(f"{name} (port {port}): HTTP {code}")

# ─── 7. External Web Endpoints ───
out(f"\n{CYAN}── 7. External Web Endpoints (Cloudflare Tunnel) ──{NC}")
for host in EXTERNAL_HOSTS:
    code = http_code(f"https://{host}", 10)
    if code == "000":
        issue(f"{host}: DNS/timeout")
    elif code.startswith(("2", "3")):
        ok(f"{host}: HTTP {code}")
    else:
        warn(f"{host}: HTTP {code}")

# ─── 8. Cloudless-App API Health ───
out(f"\n{CYAN}── 8. Cloudless-App API Health ──{NC}")
try:
    health = json.loads(http_get("https://cloudless.gr/api/health", 10) or "{}")
except json.JSONDecodeError:
    health = {"status": "error"}
health_status = health.get("status", "error")
db_connected = health.get("dbConnected", False)
if health_status == "ok" and db_connected is True:
    ok("API healthy, D1 connected")
else:
    issue(f"API health: {health_status}, D1: {db_connected}")

# ─── 9. OOMKilled Detection ───
out(f"\n{CYAN}── 9. OOMKilled Pod Detection ──{NC}")
oom_pods = [
    f"{p['metadata']['namespace']}/{p['metadata']['name']} OOMKilled"
    for p in pods.get("items", [])
    for cs in (p.get("status", {}).get("containerStatuses") or [])
    if cs.get("lastState", {}).get("terminated", {}).get("reason") == "OOMKilled"
]
if not oom_pods:
    ok("No OOMKilled pods")
else:
    issue("OOMKilled pods:\n" + "\n".join(oom_pods))

# ─── 10. Memory Pressure Risk Assessment ───
out(f"\n{CYAN}── 10. Memory Pressure Risk ──{NC}")


def to_mib(qty: str) -> float:
    m = re.match(r"^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|M|G)?$", qty.strip())
    if not m:
        return 0.0
    val = float(m.group(1))
    unit = m.group(2) or ""
    factor = {
        "Ki": 1 / 1024,
        "Mi": 1,
        "Gi": 1024,
        "Ti": 1024 * 1024,
        "M": 1000 / 1024,
        "G": 1000 * 1000 / 1024,
    }.get(unit, 1)
    return val * factor


node_names = [
    item.get("metadata", {}).get("name", "")
    for item in nodes.get("items", [])
]
for node in node_names:
    desc = kubectl("describe", "node", node)
    allocatable = ""
    requested = ""
    lines = desc.splitlines()
    for i, line in enumerate(lines):
        if "Allocatable:" in line and i + 1 < len(lines):
            m = re.search(r"memory\s+(\S+)", lines[i + 1])
            if m:
                allocatable = m.group(1)
        if "Requests" in line and "memory" in line and not requested:
            m = re.search(r"memory\s+(\S+)", line)
            if m:
                requested = m.group(1)
    if allocatable and requested:
        alloc_mib = int(to_mib(allocatable))
        req_mib = int(to_mib(requested))
        if alloc_mib > 0:
            pct = req_mib * 100 // alloc_mib
            if pct > 90:
                issue(f"{node}: {req_mib}Mi/{alloc_mib}Mi requested ({pct}%) — CRITICAL")
            elif pct > 75:
                warn(f"{node}: {req_mib}Mi/{alloc_mib}Mi requested ({pct}%) — HIGH")
            else:
                ok(f"{node}: {req_mib}Mi/{alloc_mib}Mi requested ({pct}%)")

# ─── Summary ───
if not JSON_MODE:
    print(f"\n{CYAN}═══════════════════════════════════════════════════════════════{NC}")
    print(f"{CYAN}  Summary: {RED}{ISSUES} issues{NC}, {YELLOW}{WARNINGS} warnings{NC}")
    if ISSUES == 0 and WARNINGS == 0:
        print(f"{GREEN}  All systems healthy ✓{NC}")
    else:
        print("  Run specific doctor skills for each issue area")
    print(f"{CYAN}═══════════════════════════════════════════════════════════════{NC}")
else:
    print("  }")
    print("}")
