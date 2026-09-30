#!/usr/bin/env python3
"""Register a GitHub Actions runner on omv-ha with labels for deploy-pi rollout.

Port of register-deploy-runner.sh.

Usage (on omv-ha):
  python3 register-deploy-runner.py <REG_TOKEN> [RUNNER_NAME]

Get REG_TOKEN:
  gh api -X POST repos/Themis128/cloudless.gr/actions/runners/registration-token --jq .token

Labels: omv-ha,deploy  (self-hosted/Linux/ARM64 added automatically)
Install dir: ~/actions-runner-deploy  (separate from ~/actions-runner-build)
"""

import os
import platform
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

if len(sys.argv) < 2:
    print("registration token required", file=sys.stderr)
    sys.exit(1)

REG_TOKEN = sys.argv[1]
RUNNER_NAME = sys.argv[2] if len(sys.argv) > 2 else "omv-ha-deploy"
REPO_URL = "https://github.com/Themis128/cloudless.gr"
RUNNER_VERSION = "2.334.0"
LABELS = "omv-ha,deploy"
WORK_DIR = Path.home() / "actions-runner-deploy"

arch = platform.machine()
if arch in ("aarch64", "arm64"):
    PKG_ARCH = "arm64"
elif arch == "x86_64":
    PKG_ARCH = "x64"
else:
    print(f"Unsupported arch: {arch}", file=sys.stderr)
    sys.exit(1)

print(f"==> Installing runner '{RUNNER_NAME}' in {WORK_DIR} (labels: {LABELS})")
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

run("sudo", "./svc.sh", "install", os.environ.get("USER", ""))
run("sudo", "./svc.sh", "start")

print()
print("==> Done. Verify with:")
print("    sudo ./svc.sh status")
print("    gh api repos/Themis128/cloudless.gr/actions/runners \\")
print("      --jq '.runners[] | {name, status, labels: [.labels[].name]}'")
print()
print("==> SSH to omv for rollout (required):")
print("    ssh -i ~/.ssh/omv_ha tbaltzakis@192.168.1.128 hostname")
