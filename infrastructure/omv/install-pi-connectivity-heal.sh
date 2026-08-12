#!/usr/bin/env bash
# install-pi-connectivity-heal.sh — install connectivity heal + sshd priority drop-in.
#
# Run as root on omv or omv-ha:
#   sudo bash infrastructure/omv/install-pi-connectivity-heal.sh
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

REPO_DIR="$(dirname "$(readlink -f "$0")")"
SCRIPT="$REPO_DIR/pi-connectivity-heal.sh"
BOOT_SVC="$REPO_DIR/pi-connectivity-heal.service"
CHECK_SVC="$REPO_DIR/pi-connectivity-heal-check.service"
TIMER="$REPO_DIR/pi-connectivity-heal.timer"
SSHD_DROPIN_SRC="$REPO_DIR/sshd-under-load.conf"

for f in "$SCRIPT" "$BOOT_SVC" "$CHECK_SVC" "$TIMER"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

install -m 755 -o root -g root "$SCRIPT"    /usr/local/sbin/pi-connectivity-heal.sh
install -m 644 -o root -g root "$BOOT_SVC"  /etc/systemd/system/pi-connectivity-heal.service
install -m 644 -o root -g root "$CHECK_SVC" /etc/systemd/system/pi-connectivity-heal-check.service
install -m 644 -o root -g root "$TIMER"     /etc/systemd/system/pi-connectivity-heal.timer

# Keep OpenSSH responsive when next-build pegs the Pi CPU.
if [ -f "$SSHD_DROPIN_SRC" ]; then
  mkdir -p /etc/systemd/system/ssh.service.d /etc/systemd/system/sshd.service.d
  install -m 644 -o root -g root "$SSHD_DROPIN_SRC" /etc/systemd/system/ssh.service.d/under-load.conf
  install -m 644 -o root -g root "$SSHD_DROPIN_SRC" /etc/systemd/system/sshd.service.d/under-load.conf
fi
if [ -f "$REPO_DIR/sshd-connectivity.conf" ]; then
  install -m 644 -o root -g root "$REPO_DIR/sshd-connectivity.conf" \
    /etc/ssh/sshd_config.d/99-cloudless-connectivity.conf
fi

# Hardened tailscaled restart policy
mkdir -p /etc/systemd/system/tailscaled.service.d
cat > /etc/systemd/system/tailscaled.service.d/restart.conf <<'EOF'
[Service]
Restart=always
RestartSec=5s
StartLimitIntervalSec=0
EOF

# Policy: classic SSH only
if command -v tailscale >/dev/null 2>&1; then
  tailscale set --ssh=false || true
fi

systemctl daemon-reload
# Reload sshd config if possible
systemctl try-reload-or-restart ssh.service 2>/dev/null \
  || systemctl try-reload-or-restart sshd.service 2>/dev/null \
  || true

systemctl enable pi-connectivity-heal.service
systemctl enable --now pi-connectivity-heal.timer
systemctl start pi-connectivity-heal-check.service || true

echo "[install] pi-connectivity-heal enabled"
systemctl --no-pager status pi-connectivity-heal.timer || true
/usr/local/sbin/pi-connectivity-heal.sh --check || true
echo "[install] done — journalctl -t pi-connectivity-heal -n 40"
