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

from __future__ import annotations

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


def step(msg: str) -> None:
    print(f"\n=== {msg} ===")


def format_threshold(target: str, old_literal: str) -> str:
    """Preserve float style when the original had a decimal (8.0 -> 12.0)."""
    if "." in old_literal and "." not in target:
        try:
            return f"{float(target):.1f}"
        except ValueError:
            return target
    return target


def run_monit_t() -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["monit", "-t"],
        capture_output=True,
        text=True,
        check=False,
    )


def print_monit_t(label: str, proc: subprocess.CompletedProcess[str]) -> None:
    print(f"  monit -t ({label}): exit={proc.returncode}")
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if out:
        print("  --- stdout ---")
        print(out)
    if err:
        print("  --- stderr ---", file=sys.stderr)
        print(err, file=sys.stderr)


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
    target_raw = args.threshold_1min

    step(f"1/4 discover loadavg (1min) checks — target threshold {target_raw}")
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

    if args.apply:
        step("2/4 baseline monit -t (before rewrite)")
        baseline = run_monit_t()
        print_monit_t("baseline", baseline)
        if baseline.returncode != 0:
            print(
                "  baseline monit -t already failing — refusing to rewrite "
                "(fix the existing config first)",
                file=sys.stderr,
            )
            return 1
    else:
        step("2/4 baseline monit -t (skipped in preview)")
        print("  [preview] would run: monit -t (baseline)")

    step("3/4 rewrite 1-min thresholds")
    changed_files: dict[Path, str] = {}
    seen: set[Path] = set()
    for path, _ in hits:
        if path in seen:
            continue
        seen.add(path)
        text = path.read_text()

        def _sub(m: re.Match[str]) -> str:
            formatted = format_threshold(target_raw, m.group(2))
            return f"{m.group(1)}{formatted}"

        new_text = LOADAVG_1MIN.sub(_sub, text)
        if new_text == text:
            print(f"  {path}: already at target — no change")
            continue
        old_vals = ", ".join(m.group(2) for m in LOADAVG_1MIN.finditer(text))
        new_vals = ", ".join(m.group(2) for m in LOADAVG_1MIN.finditer(new_text))
        print(f"  {path}: {old_vals} -> {new_vals}")
        if args.apply:
            backup_path = Path(f"{path}.bak-{BACKUP_TS}")
            shutil.copy2(path, backup_path)
            print(f"  backup: {backup_path}")
            path.write_text(new_text)
        else:
            print("  [preview] would rewrite this file")
        changed_files[path] = new_text

    if not changed_files:
        print("\nnothing to do — all 1-min loadavg thresholds already at target")
        return 0

    step("4/4 validate + reload (only when applying)")
    if not args.apply:
        print("  [preview] would run: monit -t && monit reload")
        return 0

    after = run_monit_t()
    print_monit_t("after rewrite", after)
    if after.returncode == 0:
        subprocess.run(["monit", "reload"], check=False)
        print("  monit: config OK, reloaded")
    else:
        print("  monit -t FAILED — restoring backups", file=sys.stderr)
        for path in changed_files:
            backup_path = Path(f"{path}.bak-{BACKUP_TS}")
            if backup_path.is_file():
                shutil.copy2(backup_path, path)
                print(f"  restored {path} from {backup_path}")
        return 1

    print("\ndone — monit 1-min loadavg threshold is now", target_raw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
