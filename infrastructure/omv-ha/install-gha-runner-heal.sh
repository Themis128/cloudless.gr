#!/usr/bin/env bash
# install-gha-runner-heal.sh — install boot + periodic runner heal on this host.
#
# Run as root on omv or omv-ha:
#   sudo bash infrastructure/omv/install-gha-runner-heal.sh
# Or from a checkout on the Pi:
#   sudo bash /path/to/install-gha-runner-heal.sh
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

REPO_DIR="$(dirname "$(readlink -f "$0")")"
SCRIPT="$REPO_DIR/gha-runner-heal.sh"
BOOT_SVC="$REPO_DIR/gha-runner-heal.service"
CHECK_SVC="$REPO_DIR/gha-runner-heal-check.service"
TIMER="$REPO_DIR/gha-runner-heal.timer"

for f in "$SCRIPT" "$BOOT_SVC" "$CHECK_SVC" "$TIMER"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

install -m 755 -o root -g root "$SCRIPT"    /usr/local/sbin/gha-runner-heal.sh
install -m 644 -o root -g root "$BOOT_SVC"  /etc/systemd/system/gha-runner-heal.service
install -m 644 -o root -g root "$CHECK_SVC" /etc/systemd/system/gha-runner-heal-check.service
install -m 644 -o root -g root "$TIMER"     /etc/systemd/system/gha-runner-heal.timer

systemctl daemon-reload
systemctl enable gha-runner-heal.service
systemctl enable --now gha-runner-heal.timer

echo "[install] enabled gha-runner-heal.service (boot) + gha-runner-heal.timer"
systemctl start gha-runner-heal-check.service || true
systemctl --no-pager status gha-runner-heal.timer || true
echo "[install] done — check: journalctl -t gha-runner-heal -n 30"
