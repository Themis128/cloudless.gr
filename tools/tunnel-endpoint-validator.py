#!/usr/bin/env python3
"""tunnel-endpoint-validator.py — Validate Cloudflare Tunnel config against actual k3s services.

Port of tunnel-endpoint-validator.sh.
Usage: python3 tools/tunnel-endpoint-validator.py

Cross-references:
  1. infrastructure/cloudflare-tunnels/cloudflared-config.yml (tunnel ingress rules)
  2. Actual k3s NodePort services (kubectl get svc)
  3. External DNS resolution (socket.getaddrinfo)
  4. Internal service health (NodePort HTTP checks)

Detects:
  - Tunnel rules pointing to non-existent NodePorts
  - NodePort services not exposed via tunnel
  - DNS records that don't resolve
  - Domain mismatches (e.g., cloudflow.gr vs cloudless.gr)
"""

import json
import re
import socket
import subprocess
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"

OMV_IP = "192.168.1.128"
CONFIG_FILE = Path("infrastructure/cloudflare-tunnels/cloudflared-config.yml")


def kubectl(*args: str) -> str:
    try:
        r = subprocess.run(
            ["kubectl", *args], capture_output=True, text=True, timeout=60, check=False
        )
        return r.stdout or ""
    except Exception:
        return ""


def http_code(url: str, timeout: int) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "tunnel-validator"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return str(resp.status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return "000"


def dns_resolve(host: str) -> str:
    try:
        infos = socket.getaddrinfo(host, None)
        addrs = sorted({i[4][0] for i in infos})
        return " ".join(addrs)
    except socket.gaierror:
        return ""


ts = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
print(f"{CYAN}╔══════════════════════════════════════════════════════════════╗{NC}")
print(f"{CYAN}║  Tunnel Endpoint Validator — {ts}{NC}")
print(f"{CYAN}╚══════════════════════════════════════════════════════════════╝{NC}")

# ─── 1. Parse tunnel config ───
print(f"\n{CYAN}── 1. Tunnel Config Ingress Rules ──{NC}")
if not CONFIG_FILE.is_file():
    print(f"{RED}✗{NC} Config file not found: {CONFIG_FILE}")
    sys.exit(1)

config_text = CONFIG_FILE.read_text()
tunnel_rules: dict[str, str] = {}
current_host = ""
for line in config_text.splitlines():
    m = re.search(r"hostname:\s+(.+)", line)
    if m:
        current_host = m.group(1).strip()
        continue
    m = re.search(r"service:\s+http://.+:(\d+)", line)
    if m and current_host:
        tunnel_rules[current_host] = m.group(1)
        print(f"  {current_host} → port {m.group(1)}")

# ─── 2. Get actual k3s NodePort services ───
print(f"\n{CYAN}── 2. Actual k3s NodePort Services ──{NC}")
try:
    svcs = json.loads(kubectl("get", "svc", "--all-namespaces", "-o", "json"))
except json.JSONDecodeError:
    svcs = {}

nodeport_svcs: list[tuple[str, str]] = []  # (ns/name, port)
for item in svcs.get("items", []):
    if item.get("spec", {}).get("type") != "NodePort":
        continue
    meta = item.get("metadata", {})
    svc_name = f"{meta.get('namespace', '')}/{meta.get('name', '')}"
    ports = [
        str(p.get("nodePort"))
        for p in item.get("spec", {}).get("ports", [])
        if p.get("nodePort") is not None
    ]
    print(f"  {svc_name} → NodePort(s): {','.join(ports)}")
    nodeport_svcs.extend((svc_name, port) for port in ports)


def svc_for_port(port: str) -> str:
    for svc_name, p in nodeport_svcs:
        if p == port:
            return svc_name
    return ""


# ─── 3. Validate each tunnel rule ───
print(f"\n{CYAN}── 3. Tunnel Rule Validation ──{NC}")
issues = 0
for host, port in tunnel_rules.items():
    if port in ("80", "21"):
        print(f"{GREEN}✓{NC} {host} → localhost:{port} (host-level service, skip NodePort check)")
        continue

    svc = svc_for_port(port)
    if not svc:
        print(f"{RED}✗{NC} {host} → port {port} — NO NodePort service found!")
        issues += 1
    else:
        code = http_code(f"http://{OMV_IP}:{port}", 5)
        if code == "000":
            print(f"{RED}✗{NC} {host} → port {port} ({svc}) — TIMEOUT on internal curl")
            issues += 1
        elif code.startswith(("2", "3")):
            print(f"{GREEN}✓{NC} {host} → port {port} ({svc}) — internal HTTP {code}")
        else:
            print(f"{YELLOW}⚠{NC} {host} → port {port} ({svc}) — internal HTTP {code}")

    dns = dns_resolve(host)
    if not dns:
        print(f"{RED}✗{NC}   DNS: {host} does NOT resolve!")
        issues += 1
    else:
        print(f"{GREEN}✓{NC}   DNS: {host} → {dns}")

    ext_code = http_code(f"https://{host}", 10)
    if ext_code == "000":
        print(f"{RED}✗{NC}   Web: https://{host} — TIMEOUT/UNREACHABLE")
        issues += 1
    elif ext_code.startswith(("2", "3")):
        print(f"{GREEN}✓{NC}   Web: https://{host} — HTTP {ext_code}")
    else:
        print(f"{YELLOW}⚠{NC}   Web: https://{host} — HTTP {ext_code}")
    print("")

# ─── 4. Check for NodePort services NOT in tunnel config ───
print(f"{CYAN}── 4. NodePort Services NOT in Tunnel Config ──{NC}")
tunnel_ports = set(tunnel_rules.values())
for svc_name, port in nodeport_svcs:
    if port not in tunnel_ports:
        print(f"{YELLOW}⚠{NC} {svc_name} (NodePort {port}) — not exposed via tunnel")

# ─── 5. Known domain mismatch check ───
print(f"\n{CYAN}── 5. Known Domain Issues ──{NC}")
if "cloudflow.gr" in config_text:
    print(f"{RED}✗{NC} Found 'cloudflow.gr' in tunnel config — should be 'cloudless.gr'")
    issues += 1
else:
    print(f"{GREEN}✓{NC} No 'cloudflow.gr' domain typo in config")

stale: list[str] = []
for doc_dir in (Path(".clinerules"), Path("docs")):
    if doc_dir.is_dir():
        for f in doc_dir.rglob("*"):
            if f.is_file():
                try:
                    text = f.read_text(errors="replace")
                except OSError:
                    continue
                for i, line in enumerate(text.splitlines(), 1):
                    if "cloudflow.gr" in line:
                        stale.append(f"{f}:{i}: {line.strip()}")
                        break
            if len(stale) >= 5:
                break
if stale:
    print(f"{YELLOW}⚠{NC} Stale 'cloudflow.gr' references found in docs:")
    print("\n".join(stale[:5]))
    print("  → These should be updated to 'cloudless.gr'")
else:
    print(f"{GREEN}✓{NC} No stale 'cloudflow.gr' references in docs")

# ─── Summary ───
print(f"\n{CYAN}═══════════════════════════════════════════════════════════════{NC}")
if issues == 0:
    print(f"{GREEN}  All tunnel endpoints valid ✓{NC}")
else:
    print(f"{RED}  {issues} issue(s) found{NC}")
print(f"{CYAN}═══════════════════════════════════════════════════════════════{NC}")
