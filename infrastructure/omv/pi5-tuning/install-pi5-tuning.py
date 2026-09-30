#!/usr/bin/env python3
"""install-pi5-tuning.py — durable Raspberry Pi 5 (omv) host tuning.

Port of install-pi5-tuning.sh.

Run on omv as root (or via ssh):
  sudo python3 infrastructure/omv/pi5-tuning/install-pi5-tuning.py
  # or from laptop:
  ssh omv-lan 'sudo python3 -' < infrastructure/omv/pi5-tuning/install-pi5-tuning.py
  (note: when piped, fragments must already be installed — see below)

Safe to re-run. Optionally restarts k3s when K3S_RESTART=1 (default).
"""

import os
import subprocess
import sys
import time
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent
K3S_RESTART = os.environ.get("K3S_RESTART", "1") == "1"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=check)


def install(src: Path, mode: int, dest: str) -> None:
    subprocess.run(["install", "-m", str(mode), str(src), dest], check=True)


def install_d(mode: int, dest: str) -> None:
    subprocess.run(["install", "-d", "-m", str(mode), dest], check=True)


if not REPO_DIR.is_dir():
    print("[pi5-tuning] ERROR: run from a repo checkout (needs fragment files)", file=sys.stderr)
    sys.exit(1)

print(f"[pi5-tuning] installing from {REPO_DIR}")

install_d(755, "/etc/systemd/system.conf.d")
install(
    REPO_DIR / "zzz-cloudless-watchdog.conf",
    644,
    "/etc/systemd/system.conf.d/zzz-cloudless-watchdog.conf",
)
# Remove one-off emergency drop-in if present (superseded).
Path("/etc/systemd/system.conf.d/zzz-cloudless-watchdog-relax.conf").unlink(missing_ok=True)

install_d(755, "/etc/sysctl.d")
install(REPO_DIR / "zzz-cloudless-pi5-vm.conf", 644, "/etc/sysctl.d/zzz-cloudless-pi5-vm.conf")

install_d(755, "/etc/systemd/journald.conf.d")
install(REPO_DIR / "journald-pi5.conf", 644, "/etc/systemd/journald.conf.d/cloudless-pi5.conf")

install_d(755, "/etc/systemd/system/docker.service.d")
install(
    REPO_DIR / "docker-after-k3s.conf",
    644,
    "/etc/systemd/system/docker.service.d/10-after-k3s.conf",
)

install(REPO_DIR / "cloudless-boot-stagger.py", 755, "/usr/local/sbin/cloudless-boot-stagger.py")
# Compat wrapper for callers that still invoke the .sh path
Path("/usr/local/sbin/cloudless-boot-stagger.sh").write_text(
    '#!/bin/sh\nexec python3 /usr/local/sbin/cloudless-boot-stagger.py "$@"\n'
)
os.chmod("/usr/local/sbin/cloudless-boot-stagger.sh", 0o755)
install(
    REPO_DIR / "cloudless-boot-stagger.service",
    644,
    "/etc/systemd/system/cloudless-boot-stagger.service",
)

# GHA runner delay drop-ins (unit names discovered dynamically).
install_d(755, "/etc/systemd/system")
r = run("systemctl", "list-unit-files", "actions.runner.*.service", "--no-legend", check=False)
for line in (r.stdout or "").splitlines():
    unit = line.split()[0] if line.split() else ""
    if not unit:
        continue
    drop = f"/etc/systemd/system/{unit}.d"
    install_d(755, drop)
    install(REPO_DIR / "gha-runner-delay.conf", 644, f"{drop}/10-boot-delay.conf")
    print(f"[pi5-tuning] runner delay → {unit}")

# Merge kubelet reserved args into k3s config (idempotent marker).
K3S_CFG = Path("/etc/rancher/k3s/config.yaml")
K3S_CFG.parent.mkdir(parents=True, exist_ok=True)
K3S_CFG.touch(exist_ok=True)
if "cloudless-pi5-kubelet-reserved" not in K3S_CFG.read_text():
    fragment = (REPO_DIR / "k3s-kubelet-reserved.yaml.fragment").read_text()
    with K3S_CFG.open("a") as fh:
        fh.write(
            f"\n# BEGIN cloudless-pi5-kubelet-reserved\n{fragment}# END cloudless-pi5-kubelet-reserved\n"
        )
    print(f"[pi5-tuning] appended kubelet reserved to {K3S_CFG}")
else:
    print(f"[pi5-tuning] kubelet reserved already present in {K3S_CFG}")

# udev SSD rules (reaffirm)
ssd_rules = REPO_DIR / "../60-ssd-rotational.rules"
if ssd_rules.is_file():
    try:
        install(ssd_rules, 644, "/etc/udev/rules.d/60-ssd-rotational.rules")
    except subprocess.CalledProcessError:
        pass

if run("sysctl", "--system", check=False).returncode != 0:
    run("sysctl", "-p", "/etc/sysctl.d/zzz-cloudless-pi5-vm.conf", check=False)
run("systemctl", "daemon-reexec", check=False)
run("systemctl", "daemon-reload", check=False)
run("systemctl", "restart", "systemd-journald", check=False)
run("systemctl", "enable", "cloudless-boot-stagger.service")

r = run("systemctl", "show", "-p", "RuntimeWatchdogUSec", "--value", check=False)
print(f"[pi5-tuning] RuntimeWatchdogSec={(r.stdout or '').strip()}")
r = run("/sbin/sysctl", "-n", "vm.swappiness", check=False)
print(f"[pi5-tuning] vm.swappiness={(r.stdout or '').strip()}")

# OMV-flavoured unit name on this host is k3s-k3s-omv.service (not k3s.service).
K3S_UNIT = ""
for u in ("k3s-k3s-omv.service", "k3s.service"):
    if run("systemctl", "cat", u, check=False).returncode == 0:
        K3S_UNIT = u
        break
if K3S_RESTART and K3S_UNIT:
    print(f"[pi5-tuning] restarting {K3S_UNIT} to apply kubelet reserved (brief blip)…")
    run("systemctl", "restart", K3S_UNIT)
    time.sleep(8)
    if run("systemctl", "is-active", K3S_UNIT, check=False).returncode == 0:
        print(f"[pi5-tuning] {K3S_UNIT} active")
elif not K3S_UNIT:
    print("[pi5-tuning] WARN: no k3s unit found — kubelet reserved needs a manual restart")

print("[pi5-tuning] done")
print("  Verify: systemctl show -p RuntimeWatchdogUSec")
print("          kubectl describe node omv | grep -A20 Allocatable")
print("          free -h; uptime")
