#!/usr/bin/env python3
"""Inventory every Tailscale device: online/offline, version vs latest
stable, and flag managed Linux hosts that need a fix or upgrade.

Auth: TS_API_KEY OR TS_CLIENT_ID + TS_CLIENT_SECRET (OAuth)

Usage:
  python3 scripts/tailscale-fleet-health.py
  FAIL_ON_ISSUES=1 python3 scripts/tailscale-fleet-health.py
  JSON_OUT=/tmp/fleet.json python3 scripts/tailscale-fleet-health.py"""

import json
import os
import re
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

TAILNET = ts_api.TAILNET
FAIL_ON_ISSUES = os.environ.get("FAIL_ON_ISSUES", "0").lower() in ("1", "true", "yes")
JSON_OUT = os.environ.get("JSON_OUT", "")

# Managed hosts (physical / always-on). Ephemeral GHA nodes and user
# laptops are reported but do not fail the job by default.
MANAGED_RE = re.compile(r"^(github-omv|omv|omv-main|omv-ha|omv-2)$")

if not (ts_api.TS_API_KEY or (ts_api.CLIENT_ID and ts_api.CLIENT_SECRET)):
    print("Set TS_API_KEY or TS_CLIENT_ID+TS_CLIENT_SECRET", file=sys.stderr)
    sys.exit(2)

print(f"==> Authenticated for tailnet {TAILNET}")

pkgs = json.loads(
    urllib.request.urlopen("https://pkgs.tailscale.com/stable/?mode=json", timeout=30).read()
)
LATEST = pkgs.get("TarballsVersion", "")
if not LATEST:
    print("Could not resolve latest Tailscale stable version", file=sys.stderr)
    sys.exit(1)
print(f"==> Latest stable Tailscale: {LATEST}")

devices = ts_api.get(f"tailnet/{TAILNET}/devices").get("devices") or []
now = datetime.now(UTC)


def short_name(d):
    return (d.get("name") or d.get("hostname") or "").split(".")[0].lower()


def ver_tuple(v: str):
    base = (v or "").split("-")[0].strip()
    parts = []
    for p in base.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def is_online(d):
    if d.get("connectedToControl") is True:
        return True
    if d.get("connectedToControl") is False:
        return False
    last = d.get("lastSeen")
    if not last:
        return False
    try:
        ts = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except ValueError:
        return False
    return (now - ts).total_seconds() < 300


rows = []
issues = []
for d in sorted(devices, key=lambda x: short_name(x)):
    short = short_name(d)
    os_name = (d.get("os") or d.get("osType") or "?").lower()
    cv = d.get("clientVersion") or ""
    ver = cv.split("-")[0] if cv else "?"
    online = is_online(d)
    outdated = bool(ver != "?" and ver_tuple(ver) < ver_tuple(LATEST))
    managed_host = bool(MANAGED_RE.match(short))
    row = {
        "hostname": short,
        "os": os_name,
        "online": online,
        "version": ver,
        "clientVersion": cv,
        "outdated": outdated,
        "latest": LATEST,
        "managed": managed_host,
        "tags": ",".join(d.get("tags") or []),
        "addresses": ",".join(d.get("addresses") or []),
        "id": d.get("id") or d.get("nodeId") or "",
    }
    rows.append(row)
    if managed_host and not online:
        issues.append(f"OFFLINE managed host: {short}")
    if managed_host and outdated:
        issues.append(f"OUTDATED managed host: {short} {ver} < {LATEST}")
    elif outdated and not managed_host:
        issues.append(f"OUTDATED (manual): {short} ({os_name}) {ver} < {LATEST}")

print(f"{'HOST':<22} {'OS':<10} {'STATE':<8} {'VERSION':<12} {'LATEST':<10} TAGS")
print("-" * 90)
for r in rows:
    state = "online" if r["online"] else "OFFLINE"
    flag = " *" if r["outdated"] else ""
    print(
        f"{r['hostname']:<22} {r['os']:<10} {state:<8} "
        f"{r['version'] + flag:<12} {r['latest']:<10} {r['tags']}"
    )

print()
print(f"Devices: {len(rows)}  Latest: {LATEST}  Issues: {len(issues)}")
for i in issues:
    print(f"  - {i}")

report = {
    "tailnet": None,
    "latest": LATEST,
    "generatedAt": now.isoformat(),
    "devices": rows,
    "issues": issues,
    "managedOffline": [r["hostname"] for r in rows if r["managed"] and not r["online"]],
    "managedOutdated": [r["hostname"] for r in rows if r["managed"] and r["outdated"]],
    "upgradeableLinux": [
        r["hostname"] for r in rows if r["managed"] and r["os"].startswith("linux")
    ],
}
report_path = JSON_OUT or "/tmp/tailscale-fleet-health.json"
with open(report_path, "w") as f:
    json.dump(report, f, indent=2)
print(f"\nWrote report → {report_path}")
print(f"REPORT_PATH={report_path}")

n_issues = len(report["issues"])
n_off = len(report["managedOffline"])
n_old = len(report["managedOutdated"])
print(f"Summary: issues={n_issues} managed_offline={n_off} managed_outdated={n_old}")

if FAIL_ON_ISSUES and (n_off or n_old):
    print("::error::Managed Tailscale hosts have offline or outdated clients")
    sys.exit(1)
