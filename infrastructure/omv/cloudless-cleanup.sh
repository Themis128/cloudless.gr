#!/bin/bash
# Daily disk cleanup for omv control-plane node (Pi 5).
# Companion to /etc/systemd/system/cloudless-cleanup.{timer,service}.
# See CLAUDE.md "Pi Housekeeping" for the operator runbook.
#
# More aggressive than the omv-ha variant because the control plane runs:
#   • Docker (for GH Actions runner arm64 builds)
#   • pnpm + buildx (Next.js CI builds)
#   • k3s containerd (multi-namespace — larger image cache)
#   • 3 GH self-hosted runners (/home/tbaltzakis/actions-runner-*)
#   • VS Code Server remote
#
# Ordered by impact — biggest space savers first.

set -uo pipefail

LOG="/var/log/cloudless-cleanup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== Cleanup start (omv-main) ==="
BEFORE_ROOT=$(df --output=avail / | tail -1)

# ── 1. Docker — images, stopped containers, unused volumes, buildx ──────────
# Runners build arm64 images natively. Docker is the #1 root-space consumer.
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
# Runners keep _work/<repo> (checkout + node_modules ~1-2GB each) and
# _actions/ tool caches. Prune the ones not touched in >3 days.
for runner_dir in /home/tbaltzakis/actions-runner-*; do
  [ -d "$runner_dir/_work" ] || continue

  # node_modules inside _work are the biggest hog; safe to nuke after 3 days
  find "$runner_dir/_work" -mindepth 3 -maxdepth 3 -name "node_modules" \
    -type d -atime +3 -exec rm -rf {} + 2>/dev/null || true

  # _temp: always safe to prune
  find "$runner_dir/_work/_temp" -mindepth 1 -maxdepth 1 -mtime +1 \
    -exec rm -rf {} + 2>/dev/null || true

  # _actions: prune entries not used in 14 days
  find "$runner_dir/_work/_actions" -mindepth 2 -maxdepth 2 \
    -type d -atime +14 -exec rm -rf {} + 2>/dev/null || true

  log "Cleaned $runner_dir/_work"
done

# ── 3. pnpm content-addressable store ────────────────────────────────────────
if command -v pnpm >/dev/null 2>&1; then
  log "pnpm: pruning store..."
  pnpm store prune 2>&1 | tail -3 | tee -a "$LOG" || true
fi

# Prune pnpm store as root user too (runner installs can go here)
PNPM_STORE_ROOT="/root/.local/share/pnpm/store"
if [ -d "$PNPM_STORE_ROOT" ]; then
  find "$PNPM_STORE_ROOT" -maxdepth 4 -name "*.tgz" -atime +30 -delete 2>/dev/null || true
fi

# ── 4. containerd (k3s) image prune ─────────────────────────────────────────
# Control plane uses /run/k3s/containerd/containerd.sock
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
# Prevent the log from accumulating indefinitely on root
if [ -f "$LOG" ] && [ "$(du -m "$LOG" | cut -f1)" -ge 50 ]; then
  tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
  log "(log truncated to last 500 lines)"
fi

AFTER_ROOT=$(df --output=avail / | tail -1)
log "freed on / : $(( (AFTER_ROOT - BEFORE_ROOT) / 1024 )) MB"
log "=== Cleanup done (omv-main) ==="
