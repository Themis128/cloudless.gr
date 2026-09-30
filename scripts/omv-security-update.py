#!/usr/bin/env python3
"""omv-security-update.py — Check and optionally apply Debian security
updates on OMV.

Runs ON the omv host (via Tailscale SSH from CI or manually).

Usage:
  omv-security-update.py            # Dry-run: list pending updates
  omv-security-update.py --apply    # Apply security updates
  omv-security-update.py --apply --only=unzip,zip,util-linux"""

import os
import re
import shutil
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

mode = "check"
only = ""
for arg in sys.argv[1:]:
    if arg == "--apply":
        mode = "apply"
    elif arg.startswith("--only="):
        only = arg.split("=", 1)[1]
    elif arg in ("--help", "-h"):
        print(__doc__)
        sys.exit(0)
    else:
        sys.exit(f"Unknown flag: {arg}")

pkg_list = ""
all_ok = "n/a"


def log(msg: str) -> None:
    print(f"[{datetime.now().astimezone():%Y-%m-%dT%H:%M:%S%z}] {msg}")


def out(cmd: list[str]) -> str:
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout


hostname = socket.gethostname()
apt_version = out(["apt", "--version"]).splitlines()[0] \
    if out(["apt", "--version"]) else "apt not found"
os_release = next((ln for ln in Path("/etc/os-release")
                   .read_text().splitlines()
                   if ln.startswith("VERSION=")), "unknown") \
    if Path("/etc/os-release").exists() else "unknown"

log("=== OMV Security Update Check ===")
log(f"Host: {hostname}")
log(f"OS: {os_release}")
log(f"APT: {apt_version}")
log(f"Mode: {mode}")
if only:
    log(f"Package filter: {only}")

# --- Security sources ---
sources = []
for p in ([Path("/etc/apt/sources.list")]
          + list(Path("/etc/apt/sources.list.d").glob("*"))):
    try:
        sources += [ln for ln in p.read_text().splitlines()
                    if ln.startswith("deb ") and
                    "security" in ln.lower()]
    except OSError:
        pass
if not sources:
    log("WARN: No Debian security sources found in apt sources")
else:
    log("Security sources detected:")
    for ln in sources:
        print(f"  {ln}")

# --- APT update ---
log("Running apt-get update...")
r = subprocess.run(["apt-get", "update"], capture_output=True,
                   text=True)
print(r.stdout, end="")
Path("/tmp/apt-update.log").write_text(r.stdout + r.stderr)
if r.returncode:
    log("WARN: apt-get update exited non-zero (may be transient)")

# --- Identify security updates ---
log("Checking for upgradable packages via apt...")
subprocess.run(["apt-get", "upgrade", "--simulate", "--assume-no"],
               capture_output=True)

apt_check = "/usr/lib/update-notifier/apt-check"
if os.access(apt_check, os.X_OK):
    log("Using apt-check for security update counting...")
    log(f"apt-check output: {out([apt_check]).strip()}")

upgradable = out(["apt", "list", "--upgradable"]).splitlines()[1:]

security_updates = []
for line in upgradable:
    if not line.strip():
        continue
    pkgname = line.split("/")[0]
    policy = out(["apt-cache", "policy", pkgname])
    lines = policy.splitlines()
    origin = ""
    found = False
    for i, ln in enumerate(lines):
        if "***" in ln:
            found = True
            continue
        if found and re.match(r"^ {5}", ln):
            origin = " ".join(ln.split()).strip("[]")
            break
    if re.search(r"security|trixie-security", origin, re.I):
        parts = line.split()
        version = parts[1] if len(parts) > 1 else ""
        security_updates.append(f"  {pkgname} → {version}")

log("")
log("=== Security Updates Available ===")
if security_updates:
    print("\n".join(security_updates))
else:
    log("No packages with security origin detected via apt list.")
    log("Checking known packages from apt-listchanges...")
    for pkg in ("unzip", "zip", "util-linux"):
        r = subprocess.run(
            ["dpkg-query", "-W", "-f", "${Version}", pkg],
            capture_output=True, text=True)
        installed = r.stdout.strip() or "not-installed"
        m = re.search(r"Candidate:\s*(\S+)",
                      out(["apt-cache", "policy", pkg]))
        candidate = m.group(1) if m else ""
        if installed != candidate and candidate and \
                candidate != "(none)":
            log(f"  {pkg}: {installed} → {candidate} "
                "(UPGRADE AVAILABLE)")
        else:
            log(f"  {pkg}: {installed} (up to date)")

# --- Apply if requested ---
if mode == "apply":
    log("")
    log("=== Applying Security Updates ===")
    if only:
        pkgs = [p for p in only.split(",") if p]
        pkg_list = ",".join(pkgs)
        log(f"Applying updates for specific packages: {pkg_list}")
    else:
        pkgs = [ln.split("/")[0] for ln in upgradable if ln.strip()]
        pkg_list = " ".join(pkgs)
        if not pkgs:
            log("No upgradable packages found. Nothing to apply.")
            sys.exit(0)
        log(f"Applying updates for all upgradable packages: {pkg_list}")

    log(f"Running apt-get install --only-upgrade --assume-yes "
        f"{' '.join(pkgs)}...")
    r = subprocess.run(
        ["apt-get", "install", "--only-upgrade", "--assume-yes", *pkgs],
        capture_output=True, text=True)
    Path("/tmp/apt-upgrade.log").write_text(r.stdout + r.stderr)
    print(r.stdout, end="")
    if r.returncode:
        log("ERROR: apt-get install failed")
        sys.exit(1)

    log("")
    log("=== Post-Upgrade Verification ===")
    all_ok_b = True
    for pkg in pkgs:
        r = subprocess.run(
            ["dpkg-query", "-W", "-f", "${Version}", pkg],
            capture_output=True, text=True)
        installed = r.stdout.strip() or "not-installed"
        m = re.search(r"Candidate:\s*(\S+)",
                      out(["apt-cache", "policy", pkg]))
        candidate = m.group(1) if m else ""
        if installed == candidate:
            log(f"  ✅ {pkg}: {installed}")
        else:
            log(f"  ❌ {pkg}: installed={installed}, "
                f"candidate={candidate}")
            all_ok_b = False
    all_ok = "true" if all_ok_b else "false"
    log("All packages upgraded successfully." if all_ok_b
        else "WARNING: Some packages did not reach the candidate "
             "version.")

    if shutil.which("needrestart"):
        log("")
        log("=== Services/Processes Requiring Restart ===")
        r = subprocess.run(["needrestart", "-r", "a", "-b"],
                           capture_output=True, text=True)
        Path("/tmp/needrestart.log").write_text(
            r.stdout + r.stderr)
        print(r.stdout, end="")
    else:
        log("needrestart not installed — skipping restart check.")
else:
    log("")
    log("Dry-run mode. To apply updates, run with --apply")

log("")
log("=== Summary ===")
log(f"Hostname: {hostname}")
log(f"Mode: {mode}")
ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
log(f"Done at: {ts}")

Path("/tmp/security-update-summary.txt").write_text(
    f"hostname={hostname}\nos={os_release}\nmode={mode}\n"
    f"timestamp={ts}\npackages_updated={pkg_list}\nall_ok={all_ok}\n")
log("Summary written to /tmp/security-update-summary.txt")
