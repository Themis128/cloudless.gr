#!/usr/bin/env bash
#
# install-omv-main-monitor.sh — install (or refresh) the disk monitor on omv.
#
# Self-contained: all three scripts are embedded as heredocs so this file
# can be piped via stdin without needing the repo checked out on the Pi.
#
#   ssh tbaltzakis@omv "sudo bash -s" \
#     < infrastructure/omv/install-omv-main-monitor.sh
#
# What it does (idempotent):
#   1. Writes cloudless-cleanup.sh → /usr/local/sbin/cloudless-cleanup.sh
#   2. Writes omv-main-alert → /usr/local/bin/omv-main-alert
#   3. Writes omv-main-monitor → /usr/local/bin/omv-main-monitor
#   4. Writes cron job → /etc/cron.d/omv-main-monitor (every 15 min)
#   5. Fires one immediate check and prints the result.
#
# Credentials: reuses /etc/safedeploy-watchdog.env — run
#   install-safedeploy-watchdog.sh first if that file doesn't exist.
#
set -euo pipefail
[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

# ── 1. cloudless-cleanup.sh ──────────────────────────────────────────────────
echo "[install] writing /usr/local/sbin/cloudless-cleanup.sh"
cat > /usr/local/sbin/cloudless-cleanup.sh << 'CLEANUP_SCRIPT_EOF'
#!/bin/bash
# Daily disk cleanup for omv control-plane node (Pi 5).
# Companion to /etc/systemd/system/cloudless-cleanup.{timer,service}.
# See CLAUDE.md "Pi Housekeeping" for the operator runbook.
#
# More aggressive than the omv-ha variant because the control plane runs:
#   Docker (for GH Actions runner arm64 builds), pnpm + buildx,
#   k3s containerd (multi-namespace), 3 GH self-hosted runners, VS Code Server.
#
# Ordered by impact — biggest space savers first.

set -uo pipefail

LOG="/var/log/cloudless-cleanup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== Cleanup start (omv-main) ==="
BEFORE_ROOT=$(df --output=avail / | tail -1)

# ── 1. Docker — images, stopped containers, unused volumes, buildx ──────────
if command -v docker >/dev/null 2>&1; then
  log "Docker: pruning stopped containers + dangling images..."
  docker container prune -f 2>&1 | tail -3 | tee -a "$LOG" || true

  log "Docker: pruning unused images (not pulled in 48h)..."
  docker image prune -a --filter "until=48h" -f 2>&1 | tail -3 | tee -a "$LOG" || true

  log "Docker: pruning unused volumes..."
  docker volume prune -f 2>&1 | tail -2 | tee -a "$LOG" || true

  log "Docker: pruning buildx cache (> 10GB kept)..."
  docker buildx prune --keep-storage=10GB -f 2>&1 | tail -3 | tee -a "$LOG" || true
else
  log "Docker not found — skipping Docker pruning"
fi

# ── 2. GitHub Actions runner caches ──────────────────────────────────────────
for runner_dir in /home/tbaltzakis/actions-runner-*; do
  [ -d "$runner_dir/_work" ] || continue

  find "$runner_dir/_work" -mindepth 3 -maxdepth 3 -name "node_modules" \
    -type d -atime +3 -exec rm -rf {} + 2>/dev/null || true

  find "$runner_dir/_work/_temp" -mindepth 1 -maxdepth 1 -mtime +1 \
    -exec rm -rf {} + 2>/dev/null || true

  find "$runner_dir/_work/_actions" -mindepth 2 -maxdepth 2 \
    -type d -atime +14 -exec rm -rf {} + 2>/dev/null || true

  log "Cleaned $runner_dir/_work"
done

# ── 3. pnpm content-addressable store ────────────────────────────────────────
if command -v pnpm >/dev/null 2>&1; then
  log "pnpm: pruning store..."
  pnpm store prune 2>&1 | tail -3 | tee -a "$LOG" || true
fi

PNPM_STORE_ROOT="/root/.local/share/pnpm/store"
if [ -d "$PNPM_STORE_ROOT" ]; then
  find "$PNPM_STORE_ROOT" -maxdepth 4 -name "*.tgz" -atime +30 -delete 2>/dev/null || true
fi

# ── 4. containerd (k3s) image prune ─────────────────────────────────────────
CRICTL_SOCK="/run/k3s/containerd/containerd.sock"
for i in 1 2 3 4 5 6; do
  [ -S "$CRICTL_SOCK" ] && break
  sleep 5
done
if command -v k3s >/dev/null 2>&1 && [ -S "$CRICTL_SOCK" ]; then
  log "crictl: pruning unused images..."
  k3s crictl --runtime-endpoint "unix://$CRICTL_SOCK" rmi --prune 2>&1 \
    | grep -v 'DeadlineExceeded' | tail -5 | tee -a "$LOG" || true
else
  log "crictl skipped: socket not ready"
fi

# ── 5. journald ──────────────────────────────────────────────────────────────
log "journalctl: vacuum to 14 days / 100MB..."
journalctl --vacuum-time=14d --vacuum-size=100M 2>&1 | tail -5 | tee -a "$LOG"

# ── 6. Container logs ────────────────────────────────────────────────────────
log "Pod logs: removing entries older than 3 days..."
find /var/log/pods -name "*.log" -mtime +3 -delete 2>/dev/null || true
find /var/log/pods -name "*.log.*" -mtime +3 -delete 2>/dev/null || true
find /var/log/pods -name "*.log" -mtime +1 -size +10M \
  -exec truncate -s 1M {} \; 2>/dev/null || true

# ── 7. apt cache ─────────────────────────────────────────────────────────────
log "apt: cleaning cache..."
apt-get clean 2>&1 | tee -a "$LOG" || true

# ── 8. VS Code Server — keep newest 2 versions ───────────────────────────────
for d in /home/tbaltzakis/.vscode-server/cli/servers \
          /home/tbaltzakis/.vscode-server-insiders/cli/servers; do
  [ -d "$d" ] || continue
  ( cd "$d" && ls -dt */ 2>/dev/null | tail -n +3 | xargs -r rm -rf ) \
    2>&1 | tee -a "$LOG" || true
done

# ── 9. Stale /tmp files ───────────────────────────────────────────────────────
find /tmp -type f -mtime +7 -delete 2>/dev/null || true

# ── 10. Rotate the cleanup log itself ────────────────────────────────────────
if [ -f "$LOG" ] && [ "$(du -m "$LOG" | cut -f1)" -ge 50 ]; then
  tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
  log "(log truncated to last 500 lines)"
fi

AFTER_ROOT=$(df --output=avail / | tail -1)
log "freed on / : $(( (AFTER_ROOT - BEFORE_ROOT) / 1024 )) MB"
log "=== Cleanup done (omv-main) ==="
CLEANUP_SCRIPT_EOF
chmod 755 /usr/local/sbin/cloudless-cleanup.sh

# ── 2. omv-main-alert ────────────────────────────────────────────────────────
echo "[install] writing /usr/local/bin/omv-main-alert"
cat > /usr/local/bin/omv-main-alert << 'ALERT_SCRIPT_EOF'
#!/usr/bin/env bash
# omv-main-alert — send a disk/system alert via ntfy + Slack + Resend email.
#
# Usage: omv-main-alert <subject> [body] [severity]
#   severity: warning | critical | ok   (default: warning)
#
# Reads credentials from /etc/safedeploy-watchdog.env (shared with watchdog).

set -euo pipefail

ENV_FILE=/etc/safedeploy-watchdog.env
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

: "${NTFY_BASE_URL:=}" "${NTFY_TOPIC:=}" "${NTFY_TOKEN:=}"
: "${SLACK_BOT_TOKEN:=}" "${SLACK_CHANNEL:=#alerts}"
: "${RESEND_API_KEY:=}" "${ALERT_EMAIL:=tbaltzakis@cloudless.gr}"

SUBJECT="${1:-OMV Alert}"
BODY="${2:-No details}"
SEVERITY="${3:-warning}"

case "$SEVERITY" in
  ok|success)            NTFY_PRIO=low;    ICON="✅" ;;
  critical|error|urgent) NTFY_PRIO=urgent; ICON="🚨" ;;
  *)                     NTFY_PRIO=high;   ICON="⚠️"  ;;
esac

FULL_TITLE="[OMV] $SUBJECT"
FULL_BODY="${BODY:-}
Host: $(hostname) | $(date -u '+%F %TZ')"

if [ -n "$NTFY_BASE_URL" ] && [ -n "$NTFY_TOPIC" ]; then
  auth_header=""
  [ -n "$NTFY_TOKEN" ] && auth_header="-H Authorization: Bearer $NTFY_TOKEN"
  curl -fsSm 10 -X POST "${NTFY_BASE_URL%/}/${NTFY_TOPIC}" \
    -H "Title: $FULL_TITLE" \
    -H "Priority: $NTFY_PRIO" \
    -H "Tags: warning,floppy_disk" \
    ${auth_header:+-H "$auth_header"} \
    -d "$FULL_BODY" >/dev/null 2>&1 \
    && echo "[alert] ntfy sent" || echo "[alert] ntfy failed (non-fatal)"
fi

if [ -n "$SLACK_BOT_TOKEN" ]; then
  payload=$(printf '{"channel":"%s","text":"%s %s\n%s"}' \
    "$SLACK_CHANNEL" "$ICON" "${FULL_TITLE//\"/\\\"}" "${FULL_BODY//\"/\\\"}")
  curl -fsSm 10 -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$payload" >/dev/null 2>&1 \
    && echo "[alert] Slack sent" || echo "[alert] Slack failed (non-fatal)"
fi

if [ -n "$RESEND_API_KEY" ]; then
  payload=$(python3 -c "
import json, sys
print(json.dumps({
  'from': 'alerts@cloudless.gr',
  'to': sys.argv[1],
  'subject': sys.argv[2],
  'text': sys.argv[3]
}))
" "$ALERT_EMAIL" "$FULL_TITLE" "$FULL_BODY")
  curl -fsSm 10 -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1 \
    && echo "[alert] email sent via Resend" || echo "[alert] Resend email failed (non-fatal)"
fi

echo "[alert] $SEVERITY — $SUBJECT"
ALERT_SCRIPT_EOF
chmod 755 /usr/local/bin/omv-main-alert

# ── 3. omv-main-monitor ──────────────────────────────────────────────────────
echo "[install] writing /usr/local/bin/omv-main-monitor"
cat > /usr/local/bin/omv-main-monitor << 'MONITOR_SCRIPT_EOF'
#!/usr/bin/env bash
# omv-main-monitor — disk health cron for omv control-plane (Pi 5).
#
# Cron (every 15 min, written by install-omv-main-monitor.sh):
#   */15 * * * * root /usr/local/bin/omv-main-monitor >> /var/log/omv-main-monitor.log 2>&1
#
# Thresholds:
#   root ≥ 50%  → proactive cleanup (max once per 3h)
#   root ≥ 85%  → warning alert (max once per 1h)
#   root ≥ 90%  → critical alert
#   sda1 ≥ 80%  → warning; ≥ 90% → critical
#   sdb1 ≥ 80%  → warning; ≥ 92% → critical

set -euo pipefail

ALERT_SCRIPT=/usr/local/bin/omv-main-alert
CLEANUP_SCRIPT=/usr/local/sbin/cloudless-cleanup.sh
STAMP_DIR=/run/omv-monitor
COOLDOWN_ALERT=3600     # 1h between repeated alerts per device
COOLDOWN_CLEANUP=10800  # 3h between auto-triggered cleanups

SDB1_MOUNT=/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7

mkdir -p "$STAMP_DIR"

_pct() { df "$1" --output=pcent 2>/dev/null | tail -1 | tr -d ' %' || echo 0; }

_stamp_age() {
  local f="$STAMP_DIR/$1"
  [ -f "$f" ] || { echo 9999999; return; }
  echo $(( $(date +%s) - $(cat "$f") ))
}

_stamp_set() { printf '%s\n' "$(date +%s)" > "$STAMP_DIR/$1"; }

log() { printf '[%s] %s\n' "$(date -u +%T)" "$*"; }

_maybe_alert() {
  local key="$1" pct="$2" label="$3" sev="$4"
  if [ "$(_stamp_age "alert-${key}")" -ge "$COOLDOWN_ALERT" ]; then
    _stamp_set "alert-${key}"
    "$ALERT_SCRIPT" "${sev^^}: Disk ${pct}%: ${label} is ${pct}% full." "" "$sev" || true
    log "ALERT $sev — $label ${pct}%"
  else
    log "SUPPRESSED $sev — $label ${pct}% (cooldown active)"
  fi
}

check_disk() {
  local mount="$1" warn="$2" crit="$3" label="$4" key="$5"
  [ -d "$mount" ] || { log "SKIP $label — mount not found"; return; }
  local pct; pct=$(_pct "$mount")
  if [ "$pct" -ge "$crit" ]; then
    _maybe_alert "$key" "$pct" "$label" "critical"
  elif [ "$pct" -ge "$warn" ]; then
    _maybe_alert "$key" "$pct" "$label" "warning"
  else
    rm -f "$STAMP_DIR/alert-${key}" 2>/dev/null || true
  fi
}

# ── Root: proactive cleanup at ≥ 50%, alert at ≥ 85%/90% ────────────────────
ROOT_PCT=$(_pct /)
if [ "$ROOT_PCT" -ge 50 ] && [ "$(_stamp_age cleanup-root)" -ge "$COOLDOWN_CLEANUP" ]; then
  log "Root ${ROOT_PCT}% >= 50% — triggering proactive cleanup (next allowed in 3h)"
  _stamp_set cleanup-root
  bash "$CLEANUP_SCRIPT" >> /var/log/cloudless-cleanup.log 2>&1 || true
  ROOT_PCT=$(_pct /)
  log "Root after cleanup: ${ROOT_PCT}%"
fi

check_disk /                    85 90 "Root (SD card 58GB)" root
check_disk /var/lib/rancher/k3s 80 90 "k3s SSD (sda1 119GB)" k3s
check_disk "$SDB1_MOUNT"        80 92 "UserData (sdb1 916GB)" sdb1
MONITOR_SCRIPT_EOF
chmod 755 /usr/local/bin/omv-main-monitor

# ── 4. Cron job ──────────────────────────────────────────────────────────────
echo "[install] writing /etc/cron.d/omv-main-monitor"
cat > /etc/cron.d/omv-main-monitor << 'CRON_EOF'
# omv-main-monitor — disk health check every 15 minutes
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root /usr/local/bin/omv-main-monitor >> /var/log/omv-main-monitor.log 2>&1
CRON_EOF
chmod 644 /etc/cron.d/omv-main-monitor

# ── 5. Verify credentials ────────────────────────────────────────────────────
echo ""
echo "[install] checking /etc/safedeploy-watchdog.env..."
if [ -f /etc/safedeploy-watchdog.env ]; then
  grep -q 'RESEND_API_KEY' /etc/safedeploy-watchdog.env \
    && echo "  ✓ credentials present" \
    || echo "  ⚠ RESEND_API_KEY missing — run install-safedeploy-watchdog.sh first"
else
  echo "  ✗ /etc/safedeploy-watchdog.env MISSING — alerts will be silent"
  echo "    Run: ssh tbaltzakis@omv 'sudo bash -s' < infrastructure/omv/install-safedeploy-watchdog.sh"
fi

# ── 6. Immediate check ───────────────────────────────────────────────────────
echo ""
echo "[install] firing immediate disk check..."
mkdir -p /run/omv-monitor
/usr/local/bin/omv-main-monitor || true

echo ""
echo "[install] disk usage summary:"
df -h / /var/lib/rancher/k3s \
  /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7 2>/dev/null || df -h /

echo ""
echo "[install] done."
echo "  Cleanup log: tail -f /var/log/cloudless-cleanup.log"
echo "  Monitor log: tail -f /var/log/omv-main-monitor.log"
echo "  Run cleanup now: sudo /usr/local/sbin/cloudless-cleanup.sh"
