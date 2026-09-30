#!/usr/bin/env python3
"""setup-ai-swap.py — create a 6 GB swapfile on sdb1 (1 TB user-data SSD).

Port of setup-ai-swap.sh.

Run once on omv-main as root. Safe to re-run — skips steps already done.

Why sdb1 and not sda1:
  sda1 (119 GB) is the dedicated k3s SSD — every extra write there eats
  into the headroom that k3s, etcd, and local-path PVCs depend on.
  sdb1 (916 GB) holds only Windows backups; 6 GB is <1% of free space.

Result: 8 GB RAM + 6 GB swap = 14 GB effective address space.
This lets vllm-kimi (~4.5 GB) run alongside the full k3s stack without
OOM-killing other pods.  vm.swappiness=15 keeps swap as a last resort
during normal operation; the kernel promotes it automatically when the
AI model load pushes RSS above physical RAM.

Usage:
  sudo python3 infrastructure/omv/setup-ai-swap.py
"""

import os
import subprocess
import sys
from pathlib import Path

SDB1_MOUNT = Path("/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7")
SWAPFILE = SDB1_MOUNT / "ai-swap.swp"
SWAP_SIZE_GB = 6
SWAPPINESS = 15


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


# ── 1. Verify sdb1 is mounted ────────────────────────────────────────────────
if run("mountpoint", "-q", str(SDB1_MOUNT)).returncode != 0:
    print(f"ERROR: {SDB1_MOUNT} is not mounted. Check OMV mounts.", file=sys.stderr)
    sys.exit(1)

r = run("df", "-BG", str(SDB1_MOUNT))
lines = (r.stdout or "").splitlines()
avail_gb = int(lines[1].split()[3].rstrip("G")) if len(lines) >= 2 else 0
print(f"→ sdb1 available: {avail_gb} GB")
if avail_gb < SWAP_SIZE_GB + 5:
    print(f"ERROR: less than {SWAP_SIZE_GB + 5} GB free on sdb1.", file=sys.stderr)
    sys.exit(1)

# ── 2. Create swapfile (skip if it exists and is the right size) ──────────────
EXPECTED_SIZE = SWAP_SIZE_GB * 1024 * 1024 * 1024
if SWAPFILE.is_file():
    current_size = SWAPFILE.stat().st_size
    if current_size >= EXPECTED_SIZE:
        print(
            f"→ swapfile already exists at correct size ({current_size} bytes) — skipping creation"
        )
    else:
        print("→ swapfile exists but wrong size — recreating")
        run("swapoff", str(SWAPFILE))
        SWAPFILE.unlink()
        run("fallocate", "-l", f"{SWAP_SIZE_GB}G", str(SWAPFILE))
else:
    print(f"→ creating {SWAP_SIZE_GB} GB swapfile at {SWAPFILE}")
    run("fallocate", "-l", f"{SWAP_SIZE_GB}G", str(SWAPFILE))

os.chmod(SWAPFILE, 0o600)
if "swap file" not in (run("file", str(SWAPFILE)).stdout or ""):
    run("mkswap", str(SWAPFILE))

# ── 3. Enable swap now ────────────────────────────────────────────────────────
if str(SWAPFILE) in (run("swapon", "--show=NAME").stdout or ""):
    print(f"→ swap already active on {SWAPFILE}")
else:
    run("swapon", str(SWAPFILE))
    print("→ swap activated")

print((run("swapon", "--show").stdout or "").rstrip())
print((run("free", "-h").stdout or "").rstrip())

# ── 4. Persist in /etc/fstab ──────────────────────────────────────────────────
FSTAB_ENTRY = f"{SWAPFILE} none swap sw,nofail 0 0"
fstab = Path("/etc/fstab").read_text()
if str(SWAPFILE) in fstab:
    print("→ /etc/fstab entry already present — skipping")
else:
    with Path("/etc/fstab").open("a") as fh:
        fh.write(FSTAB_ENTRY + "\n")
    print(f"→ added to /etc/fstab: {FSTAB_ENTRY}")

# ── 5. Set vm.swappiness (low = swap only under real pressure) ────────────────
run("sysctl", "-w", f"vm.swappiness={SWAPPINESS}")

SYSCTL_CONF = Path("/etc/sysctl.d/60-cloudless-swap.conf")
if not SYSCTL_CONF.is_file() or "vm.swappiness" not in SYSCTL_CONF.read_text():
    SYSCTL_CONF.write_text(f"""\
# Swap tuning for AI workloads on omv-main (Pi 5, 8 GB + 6 GB swap on sdb1).
# Low swappiness = only swap under real RAM pressure, not proactively.
vm.swappiness = {SWAPPINESS}
# Keep vfs cache pressure moderate so file metadata stays cached.
vm.vfs_cache_pressure = 50
""")
    print(f"→ wrote {SYSCTL_CONF}")
else:
    print(f"→ {SYSCTL_CONF} already configured")

run("sysctl", "-p", str(SYSCTL_CONF))

print()
print("✅ Done — 6 GB swap on sdb1 active and persistent.")
print("   Effective memory: 8 GB RAM + 6 GB swap = 14 GB")
print(f"   vm.swappiness = {SWAPPINESS} (swap used only under real pressure)")
print()
print("   Scale AI up:   gh workflow run ai-scale.yml -f action=up")
print("   Scale AI down: gh workflow run ai-scale.yml -f action=down")
