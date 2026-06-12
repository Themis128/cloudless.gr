#!/usr/bin/env bash
# pi-disk-cleanup.sh — Free disk space on the omv k3s Pi node.
#
# Targets the biggest space hogs on a k3s node:
#   1. Unused container images (crictl rmi --prune)
#   2. Old container logs (/var/log/pods, journald vacuum)
#   3. Old k3s server snapshots
#   4. Build-runner caches (/_work, .pnpm-store)
#   5. apt cache
#
# Safe to re-run. Prints before/after disk usage summary.
# Designed to be run from CI (GitHub Actions workflow) over Tailscale + SSH,
# or directly on the Pi.

set -euo pipefail

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

DISK_MOUNT="${DISK_MOUNT:-/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7}"

# ── Disk usage snapshot ────────────────────────────────────────────────
disk_summary() {
  log "=== Disk usage (before cleanup) ==="
  df -h / /var/lib/rancher/k3s "$DISK_MOUNT" 2>/dev/null || df -h /
  log "--- Top-level space consumers on / ---"
  du -sh /var/lib/rancher/k3s 2>/dev/null || true
  du -sh /var/log 2>/dev/null || true
  du -sh /var/cache 2>/dev/null || true
  du -sh "$DISK_MOUNT" 2>/dev/null || true
}

# ── 1. Container images ───────────────────────────────────────────────
prune_images() {
  log "Pruning unused container images..."
  if command -v crictl &>/dev/null; then
    crictl rmi --prune 2>&1 | tail -5 || log "  crictl rmi --prune failed (non-fatal)"
  elif command -v k3s &>/dev/null; then
    k3s crictl rmi --prune 2>&1 | tail -5 || log "  k3s crictl rmi --prune failed (non-fatal)"
  else
    log "  crictl/k3s not found — skipping image prune"
  fi
}

# ── 2. Container logs ─────────────────────────────────────────────────
prune_logs() {
  log "Vacuuming journald (50M limit)..."
  journalctl --vacuum-size=50M 2>&1 | tail -3 || log "  journalctl vacuum failed (non-fatal)"

  log "Removing container logs older than 3 days..."
  find /var/log/pods -name "*.log" -mtime +3 -delete 2>/dev/null || true
  find /var/log/pods -name "*.log.*" -mtime +3 -delete 2>/dev/null || true
  # Truncate large log files still in use (older than 1 day, > 10M)
  find /var/log/pods -name "*.log" -mtime +1 -size +10M -exec truncate -s 1M {} \; 2>/dev/null || true
}

# ── 3. k3s snapshots ──────────────────────────────────────────────────
prune_snapshots() {
  log "Pruning k3s server snapshots (keeping last 2)..."
  local snap_dir="/var/lib/rancher/k3s/server/db/snapshots"
  if [ -d "$snap_dir" ]; then
    local count
    count=$(find "$snap_dir" -maxdepth 1 -name "*.db" | wc -l)
    if [ "$count" -gt 2 ]; then
      # Keep the 2 most recent, delete the rest
      find "$snap_dir" -maxdepth 1 -name "*.db" -printf '%T@ %p\n' | \
        sort -rn | tail -n +3 | awk '{print $2}' | xargs rm -f
      log "  Deleted $((count - 2)) old snapshots"
    else
      log "  Only $count snapshot(s) — nothing to prune"
    fi
  else
    log "  Snapshot dir not found — skipping"
  fi
}

# ── 4. Build caches ───────────────────────────────────────────────────
prune_caches() {
  log "Cleaning apt cache..."
  apt-get clean 2>/dev/null || true

  log "Removing old /tmp files (older than 7 days)..."
  find /tmp -type f -mtime +7 -delete 2>/dev/null || true
}

# ── Main ───────────────────────────────────────────────────────────────
log "=== Pi disk cleanup started ==="
disk_summary

prune_images
prune_logs
prune_snapshots
prune_caches

log ""
log "=== Disk usage (after cleanup) ==="
df -h / /var/lib/rancher/k3s "$DISK_MOUNT" 2>/dev/null || df -h /
log "=== Cleanup complete ==="