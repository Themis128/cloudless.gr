#!/usr/bin/env python3
"""install-monit-loadavg-tune.py — omv: retune monit's 1-min loadavg alert threshold.

omv is a 4-core arm64 Pi running single-node k3s with the entire stack on it
(appflowy, espocrm+mariadb, cloudless-app, docs-server) plus hourly
mariadb-xbstream backups, WAL-G basebackup cronjobs, pod rollouts AND three
self-hosted GitHub Actions runners, with CPU limits overcommitted to ~367%.
That fan-in routinely pushes loadavg(1min) past the stock threshold (8) for a
minute or two, then drains — firing a failure alert and a "Resource limit
succeeded" recovery mail minutes later. Observed 2026-10-04 14:33 (recovery
at loadavg 7.8; runners were idle by then).

This tool retunes ONLY the `loadavg (1min)` alert threshold (default 12 — 3x
cores; sustained load at that level is a genuine meltdown on this box).
5-min/15-min checks are left untouched, so slower saturation still alerts.

Discovery scans /etc/monit/monitrc, monitrc.d/*, conf.d/* and
conf-available/* for `loadavg (1min)` lines and shows exactly what would
change before anything is modified.

Usage (on omv, as root):
  sudo python3 install-monit-loadavg-tune.py                        # preview
  sudo python3 install-monit-loadavg-tune.py --apply                # apply (threshold 12)
  sudo python3 install-monit-loadavg-tune.py --apply --threshold-1min=10

Every edited file gets a timestamped .bak backup; `monit -t` is validated
before reload and backups are restored if validation fails. NOTE: OMV may
regenerate monitrc.d content on package upgrades / config apply — re-run this
tool if the threshold ever reverts.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path


def _dir_files(d: str) -> list[Path]:
    p = Path(d)
    return sorted(p.glob("*")) if p.is_dir() else []


SCAN_PATHS = [
    Path("/etc/monit/monitrc"),
    *_dir_files("/etc/monit/monitrc.d"),
    *_dir_files("/etc/monit/conf.d"),
    *_dir_files("/etc/monit/conf-available"),
]

# `if loadavg (1min) > 8 then alert` — capture the comparison operator too so
# we only rewrite the numeric threshold and never the surrounding syntax.
LOADAVG_1MIN = re.compile(r"(loadavg\s*\(\s*1min\s*\)\s*[><]\s*)([0-9]+(?:\.[0-9]+)?)")

BACKUP_TS = time.strftime("%Y%m%d-%H%M%S")
# Monit's include globs pick up EVERYTHING under conf.d/monitrc.d/ — a .bak
# file parked next to the live config would be parsed as config and fail
# `monit -t` with a duplicate-service error (observed 2026-10-04). Backups
# therefore live outside the include tree.
BACKUP_DIR = Path("/var/backups/monit-loadavg-tune")


def _format_like(old: str, target: str) -> str:
    """Keep the original numeric style (monit accepts both, but stay consistent)."""
    if "." in old and "." not in target:
        return target + ".0"
    return target


def _sweep_stray_backups() -> None:
    """Remove .bak-* files this tool previously left inside monit include dirs."""
    for d in ("/etc/monit/conf.d", "/etc/monit/monitrc.d"):
        p = Path(d)
        if not p.is_dir():
            continue
        for stray in sorted(p.glob("openmediavault-*.conf.bak-*")):
            print(f"  removing stray backup from include path: {stray}")
            stray.unlink(missing_ok=True)


def step(msg: str) -> None:
    print(f"\n=== {msg} ===")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="apply changes (default: preview only)")
    ap.add_argument(
        "--threshold-1min",
        default="12",
        help="target loadavg(1min) alert threshold (default: 12)",
    )
    args = ap.parse_args()

    if args.apply and os.geteuid() != 0:
        print("must be root to apply (try sudo)", file=sys.stderr)
        return 1
    try:
        float(args.threshold_1min)
    except ValueError:
        print(f"invalid threshold: {args.threshold_1min!r}", file=sys.stderr)
        return 1
    target = args.threshold_1min

    step(f"1/3 discover loadavg (1min) checks — target threshold {target}")
    if args.apply:
        _sweep_stray_backups()
    hits: list[tuple[Path, int]] = []  # (file, line index)
    for path in SCAN_PATHS:
        if not path.is_file():
            continue
        try:
            lines = path.read_text().splitlines()
        except OSError as e:
            print(f"  skipping {path}: {e}")
            continue
        for i, line in enumerate(lines):
            if LOADAVG_1MIN.search(line):
                hits.append((path, i))
                print(f"  {path}:{i + 1}: {line.strip()}")

    if not hits:
        print(
            "  no `loadavg (1min)` check found under /etc/monit — OMV version may "
            "place it elsewhere; inspect with: grep -rn loadavg /etc/monit/"
        )
        return 1

    step("2/3 rewrite 1-min thresholds")
    # (file, backup, rewritten text) for everything we touch
    changed_files: list[tuple[Path, Path, str]] = []
    for path, _ in {h[0]: h[1] for h in hits}.items():  # dedupe, preserve order
        text = path.read_text()
        new_text = LOADAVG_1MIN.sub(
            lambda m: f"{m.group(1)}{_format_like(m.group(2), target)}", text
        )
        if new_text == text:
            print(f"  {path}: already at threshold {target} — no change")
            continue
        old_vals = ", ".join(m.group(2) for m in LOADAVG_1MIN.finditer(text))
        print(f"  {path}: {old_vals} -> {_format_like(old_vals.split(', ')[0], target)}")
        if args.apply:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            backup = BACKUP_DIR / f"{path.name}.bak-{BACKUP_TS}"
            shutil.copy2(path, backup)
            print(f"  backup: {backup} (outside monit include globs)")
            path.write_text(new_text)
        else:
            print("  [preview] would rewrite this file")
        changed_files.append((path, BACKUP_DIR / f"{path.name}.bak-{BACKUP_TS}", new_text))

    if not changed_files:
        print("\nall 1-min loadavg thresholds already at target")
        if not args.apply:
            return 0
        # Converge: someone may have edited the config out-of-band (hand-tune,
        # OMV upgrade) without validating/reloading. A reload of an unchanged,
        # validated config is safe and makes the runtime state provable.
        print("converging: monit -t && monit reload")
        changed_files = []  # nothing to restore; fall through to validate+reload

    step("3/3 validate + reload (only when applying)")
    if not args.apply:
        print("  [preview] would run: monit -t && monit reload")
        return 0

    probe = subprocess.run(["monit", "-t"], capture_output=True, text=True, check=False)
    if probe.returncode == 0:
        subprocess.run(["monit", "reload"], check=False)
        print("  monit: config OK, reloaded")
    else:
        print("  monit -t FAILED — restoring backups", file=sys.stderr)
        if probe.stdout:
            print(probe.stdout, file=sys.stderr)
        if probe.stderr:
            print(probe.stderr, file=sys.stderr)
        for path, backup, _ in changed_files:
            if backup.is_file():
                shutil.copy2(backup, path)
                print(f"  restored {path} from {backup}")
        return 1

    print("\ndone — monit 1-min loadavg threshold is now", target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
