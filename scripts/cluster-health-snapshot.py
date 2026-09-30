#!/usr/bin/env python3
"""Comprehensive cluster health check — public surfaces, k3s, Grafana,
GitHub runners, SSH paths. Run before deciding "is it me or is it
broken?"

Usage: python3 scripts/cluster-health-snapshot.py"""

import json
import shutil
import socket
import ssl
import subprocess
import urllib.error
import urllib.request
from datetime import UTC, datetime


def print_check(label: str, expected: str, actual: str) -> None:
    icon = "✓" if actual == expected else "✗"
    print(f"  {icon}  {label:<40} expected={expected:<6} got={actual}")


def http_code(url: str, host_header: str = "", insecure: bool = False) -> str:
    ctx = ssl.create_default_context()
    if insecure:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"Host": host_header} if host_header else {})
    try:
        return str(urllib.request.urlopen(req, timeout=5, context=ctx).status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return ""


print("═" * 63)
print(f"  CLOUDLESS.GR HEALTH SNAPSHOT — {datetime.now(UTC):%Y-%m-%d %H:%M UTC}")
print("═" * 63)

print("\n▸ Public surfaces")
for label, url, expected in (
    ("Lambda /api/health", "https://cloudless.gr/api/health", "200"),
    ("Lambda /api/auth/session", "https://cloudless.gr/api/auth/session", "200"),
    ("Grafana", "https://grafana.cloudless.gr/api/health", "200"),
):
    print_check(label, expected, http_code(url))

print("\n▸ Pi cluster (LAN)")
print_check(
    "k3s ingress (192.168.1.128)",
    "200",
    http_code("https://192.168.1.128/api/health", host_header="cloudless.gr", insecure=True),
)

for ip in ("192.168.1.128", "192.168.1.130"):
    try:
        with socket.create_connection((ip, 22), timeout=3):
            state = "open"
    except OSError:
        state = "refused"
    print_check(f"SSH {ip}:22", "open", state)

print("\n▸ GitHub Actions runners")
if shutil.which("gh"):
    r = subprocess.run(
        ["gh", "api", "repos/Themis128/cloudless.gr/actions/runners"],
        capture_output=True,
        text=True,
    )
    try:
        runners = json.loads(r.stdout).get("runners", [])
        for run in runners:
            icon = "✓" if run.get("status") == "online" else "✗"
            busy = "busy" if run.get("busy") else "idle"
            print(f"  {icon}  {run.get('name'):<15} ({run.get('status')}, {busy})")
    except Exception as e:
        print(f"  ⚠  parse error: {e}")
else:
    print("  ⚠  gh CLI not installed")

print("\n▸ Recent workflows (last unique 8)")
if shutil.which("gh"):
    r = subprocess.run(
        [
            "gh",
            "run",
            "list",
            "--repo",
            "Themis128/cloudless.gr",
            "--limit",
            "15",
            "--json",
            "workflowName,conclusion,status",
        ],
        capture_output=True,
        text=True,
    )
    try:
        seen = {}
        for run in json.loads(r.stdout):
            wf = run["workflowName"]
            if wf not in seen:
                seen[wf] = run
        for wf, run in sorted(seen.items())[:8]:
            s = run.get("conclusion") or run.get("status") or "?"
            icon = (
                "✓"
                if s == "success"
                else "…"
                if s in ("in_progress", "queued")
                else "⏭"
                if s in ("skipped", "cancelled")
                else "✗"
            )
            print(f"  {icon}  {wf}: {s}")
    except Exception:
        pass

print("\n▸ TLS cert expiry")
now = datetime.now(UTC)
for host in ("cloudless.gr", "auth.cloudless.gr", "grafana.cloudless.gr"):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ss:
                cert = ss.getpeercert()
        expiry = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        expiry = expiry.replace(tzinfo=UTC)
        days = (expiry - now).days
        icon = "✓" if days >= 14 else ("⚠" if days >= 3 else "✗")
        print(f"  {icon}  {host:<40} {days} days left ({cert['notAfter']})")
    except Exception:
        print(f"  ✗  {host:<40} failed to check")

print()
print("═" * 63)
