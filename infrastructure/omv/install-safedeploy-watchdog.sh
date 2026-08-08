#!/usr/bin/env bash
#
# install-safedeploy-watchdog.sh — install (or refresh) the SafeDeploy
# watchdog on omv. Run AS ROOT on omv itself, or via ssh:
#
#   ssh tbaltzakis@omv "sudo bash -s" \
#     < infrastructure/omv/install-safedeploy-watchdog.sh
#
# What it does (idempotent):
#   1. Reads NTFY/SLACK/RESEND credentials from the cluster's cloudless-secrets
#      Secret (namespace `cloudless`) via `k3s kubectl`. Nothing is echoed.
#   2. Writes /etc/safedeploy-watchdog.env (mode 600, root:root).
#   3. Copies the watchdog script + systemd unit + timer into place.
#   4. Enables and starts the timer.
#   5. Fires one immediate tick to prove the wiring, then prints last log lines.
#
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

REPO_DIR="$(dirname "$(readlink -f "$0")")"   # infrastructure/omv/
SCRIPT="$REPO_DIR/safedeploy-watchdog.sh"
UNIT_SVC="$REPO_DIR/safedeploy-watchdog.service"
UNIT_TIMER="$REPO_DIR/safedeploy-watchdog.timer"

for f in "$SCRIPT" "$UNIT_SVC" "$UNIT_TIMER"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

echo "[install] fetching alert credentials from k8s secret cloudless-secrets/cloudless…"
b64() { k3s kubectl get secret cloudless-secrets -n cloudless -o jsonpath="{.data.$1}" 2>/dev/null | base64 -d 2>/dev/null || true; }

NTFY_BASE_URL=$(b64 NTFY_BASE_URL)
# The cluster stores ntfy's IN-CLUSTER DNS (`http://ntfy.ntfy.svc.cluster.local`)
# — that only resolves inside a pod. This watchdog runs on the omv host, so
# rewrite in-cluster DNS to the LAN NodePort so notifications actually leave
# the box. Public URL (ntfy.cloudless.gr) would work too, but the LAN path
# is faster and works even if the Cloudflare tunnel is what's broken.
case "$NTFY_BASE_URL" in
  *.svc.cluster.local*) NTFY_BASE_URL="http://192.168.1.128:30080" ;;
esac
NTFY_TOPIC=$(b64   NTFY_TOPIC)
NTFY_TOKEN=$(b64   NTFY_TOKEN)
SLACK_BOT_TOKEN=$(b64 SLACK_BOT_TOKEN)
RESEND_API_KEY=$(b64  RESEND_API_KEY)

# Report presence (never values)
_present() { [ -n "$2" ] && echo "  ✓ $1 (len ${#2})" || echo "  ✗ $1 MISSING"; }
_present NTFY_BASE_URL   "$NTFY_BASE_URL"
_present NTFY_TOPIC      "$NTFY_TOPIC"
_present NTFY_TOKEN      "$NTFY_TOKEN"
_present SLACK_BOT_TOKEN "$SLACK_BOT_TOKEN"
_present RESEND_API_KEY  "$RESEND_API_KEY"

install -d -m 700 -o root -g root /var/lib/safedeploy-watchdog
umask 077
cat > /etc/safedeploy-watchdog.env <<ENV
# populated by install-safedeploy-watchdog.sh — DO NOT edit by hand
NTFY_BASE_URL="$NTFY_BASE_URL"
NTFY_TOPIC="$NTFY_TOPIC"
NTFY_TOKEN="$NTFY_TOKEN"
SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
SLACK_CHANNEL="#general"
RESEND_API_KEY="$RESEND_API_KEY"
ALERT_EMAIL="tbaltzakis@cloudless.gr"
ENV
chmod 600 /etc/safedeploy-watchdog.env
chown root:root /etc/safedeploy-watchdog.env
echo "[install] wrote /etc/safedeploy-watchdog.env"

install -m 755 -o root -g root "$SCRIPT"     /usr/local/sbin/safedeploy-watchdog.sh
install -m 644 -o root -g root "$UNIT_SVC"   /etc/systemd/system/safedeploy-watchdog.service
install -m 644 -o root -g root "$UNIT_TIMER" /etc/systemd/system/safedeploy-watchdog.timer
echo "[install] installed script + units"

systemctl daemon-reload
systemctl enable --now safedeploy-watchdog.timer
echo "[install] timer enabled + started"

echo "[install] firing one immediate tick to verify wiring…"
systemctl start safedeploy-watchdog.service || true
sleep 3
echo "[install] --- recent journal ---"
journalctl -t safedeploy-watchdog -n 8 --no-pager || journalctl -u safedeploy-watchdog.service -n 8 --no-pager
echo "[install] --- next scheduled run ---"
systemctl list-timers safedeploy-watchdog.timer --no-pager
echo "[install] done."
