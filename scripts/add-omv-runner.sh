#!/usr/bin/env bash
#
# Add a second self-hosted GitHub Actions runner ("omv-2") on the omv host
# to double CI throughput. Run this on the omv host, not on a dev machine.
#
# Usage:
#   1. Fetch a registration token at:
#      https://github.com/Themis128/cloudless.gr/settings/actions/runners/new
#   2. Export it (it expires after ~1 hour):
#        export RUNNER_TOKEN=AAAAAAAAAAAAAAAAAAAAA
#   3. Run this script:
#        bash scripts/add-omv-runner.sh
#
# Optional env vars:
#   RUNNER_NAME     defaults to "omv-2"
#   RUNNER_VERSION  defaults to v2.334.0
#   RUNNER_DIR      defaults to ~/actions-runner-cloudless-2
#
# The new runner registers with the same labels as the original (self-hosted,
# Linux, ARM64, omv) so existing workflows pick it up automatically.

set -euo pipefail

REPO_URL="https://github.com/Themis128/cloudless.gr"
RUNNER_NAME="${RUNNER_NAME:-omv-2}"
RUNNER_VERSION="${RUNNER_VERSION:-2.334.0}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner-cloudless-2}"
RUNNER_LABELS="self-hosted,Linux,ARM64,omv"
RUNNER_TARBALL="actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz"
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TARBALL}"

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "ERROR: RUNNER_TOKEN is not set." >&2
  echo "" >&2
  echo "Fetch one at: $REPO_URL/settings/actions/runners/new" >&2
  echo "Then: export RUNNER_TOKEN=<token>" >&2
  exit 1
fi

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "ERROR: This script targets linux/arm64 (uname -m: $(uname -m))." >&2
  exit 1
fi

if [[ -d "$RUNNER_DIR" ]]; then
  echo "ERROR: $RUNNER_DIR already exists. Remove it or set RUNNER_DIR to a fresh path." >&2
  exit 1
fi

echo "→ Creating $RUNNER_DIR"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "→ Downloading runner v${RUNNER_VERSION}"
curl -fsSL -o "$RUNNER_TARBALL" "$RUNNER_URL"

echo "→ Extracting"
tar xzf "$RUNNER_TARBALL"
rm -f "$RUNNER_TARBALL"

echo "→ Registering as '$RUNNER_NAME' with labels [$RUNNER_LABELS]"
./config.sh \
  --url "$REPO_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --unattended \
  --replace

echo "→ Installing systemd service (requires sudo)"
sudo ./svc.sh install
sudo ./svc.sh start

echo "→ Service status:"
sudo ./svc.sh status || true

echo ""
echo "✓ Runner '$RUNNER_NAME' is installed at $RUNNER_DIR"
echo ""
echo "Verify in GitHub UI:"
echo "  $REPO_URL/settings/actions/runners"
echo ""
echo "Or via API:"
echo "  gh api repos/Themis128/cloudless.gr/actions/runners --jq '.runners[] | {name, status, busy}'"
