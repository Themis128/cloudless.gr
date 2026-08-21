#!/usr/bin/env bash
# setup-ai-swap.sh — create a 6 GB swapfile on sdb1 (1 TB user-data SSD).
#
# Run once on omv-main as root.  Safe to re-run — skips steps already done.
#
# Why sdb1 and not sda1:
#   sda1 (119 GB) is the dedicated k3s SSD — every extra write there eats
#   into the headroom that k3s, etcd, and local-path PVCs depend on.
#   sdb1 (916 GB) holds only Windows backups; 6 GB is <1% of free space.
#
# Result: 8 GB RAM + 6 GB swap = 14 GB effective address space.
# This lets vllm-kimi (~4.5 GB) run alongside the full k3s stack without
# OOM-killing other pods.  vm.swappiness=15 keeps swap as a last resort
# during normal operation; the kernel promotes it automatically when the
# AI model load pushes RSS above physical RAM.
#
# Usage:
#   sudo bash infrastructure/omv/setup-ai-swap.sh

set -euo pipefail

SDB1_MOUNT="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"
SWAPFILE="${SDB1_MOUNT}/ai-swap.swp"
SWAP_SIZE_GB=6
SWAPPINESS=15

# ── 1. Verify sdb1 is mounted ────────────────────────────────────────────────
if ! mountpoint -q "${SDB1_MOUNT}"; then
  echo "ERROR: ${SDB1_MOUNT} is not mounted. Check OMV mounts." >&2
  exit 1
fi

AVAIL_GB=$(df -BG "${SDB1_MOUNT}" | awk 'NR==2{gsub(/G/,"",$4); print $4}')
echo "→ sdb1 available: ${AVAIL_GB} GB"
if [ "${AVAIL_GB}" -lt "$((SWAP_SIZE_GB + 5))" ]; then
  echo "ERROR: less than $((SWAP_SIZE_GB + 5)) GB free on sdb1." >&2
  exit 1
fi

# ── 2. Create swapfile (skip if it exists and is the right size) ──────────────
if [ -f "${SWAPFILE}" ]; then
  CURRENT_SIZE=$(stat -c%s "${SWAPFILE}" 2>/dev/null || echo 0)
  EXPECTED_SIZE=$(( SWAP_SIZE_GB * 1024 * 1024 * 1024 ))
  if [ "${CURRENT_SIZE}" -ge "${EXPECTED_SIZE}" ]; then
    echo "→ swapfile already exists at correct size (${CURRENT_SIZE} bytes) — skipping creation"
  else
    echo "→ swapfile exists but wrong size — recreating"
    swapoff "${SWAPFILE}" 2>/dev/null || true
    rm -f "${SWAPFILE}"
    fallocate -l "${SWAP_SIZE_GB}G" "${SWAPFILE}"
  fi
else
  echo "→ creating ${SWAP_SIZE_GB} GB swapfile at ${SWAPFILE}"
  fallocate -l "${SWAP_SIZE_GB}G" "${SWAPFILE}"
fi

chmod 600 "${SWAPFILE}"
file "${SWAPFILE}" | grep -q "swap file" || mkswap "${SWAPFILE}"

# ── 3. Enable swap now ────────────────────────────────────────────────────────
if swapon --show=NAME | grep -qF "${SWAPFILE}"; then
  echo "→ swap already active on ${SWAPFILE}"
else
  swapon "${SWAPFILE}"
  echo "→ swap activated"
fi

swapon --show
free -h

# ── 4. Persist in /etc/fstab ──────────────────────────────────────────────────
FSTAB_ENTRY="${SWAPFILE} none swap sw,nofail 0 0"
if grep -qF "${SWAPFILE}" /etc/fstab; then
  echo "→ /etc/fstab entry already present — skipping"
else
  echo "${FSTAB_ENTRY}" >> /etc/fstab
  echo "→ added to /etc/fstab: ${FSTAB_ENTRY}"
fi

# ── 5. Set vm.swappiness (low = swap only under real pressure) ────────────────
sysctl -w vm.swappiness="${SWAPPINESS}" > /dev/null

SYSCTL_CONF=/etc/sysctl.d/60-cloudless-swap.conf
if [ ! -f "${SYSCTL_CONF}" ] || ! grep -q "vm.swappiness" "${SYSCTL_CONF}"; then
  cat > "${SYSCTL_CONF}" <<EOF
# Swap tuning for AI workloads on omv-main (Pi 5, 8 GB + 6 GB swap on sdb1).
# Low swappiness = only swap under real RAM pressure, not proactively.
vm.swappiness = ${SWAPPINESS}
# Keep vfs cache pressure moderate so file metadata stays cached.
vm.vfs_cache_pressure = 50
EOF
  echo "→ wrote ${SYSCTL_CONF}"
else
  echo "→ ${SYSCTL_CONF} already configured"
fi

sysctl -p "${SYSCTL_CONF}" > /dev/null

echo ""
echo "✅ Done — 6 GB swap on sdb1 active and persistent."
echo "   Effective memory: 8 GB RAM + 6 GB swap = 14 GB"
echo "   vm.swappiness = ${SWAPPINESS} (swap used only under real pressure)"
echo ""
echo "   Scale AI up:   gh workflow run ai-scale.yml -f action=up"
echo "   Scale AI down: gh workflow run ai-scale.yml -f action=down"
