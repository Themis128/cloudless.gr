#!/usr/bin/env bash
# Register a second GitHub Actions runner on a Pi host with the `build` label.
#
# Usage:
#   On each of omv, omv-2, omv-3:
#     curl -fsSL https://raw.githubusercontent.com/Themis128/cloudless.gr/main/.github/scripts/register-build-runner.sh | bash -s -- <REG_TOKEN> <RUNNER_NAME>
#   Or local:
#     ./register-build-runner.sh <REG_TOKEN> <RUNNER_NAME>
#
# Get REG_TOKEN from:
#   https://github.com/Themis128/cloudless.gr/settings/actions/runners → New self-hosted runner
#
# RUNNER_NAME should be like: omv-build, omv-2-build, omv-3-build
#
# This installs the runner in ~/actions-runner-build/ (separate from the existing
# ~/actions-runner/ which holds the `pi`-labelled cluster runner), so both can
# run concurrently on the same host.

set -euo pipefail

REG_TOKEN="${1:?registration token required}"
RUNNER_NAME="${2:?runner name required, e.g. omv-build}"
REPO_URL="https://github.com/Themis128/cloudless.gr"
RUNNER_VERSION="2.334.0"
LABELS="omv,build"          # self-hosted + Linux + ARM64 are added automatically
WORK_DIR="$HOME/actions-runner-build"

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PKG_ARCH="arm64" ;;
  x86_64)        PKG_ARCH="x64" ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

echo "==> Installing runner '${RUNNER_NAME}' in ${WORK_DIR}"
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

if [[ ! -f ./config.sh ]]; then
  PKG="actions-runner-linux-${PKG_ARCH}-${RUNNER_VERSION}.tar.gz"
  echo "==> Downloading ${PKG}"
  curl -fsSL -o "${PKG}" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${PKG}"
  tar xzf "${PKG}"
  rm -f "${PKG}"
fi

# Register (unattended, so it doesn't prompt)
./config.sh \
  --url "${REPO_URL}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${LABELS}" \
  --work _work \
  --unattended \
  --replace

# Install as a systemd service so it restarts on reboot.
# svc.sh derives the service name from the runner config; both profiles
# (~/actions-runner and ~/actions-runner-build) get distinct service names
# so they coexist cleanly.
sudo ./svc.sh install "${USER}"
sudo ./svc.sh start

echo
echo "==> Done. Verify with:"
echo "    sudo ./svc.sh status"
echo "    gh api repos/Themis128/cloudless.gr/actions/runners \\"
echo "      --jq '.runners[] | {name, status, labels: [.labels[].name]}'"
