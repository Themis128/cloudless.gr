#!/usr/bin/env bash
#
# k3s-watchdog-install.sh — strengthen the k3s systemd service so it
# auto-recovers from crashes without manual intervention.
#
# What it does:
#   1. Writes a systemd drop-in that sets Restart=always + removes start limits
#   2. Enables the k3s service for auto-start on boot
#   3. Reloads systemd and confirms the active state
#
# Idempotent — safe to re-run. Requires sudo (run via CI or directly on Pi).
#
# After this runs, k3s will:
#   - Restart automatically 30s after any crash (no manual intervention needed)
#   - Restart indefinitely (no start limit — won't stop retrying after N failures)
#   - Auto-start on Pi reboot
#
# This addresses PrometheusKubernetesListWatchFailures and related cluster
# incidents caused by k3s process crashes.

set -uo pipefail

OVERRIDE_DIR="/etc/systemd/system/k3s.service.d"
OVERRIDE_FILE="${OVERRIDE_DIR}/restart-always.conf"

echo "=== k3s watchdog install $(date -u '+%F %T')Z ==="

# Check k3s is installed.
# systemctl list-unit-files with sudo covers installed-but-inactive services;
# plain list-units can miss k3s if it crashed and the runner lacks permissions.
if ! sudo systemctl list-unit-files k3s.service 2>/dev/null | grep -q "k3s.service" && \
   ! sudo systemctl list-units --full --all k3s.service 2>/dev/null | grep -q "k3s"; then
  echo "ERROR: k3s.service not found — is k3s installed on this host?"
  echo "Tip: run 'which k3s' and 'sudo systemctl list-unit-files | grep k3s' to diagnose"
  exit 1
fi

echo "k3s.service found"

# Write the drop-in override
echo "writing drop-in: ${OVERRIDE_FILE}"
sudo mkdir -p "$OVERRIDE_DIR"
sudo tee "$OVERRIDE_FILE" > /dev/null <<'EOF'
[Service]
# Auto-restart k3s on any failure, indefinitely, with a 30s back-off.
# Removes the default start limit so k3s never stops retrying after N crashes.
Restart=always
RestartSec=30s
StartLimitBurst=0
StartLimitIntervalSec=0
EOF

echo "drop-in written:"
cat "$OVERRIDE_FILE"
echo ""

# Reload systemd to pick up the override
sudo systemctl daemon-reload
echo "daemon-reload: done"

# Ensure k3s starts on boot
sudo systemctl enable k3s 2>&1
echo "k3s: enabled for auto-start on boot"

# Show current state
echo ""
echo "=== k3s current state ==="
sudo systemctl status k3s --no-pager 2>&1 | head -20 || true

echo ""
echo "=== effective restart config ==="
sudo systemctl show k3s --property=Restart,RestartSec,StartLimitBurst,StartLimitIntervalSec 2>&1

echo ""
echo "=== DONE ==="
echo "k3s will now restart automatically (Restart=always, RestartSec=30s, no start limit)."
echo "No further manual intervention needed after a k3s crash."
