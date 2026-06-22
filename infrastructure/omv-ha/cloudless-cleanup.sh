#!/bin/bash
# Daily disk cleanup for omv-ha worker node (Pi).
# Installed 2026-06-16. Patched 2026-06-22 to wait for k3s containerd
# socket before invoking crictl (cleanup-script race fix).
#
# Companion to /etc/systemd/system/cloudless-cleanup.{timer,service}.
# See CLAUDE.md "Pi Housekeeping" for the operator runbook.
#
# Mirrors the omv-main script but skips docker / pnpm / buildx / VS Code
# (not installed on omv-ha).

set -uo pipefail

LOG="/var/log/cloudless-cleanup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== Cleanup start (omv-ha) ==="
BEFORE_ROOT=$(df --output=avail / | tail -1)

# 1. journalctl — keep only 14 days
journalctl --vacuum-time=14d 2>&1 | tail -5 | tee -a "$LOG"

# 2. apt cache
apt-get clean 2>&1 | tee -a "$LOG"

# 3. containerd image prune — k3s-agent uses /run/k3s/containerd/containerd.sock.
#    CRICTL_SOCK_WAIT: tolerate startup race (cron can fire before k3s-agent
#    finishes binding the socket). Previously the bare `k3s crictl rmi --prune`
#    would error with "connection refused" on a flaky day, leaving images to
#    pile up unnoticed. Now we wait up to 30s for the socket and pass
#    --runtime-endpoint explicitly so k3s crictl uses the right path.
CRICTL_SOCK="/run/k3s/containerd/containerd.sock"
CRICTL_SOCK_WAIT=30
for i in $(seq 1 $((CRICTL_SOCK_WAIT/5))); do
  [ -S "$CRICTL_SOCK" ] && break
  sleep 5
done
if command -v k3s >/dev/null && [ -S "$CRICTL_SOCK" ]; then
  k3s crictl --runtime-endpoint "unix://$CRICTL_SOCK" rmi --prune 2>&1 \
    | grep -v 'DeadlineExceeded' | tail -5 | tee -a "$LOG" || true
else
  log "crictl skipped: socket not ready after ${CRICTL_SOCK_WAIT}s"
fi

# 4. GitHub Actions runner _work dir — prune leftovers older than 7 days.
#    The runner cleans most of this between jobs, but cancelled or
#    OOM-killed jobs leave stale _temp, _diag, _actions caches.
for runner_dir in /home/tbaltzakis/actions-runner-*/_work; do
  [ -d "$runner_dir" ] || continue
  find "$runner_dir/_temp" -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null || true
  find "$runner_dir/_actions" -mindepth 2 -maxdepth 2 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
done

# 5. stale VS Code Server dirs (defensive — keep newest 2 if any exist)
for d in /home/tbaltzakis/.vscode-server-insiders/cli/servers /home/tbaltzakis/.vscode-server/cli/servers; do
  [ -d "$d" ] || continue
  cd "$d" && ls -dt */ 2>/dev/null | tail -n +3 | xargs -r rm -rf 2>&1 | tee -a "$LOG" || true
done

AFTER_ROOT=$(df --output=avail / | tail -1)
log "freed on / : $(( (AFTER_ROOT - BEFORE_ROOT) / 1024 )) MB"
log "=== Cleanup done (omv-ha) ==="
