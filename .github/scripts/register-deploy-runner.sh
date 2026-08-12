#!/usr/bin/env bash
# Register a GitHub Actions runner on omv-ha with labels for deploy-pi rollout.
#
# Usage (on omv-ha):
#   ./register-deploy-runner.sh <REG_TOKEN> [RUNNER_NAME]
#
# Get REG_TOKEN:
#   gh api -X POST repos/Themis128/cloudless.gr/actions/runners/registration-token --jq .token
#
# Labels: omv-ha,deploy  (self-hosted/Linux/ARM64 added automatically)
# Install dir: ~/actions-runner-deploy  (separate from ~/actions-runner-build)
set -euo pipefail

REG_TOKEN="${1:?registration token required}"
RUNNER_NAME="${2:-omv-ha-deploy}"
REPO_URL="https://github.com/Themis128/cloudless.gr"
RUNNER_VERSION="2.334.0"
LABELS="omv-ha,deploy"
WORK_DIR="$HOME/actions-runner-deploy"

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PKG_ARCH="arm64" ;;
  x86_64)        PKG_ARCH="x64" ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

echo "==> Installing runner '${RUNNER_NAME}' in ${WORK_DIR} (labels: ${LABELS})"
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

./config.sh \
  --url "${REPO_URL}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${LABELS}" \
  --work _work \
  --unattended \
  --replace

sudo ./svc.sh install "${USER}"
sudo ./svc.sh start

echo
echo "==> Done. Verify with:"
echo "    sudo ./svc.sh status"
echo "    gh api repos/Themis128/cloudless.gr/actions/runners \\"
echo "      --jq '.runners[] | {name, status, labels: [.labels[].name]}'"
echo
echo "==> SSH to omv for rollout (required):"
echo "    ssh -i ~/.ssh/omv_ha tbaltzakis@192.168.1.128 hostname"
