#!/usr/bin/env bash
# harden-runner-systemd.sh <runner-name>
#
# Applies systemd drop-in hardening to a Pi GitHub Actions runner service:
#   - Removes k3s.service dependency (After=/Requires=)
#   - Adds Restart=on-failure + StartLimitIntervalSec=0
#   - Sets After=network-online.target only
#   - Configures fallback DNS
#
# Usage:
#   sudo bash harden-runner-systemd.sh omv
#   sudo bash harden-runner-systemd.sh omv-2
#   sudo bash harden-runner-systemd.sh omv-3
#
# Must be run as root (or with sudo) on omv-main (192.168.1.128).
# Idempotent — safe to re-run.

set -euo pipefail

RUNNER="${1:-}"
if [[ -z "$RUNNER" ]]; then
  echo "Usage: $0 <runner-name>  (e.g. omv, omv-2, omv-3)" >&2
  exit 1
fi

REPO="Themis128-cloudless.gr"
SVC="actions.runner.${REPO}.${RUNNER}.service"
OVERRIDE_DIR="/etc/systemd/system/${SVC}.d"

echo "=== Hardening runner: ${RUNNER} (${SVC}) ==="

# ── 1. Check for existing k3s dependency ──────────────────────────────────────
echo ""
echo "--- Current After= / Requires= ---"
systemctl show "${SVC}" --property=After --property=Requires 2>/dev/null \
  || echo "(service not found — may not be registered on this node)"

if systemctl cat "${SVC}" 2>/dev/null | grep -qi "k3s"; then
  echo "⚠️  k3s reference found in unit — will be excluded by override"
else
  echo "✓ No k3s dependency in base unit"
fi

# ── 2. Write drop-in override ─────────────────────────────────────────────────
echo ""
echo "--- Writing override.conf ---"
mkdir -p "${OVERRIDE_DIR}"
cat > "${OVERRIDE_DIR}/override.conf" << 'EOF'
[Unit]
# Decouple from k3s — runner must survive k3s crashes independently.
# Only wait for network to be online.
After=network-online.target
Wants=network-online.target

[Service]
Restart=on-failure
RestartSec=10s
# Never hit the start-rate limit — keep retrying after DNS flaps or crashes.
StartLimitIntervalSec=0
Environment="RUNNER_RETRY_RENEW_SECONDS=300"
Environment="DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1"
EOF
echo "✓ Written ${OVERRIDE_DIR}/override.conf"
cat "${OVERRIDE_DIR}/override.conf"

# ── 3. Configure fallback DNS ─────────────────────────────────────────────────
echo ""
echo "--- Configuring fallback DNS ---"
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/retry.conf << 'EOF'
[Resolve]
DNS=8.8.8.8 8.8.4.4 1.1.1.1
FallbackDNS=9.9.9.9
EOF
echo "✓ Written /etc/systemd/resolved.conf.d/retry.conf"
systemctl restart systemd-resolved 2>/dev/null || true

# ── 4. Reload and restart ─────────────────────────────────────────────────────
echo ""
echo "--- Reloading systemd and restarting runner ---"
systemctl daemon-reload
systemctl restart "${SVC}" || {
  echo "⚠️  Restart failed — service may need registration first" >&2
  exit 1
}
sleep 5

# ── 5. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "--- Post-hardening verification ---"
STATUS=$(systemctl is-active "${SVC}" 2>/dev/null || echo "unknown")
echo "Service status: ${STATUS}"

AFTER=$(systemctl show "${SVC}" --property=After 2>/dev/null || echo "")
echo "After= : ${AFTER}"

if echo "${AFTER}" | grep -qi "k3s"; then
  echo "⚠️  WARNING: k3s still appears in After= — check override" >&2
else
  echo "✓ No k3s dependency in effective unit"
fi

if [[ "${STATUS}" == "active" ]]; then
  echo ""
  echo "✅ Runner ${RUNNER} is hardened and active."
else
  echo ""
  echo "❌ Runner ${RUNNER} is not active (status: ${STATUS}). Check: journalctl -u ${SVC} -n 30"
  exit 1
fi
