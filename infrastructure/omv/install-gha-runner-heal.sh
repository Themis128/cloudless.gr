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

# ---- Runner fast-start drop-in -------------------------------------------
# Replicate the 99-fast-start.conf fix (TimeoutStartSec=180 + clear
# ExecStartPre=) onto every GitHub actions.runner.*.service. Without it, a
# runner that also has 10-boot-delay's ExecStartPre=/bin/sleep 120 exceeds the
# 90s default TimeoutStartSec and enters an unbounded restart loop (start-pre
# timed out). Verify the source file exists before we reference it.
FAST_START="$REPO_DIR/99-fast-start.conf"
if [ -f "$FAST_START" ]; then
  while IFS= read -r runit; do
    [ -n "$runit" ] || continue
    drop="/etc/systemd/system/${runit}.d"
    install -d -m 755 "$drop"
    install -m 644 -o root -g root "$FAST_START" "$drop/99-fast-start.conf"
    echo "[install] runner fast-start drop-in -> ${runit}.d/99-fast-start.conf"
  done < <(systemctl list-unit-files 'actions.runner.*.service' --no-legend 2>/dev/null | awk '{print $1}')
fi

echo "[install] enabled gha-runner-heal.service (boot) + gha-runner-heal.timer"
systemctl start gha-runner-heal-check.service || true
systemctl --no-pager status gha-runner-heal.timer || true
echo "[install] done — check: journalctl -t gha-runner-heal -n 30"
