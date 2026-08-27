#!/usr/bin/env bash
# install-pi5-tuning.sh — durable Raspberry Pi 5 (omv) host tuning.
#
# Run on omv as root (or via ssh):
#   sudo bash infrastructure/omv/pi5-tuning/install-pi5-tuning.sh
#   # or from laptop:
#   ssh omv-lan 'sudo bash -s' < infrastructure/omv/pi5-tuning/install-pi5-tuning.sh
#
# Safe to re-run. Optionally restarts k3s when K3S_RESTART=1 (default).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
K3S_RESTART="${K3S_RESTART:-1}"

echo "[pi5-tuning] installing from $REPO_DIR"

install -d -m 755 /etc/systemd/system.conf.d
install -m 644 "$REPO_DIR/zzz-cloudless-watchdog.conf" \
  /etc/systemd/system.conf.d/zzz-cloudless-watchdog.conf
# Remove one-off emergency drop-in if present (superseded).
rm -f /etc/systemd/system.conf.d/zzz-cloudless-watchdog-relax.conf

install -d -m 755 /etc/sysctl.d
install -m 644 "$REPO_DIR/zzz-cloudless-pi5-vm.conf" \
  /etc/sysctl.d/zzz-cloudless-pi5-vm.conf

install -d -m 755 /etc/systemd/journald.conf.d
install -m 644 "$REPO_DIR/journald-pi5.conf" \
  /etc/systemd/journald.conf.d/cloudless-pi5.conf

install -d -m 755 /etc/systemd/system/docker.service.d
install -m 644 "$REPO_DIR/docker-after-k3s.conf" \
  /etc/systemd/system/docker.service.d/10-after-k3s.conf

install -m 755 "$REPO_DIR/cloudless-boot-stagger.sh" \
  /usr/local/sbin/cloudless-boot-stagger.sh
install -m 644 "$REPO_DIR/cloudless-boot-stagger.service" \
  /etc/systemd/system/cloudless-boot-stagger.service

# GHA runner delay drop-ins (unit names discovered dynamically).
install -d -m 755 /etc/systemd/system
while IFS= read -r unit; do
  [[ -z "$unit" ]] && continue
  drop="/etc/systemd/system/${unit}.d"
  install -d -m 755 "$drop"
  install -m 644 "$REPO_DIR/gha-runner-delay.conf" "$drop/10-boot-delay.conf"
  echo "[pi5-tuning] runner delay → $unit"
done < <(systemctl list-unit-files 'actions.runner.*.service' --no-legend 2>/dev/null | awk '{print $1}')

# Merge kubelet reserved args into k3s config (idempotent marker).
K3S_CFG=/etc/rancher/k3s/config.yaml
mkdir -p /etc/rancher/k3s
touch "$K3S_CFG"
if ! grep -q 'cloudless-pi5-kubelet-reserved' "$K3S_CFG" 2>/dev/null; then
  {
    echo ""
    echo "# BEGIN cloudless-pi5-kubelet-reserved"
    cat "$REPO_DIR/k3s-kubelet-reserved.yaml.fragment"
    echo "# END cloudless-pi5-kubelet-reserved"
  } >>"$K3S_CFG"
  echo "[pi5-tuning] appended kubelet reserved to $K3S_CFG"
else
  echo "[pi5-tuning] kubelet reserved already present in $K3S_CFG"
fi

# udev SSD rules (reaffirm)
if [[ -f "$REPO_DIR/../60-ssd-rotational.rules" ]]; then
  install -m 644 "$REPO_DIR/../60-ssd-rotational.rules" \
    /etc/udev/rules.d/60-ssd-rotational.rules 2>/dev/null || true
fi

sysctl --system >/dev/null 2>&1 || sysctl -p /etc/sysctl.d/zzz-cloudless-pi5-vm.conf || true
systemctl daemon-reexec
systemctl daemon-reload
systemctl restart systemd-journald || true
systemctl enable cloudless-boot-stagger.service

echo "[pi5-tuning] RuntimeWatchdogSec=$(systemctl show -p RuntimeWatchdogUSec --value)"
echo "[pi5-tuning] vm.swappiness=$(/sbin/sysctl -n vm.swappiness 2>/dev/null || cat /proc/sys/vm/swappiness)"

# OMV-flavoured unit name on this host is k3s-k3s-omv.service (not k3s.service).
K3S_UNIT=""
for u in k3s-k3s-omv.service k3s.service; do
  if systemctl cat "$u" >/dev/null 2>&1; then
    K3S_UNIT=$u
    break
  fi
done
if [[ "$K3S_RESTART" == "1" && -n "$K3S_UNIT" ]]; then
  echo "[pi5-tuning] restarting $K3S_UNIT to apply kubelet reserved (brief blip)…"
  systemctl restart "$K3S_UNIT"
  sleep 8
  systemctl is-active "$K3S_UNIT" && echo "[pi5-tuning] $K3S_UNIT active"
elif [[ -z "$K3S_UNIT" ]]; then
  echo "[pi5-tuning] WARN: no k3s unit found — kubelet reserved needs a manual restart"
fi

echo "[pi5-tuning] done"
echo "  Verify: systemctl show -p RuntimeWatchdogUSec"
echo "          kubectl describe node omv | grep -A20 Allocatable"
echo "          free -h; uptime"
