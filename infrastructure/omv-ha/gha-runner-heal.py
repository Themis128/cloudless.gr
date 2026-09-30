#!/usr/bin/env python3
"""gha-runner-heal.py — clear ghost-busy / dead GitHub Actions runners after reboot.

Port of gha-runner-heal.sh.

After a host power-cycle or sleep, the runner service can look "active" locally
while GitHub still shows the runner offline+busy, blocking the job queue.
This script:
  1. On boot (--boot): always restart every actions.runner.*.service
  2. Periodically (--check): restart any unit that is active but has no
     Runner.Listener process (wedged listener)

Safe to run while idle. Does NOT interrupt a healthy busy runner that has a
live Listener (active jobs keep working).

Usage: gha-runner-heal.py --boot|--check
"""

import re
import subprocess
import sys
import time

MODE = sys.argv[1] if len(sys.argv) > 1 else "--check"
LOG_TAG = "gha-runner-heal"


def log(msg: str) -> None:
    print(f"[{LOG_TAG}] {msg}")
    subprocess.run(["logger", "-t", LOG_TAG, msg], check=False, capture_output=True)


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


def list_runner_units() -> list[str]:
    r = run("systemctl", "list-units", "--type=service", "--all", "--no-legend", "actions.runner.*")
    return [
        line.split()[0]
        for line in (r.stdout or "").splitlines()
        if line.strip() and re.match(r"^actions\.runner\.", line.split()[0])
    ]


def listener_alive() -> bool:
    return run("pgrep", "-f", "[R]unner.Listener").returncode == 0


def listener_alive_for_unit(unit: str) -> bool:
    # WorkingDirectory from the unit points at the runner install (…/actions-runner*)
    cwd = run("systemctl", "show", "-p", "WorkingDirectory", "--value", unit).stdout.strip()
    if not cwd or cwd == "/":
        # Fallback: any Runner.Listener owned by the runner user
        return listener_alive()
    if not listener_alive():
        return False
    # Prefer a listener whose cwd/cmdline references this install path
    r = run("pgrep", "-af", "[R]unner.Listener")
    if cwd in (r.stdout or ""):
        return True
    # If only one runner on the box, any Listener is enough
    if len(list_runner_units()) <= 1 and listener_alive():
        return True
    # Multi-runner host without path match: treat as missing for this unit
    return False


def restart_unit(unit: str) -> None:
    log(f"restarting {unit}")
    if run("systemctl", "restart", unit).returncode != 0:
        log(f"WARN: restart failed for {unit}")


if MODE == "--boot":
    log("boot heal: restarting all actions.runner.* services")
    time.sleep(5)  # let network-online settle
    units = list_runner_units()
    if not units:
        log("no actions.runner.* units found")
        sys.exit(0)
    for unit in units:
        restart_unit(unit)
    time.sleep(3)
    for unit in units:
        state = run("systemctl", "is-active", unit).stdout.strip() or "unknown"
        log(f"{unit} → {state}")
elif MODE == "--check":
    for unit in list_runner_units():
        state = run("systemctl", "is-active", unit).stdout.strip() or "inactive"
        if state != "active":
            log(f"{unit} is {state} — starting")
            if run("systemctl", "start", unit).returncode != 0:
                log(f"WARN: start failed for {unit}")
            continue
        if listener_alive_for_unit(unit):
            continue
        log(f"{unit} active but Runner.Listener missing — restarting (ghost/wedge)")
        restart_unit(unit)
else:
    print(f"Usage: {sys.argv[0]} --boot|--check", file=sys.stderr)
    sys.exit(2)
