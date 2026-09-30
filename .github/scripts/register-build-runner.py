#!/usr/bin/env python3
"""Register a second GitHub Actions runner on a Pi host with the `build` label.

Port of register-build-runner.sh.

Usage:
  On each of omv, omv-2, omv-3:
    curl -fsSL https://raw.githubusercontent.com/Themis128/cloudless.gr/main/.github/scripts/register-build-runner.py | python3 - <REG_TOKEN> <RUNNER_NAME>
  Or local:
    python3 register-build-runner.py <REG_TOKEN> <RUNNER_NAME>

Get REG_TOKEN from:
  https://github.com/Themis128/cloudless.gr/settings/actions/runners → New self-hosted runner

RUNNER_NAME should be like: omv-build, omv-2-build, omv-3-build

This installs the runner in ~/actions-runner-build/ (separate from the existing
~/actions-runner/ which holds the `pi`-labelled cluster runner), so both can
run concurrently on the same host.
"""

import os
import platform
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

if len(sys.argv) < 3:
    print("registration token and runner name required", file=sys.stderr)
    sys.exit(1)

REG_TOKEN = sys.argv[1]
RUNNER_NAME = sys.argv[2]
REPO_URL = "https://github.com/Themis128/cloudless.gr"
RUNNER_VERSION = "2.334.0"
LABELS = "omv,build"  # self-hosted + Linux + ARM64 are added automatically
WORK_DIR = Path.home() / "actions-runner-build"

arch = platform.machine()
if arch in ("aarch64", "arm64"):
    PKG_ARCH = "arm64"
elif arch == "x86_64":
    PKG_ARCH = "x64"
else:
    print(f"Unsupported arch: {arch}", file=sys.stderr)
    sys.exit(1)

print(f"==> Installing runner '{RUNNER_NAME}' in {WORK_DIR}")
WORK_DIR.mkdir(parents=True, exist_ok=True)
os.chdir(WORK_DIR)

config_sh = Path("./config.sh")
if not config_sh.is_file():
    pkg = f"actions-runner-linux-{PKG_ARCH}-{RUNNER_VERSION}.tar.gz"
    url = f"https://github.com/actions/runner/releases/download/v{RUNNER_VERSION}/{pkg}"
    print(f"==> Downloading {pkg}")
    with urllib.request.urlopen(url, timeout=300) as resp, open(pkg, "wb") as fh:
        fh.write(resp.read())
    with tarfile.open(pkg) as tar:
        tar.extractall(filter="data")
    Path(pkg).unlink()


def run(*args: str) -> None:
    subprocess.run(list(args), check=True)


run(
    "./config.sh",
    "--url",
    REPO_URL,
    "--token",
    REG_TOKEN,
    "--name",
    RUNNER_NAME,
    "--labels",
    LABELS,
    "--work",
    "_work",
    "--unattended",
    "--replace",
)

# Install as a systemd service so it restarts on reboot. svc.sh derives the
# service name from the runner config; both profiles (~/actions-runner and
# ~/actions-runner-build) get distinct service names so they coexist cleanly.
run("sudo", "./svc.sh", "install", os.environ.get("USER", ""))
run("sudo", "./svc.sh", "start")

print()
print("==> Done. Verify with:")
print("    sudo ./svc.sh status")
print("    gh api repos/Themis128/cloudless.gr/actions/runners \\")
print("      --jq '.runners[] | {name, status, labels: [.labels[].name]}'")
