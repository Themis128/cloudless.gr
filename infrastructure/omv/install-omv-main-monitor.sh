#!/usr/bin/env bash
#
# install-omv-main-monitor.sh — install (or refresh) the disk monitor on omv.
#
# Run AS ROOT on omv itself, or via ssh:
#
#   ssh tbaltzakis@omv "sudo bash -s" \
#     < infrastructure/omv/install-omv-main-monitor.sh
#
# What it does (idempotent):
#   1. Installs cloudless-cleanup.sh → /usr/local/sbin/cloudless-cleanup.sh
#   2. Installs omv-main-alert → /usr/local/bin/omv-main-alert
#   3. Installs omv-main-monitor → /usr/local/bin/omv-main-monitor
#   4. Writes the cron job to /etc/cron.d/omv-main-monitor (runs every 15 min)
#   5. Fires one immediate check and prints the result.
#
# Credentials: reuses /etc/safedeploy-watchdog.env — no extra setup needed
#              as long as install-safedeploy-watchdog.sh ran first.
#
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

REPO_DIR="$(dirname "$(readlink -f "$0")")"

CLEANUP_SRC="$REPO_DIR/cloudless-cleanup.sh"
ALERT_SRC="$REPO_DIR/omv-main-alert"
MONITOR_SRC="$REPO_DIR/omv-main-monitor"

for f in "$CLEANUP_SRC" "$ALERT_SRC" "$MONITOR_SRC"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

echo "[install] deploying cleanup script → /usr/local/sbin/cloudless-cleanup.sh"
install -m 755 -o root -g root "$CLEANUP_SRC" /usr/local/sbin/cloudless-cleanup.sh

echo "[install] deploying alert script → /usr/local/bin/omv-main-alert"
install -m 755 -o root -g root "$ALERT_SRC" /usr/local/bin/omv-main-alert

echo "[install] deploying monitor → /usr/local/bin/omv-main-monitor"
install -m 755 -o root -g root "$MONITOR_SRC" /usr/local/bin/omv-main-monitor

echo "[install] writing cron job → /etc/cron.d/omv-main-monitor"
cat > /etc/cron.d/omv-main-monitor <<'CRON'
# omv-main-monitor — disk health check every 15 minutes
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root /usr/local/bin/omv-main-monitor >> /var/log/omv-main-monitor.log 2>&1
CRON
chmod 644 /etc/cron.d/omv-main-monitor

echo ""
echo "[install] checking /etc/safedeploy-watchdog.env..."
if [ -f /etc/safedeploy-watchdog.env ]; then
  grep -c 'RESEND_API_KEY' /etc/safedeploy-watchdog.env >/dev/null 2>&1 \
    && echo "  ✓ safedeploy-watchdog.env present (alert credentials available)" \
    || echo "  ⚠ safedeploy-watchdog.env found but RESEND_API_KEY not set — run install-safedeploy-watchdog.sh first"
else
  echo "  ✗ /etc/safedeploy-watchdog.env MISSING — alerts will be silent until install-safedeploy-watchdog.sh runs"
fi

echo ""
echo "[install] firing immediate disk check..."
mkdir -p /run/omv-monitor
/usr/local/bin/omv-main-monitor || true

echo ""
echo "[install] last 10 lines of cleanup log (if any)..."
tail -10 /var/log/cloudless-cleanup.log 2>/dev/null || echo "  (no log yet)"

echo ""
echo "[install] done. Next scheduled runs:"
crontab -l -u root 2>/dev/null | grep omv-main-monitor || grep omv-main-monitor /etc/cron.d/omv-main-monitor || true
echo ""
echo "To run cleanup immediately: sudo /usr/local/sbin/cloudless-cleanup.sh"
echo "To tail the monitor log:   sudo tail -f /var/log/omv-main-monitor.log"
