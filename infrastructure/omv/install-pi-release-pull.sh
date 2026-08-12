#!/usr/bin/env bash
# install-pi-release-pull.sh — install load-guarded R2 pull agent on omv.
# Run as root on omv (or: ssh omv "sudo bash -s" < this-script).
#
# Requires /etc/cloudless/pi-release-pull.env already populated (see
# infrastructure/omv/pi-release-pull.env.example). Does not write secrets.
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

REPO_DIR="$(dirname "$(readlink -f "$0")")"
install -d -m 755 /usr/local/sbin
install -m 755 "$REPO_DIR/pi-release-pull.sh" /usr/local/sbin/pi-release-pull.sh
install -m 644 "$REPO_DIR/pi-release-pull.service" /etc/systemd/system/pi-release-pull.service
install -m 644 "$REPO_DIR/pi-release-pull.timer" /etc/systemd/system/pi-release-pull.timer
install -d -m 700 /etc/cloudless

if [[ ! -f /etc/cloudless/pi-release-pull.env ]]; then
  echo "NOTE: create /etc/cloudless/pi-release-pull.env from pi-release-pull.env.example"
fi

# aws CLI for R2 S3 API
if ! command -v aws >/dev/null 2>&1; then
  echo "WARNING: aws CLI not found — install awscli v2 for R2 downloads"
fi

systemctl daemon-reload
systemctl enable --now pi-release-pull.timer
systemctl start pi-release-pull.service || true
systemctl status pi-release-pull.timer --no-pager | head -15
echo "installed. logs: journalctl -t pi-release-pull -f"
