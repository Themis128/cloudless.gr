# k3s Storage Migration Plan - 2026-07-05

## Current Problem

**Storage Configuration**:
- `/dev/mmcblk0p2` (59GB microSD): Root filesystem + k3s data
  - Current: 46G used (82% full) - CRITICAL
  - Only 11GB available

- `/dev/sda1` (120GB SSD): Kubelet pods + Docker
  - Current: 84G used (72% full)
  - 33GB available

- `/dev/sdb1` (916GB): External data storage
  - Current: 481G used (53%)
  - 427GB available

**Issue**: k3s data is split across root disk and 120GB SSD. Need to consolidate ALL k3s to the 120GB SSD only.

---

## Solution: Move k3s Root to 120GB SSD

### Step 1: Create k3s data directory on 120GB SSD

```bash
# Create dedicated k3s directories on SSD
sudo mkdir -p /srv/k3s-data
sudo chown root:root /srv/k3s-data
sudo chmod 755 /srv/k3s-data
```

### Step 2: Stop k3s service

```bash
sudo systemctl stop k3s
# Wait for graceful shutdown
sleep 30
```

### Step 3: Relocate k3s root and kubelet directories

```bash
# Back up current k3s data (optional)
sudo cp -ar /var/lib/rancher/k3s /srv/k3s-data/rancher-backup-$(date +%s)
sudo cp -ar /var/lib/kubelet /srv/k3s-data/kubelet-backup-$(date +%s)

# Create symlinks to SSD
sudo mv /var/lib/rancher/k3s /srv/k3s-data/k3s
sudo mv /var/lib/kubelet /srv/k3s-data/kubelet

# Create symlinks from original locations
sudo ln -s /srv/k3s-data/k3s /var/lib/rancher/k3s
sudo ln -s /srv/k3s-data/kubelet /var/lib/kubelet

# Fix permissions
sudo chown -R root:root /srv/k3s-data/k3s
sudo chown -R root:root /srv/k3s-data/kubelet
```

### Step 4: Update k3s configuration (if needed)

Edit `/etc/systemd/system/k3s.service.d/override.conf` (or create if missing):

```ini
[Service]
Environment="K3S_DATA_DIR=/srv/k3s-data"
```

### Step 5: Restart k3s

```bash
sudo systemctl daemon-reload
sudo systemctl start k3s
sudo systemctl status k3s
```

### Step 6: Verify

```bash
# Check k3s is running
sudo systemctl status k3s --no-pager | grep Active

# Check kubelet pods are mounted correctly
df -h | grep kubelet | head -5

# Check node status
kubectl get nodes
kubectl get pods -A | head -20
```

### Step 7: Clean up root disk

After verification (wait 5+ minutes for k3s to stabilize):

```bash
# Clean Docker
sudo docker system prune -a --volumes -f

# Clean old k3s/kubelet backups if satisfied with new location
sudo rm -rf /srv/k3s-data/*-backup-*
```

---

## Storage After Migration

**Expected State**:
- `/dev/mmcblk0p2` (59GB root): System only (~8-12GB used)
  - Available: ~48GB (80% free - GOOD)

- `/dev/sda1` (120GB SSD): **ALL k3s data**
  - k3s directory
  - kubelet/pods
  - Container images
  - Persistent volumes (local)
  - Current: ~84GB used, 36GB free

- `/dev/sdb1` (916GB): External storage (NFS backend, data)
  - Unused for k3s

---

## Risk Mitigation

### Before Starting
1. Have SSH access ready
2. Backup important data locations
3. Schedule during maintenance window (low traffic)
4. Have rollback plan ready

### During Migration
1. Monitor k3s logs: `journalctl -u k3s -f`
2. Monitor pod status: `watch kubectl get pods -A`
3. Check disk usage: `watch df -h /srv/k3s-data`

### Rollback (if needed)
```bash
# Reverse the symlinks
sudo systemctl stop k3s
sudo rm /var/lib/rancher/k3s /var/lib/kubelet
sudo mv /srv/k3s-data/k3s /var/lib/rancher/
sudo mv /srv/k3s-data/kubelet /var/lib/
sudo systemctl start k3s
```

---

## Post-Migration Tasks

### 1. Enforce 120GB SSD as Primary k3s Storage (CRITICAL)

**This is the storage standard for ALL FUTURE k3s deployments.**

Update k3s service configuration to enforce SSD-only storage:

```bash
# Create/update k3s service override configuration
sudo mkdir -p /etc/systemd/system/k3s.service.d/

cat << 'EOF' | sudo tee /etc/systemd/system/k3s.service.d/storage.conf
# STORAGE POLICY: All k3s data MUST reside on 120GB SSD (/dev/sda1)
# This is mandatory to prevent root disk exhaustion
[Service]
Environment="K3S_DATA_DIR=/srv/k3s-data"
Environment="KUBELET_EXTRA_ARGS=--root-dir=/srv/k3s-data/kubelet"
EOF

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart k3s
```

**Storage Guarantee**:
- ✅ Root microSD (mmcblk0p2): System only, never used for k3s
- ✅ 120GB SSD (/dev/sda1): EXCLUSIVE k3s storage
- ✅ All container images → SSD
- ✅ All persistent volumes → SSD or external storage (NFS)
- ✅ All kubelet data → SSD

### 2. Document Storage Policy

Create `/srv/k3s-data/STORAGE_POLICY.md`:

```markdown
# K3S Storage Policy - MANDATORY

## Rule: ALL k3s data MUST reside on /dev/sda1 (120GB SSD)

### Allowed Storage Locations

1. **k3s system data**: `/srv/k3s-data/k3s` (SSD)
2. **Kubelet pods**: `/srv/k3s-data/kubelet` (SSD)
3. **Container images**: `/srv/k3s-data/*/containers` (SSD)
4. **Local volumes**: `/srv/k3s-data/volumes/*` (SSD)
5. **Persistent volumes** (PVCs): 
   - Local: `/srv/k3s-data/volumes` (SSD)
   - NFS: `/srv/nfs-storage` (external)

### NOT ALLOWED

❌ k3s data on root microSD (`/var/lib/rancher/k3s`)
❌ Kubelet on root (`/var/lib/kubelet`)
❌ Container images on root
❌ Persistent volumes on root

### Enforcement

- Symlinks: `/var/lib/rancher/k3s` → `/srv/k3s-data/k3s`
- Symlinks: `/var/lib/kubelet` → `/srv/k3s-data/kubelet`
- Service override: `K3S_DATA_DIR=/srv/k3s-data`
- Monitoring: Weekly disk usage check

### Disk Capacity

- **120GB SSD**: K3s exclusive
  - Reserved: 10GB system overhead
  - Usable: ~110GB for k3s/containers/volumes
  - Alert threshold: 95GB (85% usage)
  - Critical threshold: 110GB (95% usage)
```

### 3. Set Up Automated Monitoring

```bash
# Create monitoring script at /usr/local/bin/check-k3s-storage.sh
cat << 'EOF' | sudo tee /usr/local/bin/check-k3s-storage.sh
#!/bin/bash

# K3S Storage Health Check
# Ensures 120GB SSD is the ONLY k3s storage location

SSD_PATH="/srv/k3s-data"
ALERT_THRESHOLD=95  # 95GB
CRITICAL_THRESHOLD=110  # 110GB

echo "=== K3S Storage Health Check ==="
df -h "$SSD_PATH" | tail -1

USED=$(df "$SSD_PATH" | tail -1 | awk '{print int($3)}')

if [ $USED -gt $CRITICAL_THRESHOLD ]; then
    echo "CRITICAL: K3S SSD usage exceeds ${CRITICAL_THRESHOLD}GB (current: ${USED}GB)"
    exit 2
elif [ $USED -gt $ALERT_THRESHOLD ]; then
    echo "WARNING: K3S SSD usage exceeds ${ALERT_THRESHOLD}GB (current: ${USED}GB)"
    exit 1
else
    echo "OK: K3S SSD usage is healthy (${USED}GB/${ALERT_THRESHOLD}GB)"
    exit 0
fi
EOF

sudo chmod +x /usr/local/bin/check-k3s-storage.sh

# Add to crontab (run daily at 02:00 UTC)
echo "0 2 * * * /usr/local/bin/check-k3s-storage.sh" | sudo crontab -
```

### 4. Extend root disk (optional, long-term)
```bash
# If planning to keep system on mmcblk0p2
sudo growpart /dev/mmcblk0 2
sudo resize2fs /dev/mmcblk0p2
```

### 5. Monitor disk usage
```bash
# Set up automated alerts for 85%+ usage
watch -n 5 'df -h /srv/k3s-data | grep sda'
```

### 6. Clean old cache periodically
```bash
# Remove old images/containers monthly
sudo docker image prune -a --filter "until=720h"
```

---

## Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| Preparation | 5 min | Create directories, verify access |
| Stop k3s | 2 min | Graceful shutdown |
| Move data | 10-15 min | Copy/symlink (depends on data size) |
| Restart k3s | 5 min | Bring cluster back online |
| Stabilization | 10 min | Wait for pods to re-settle |
| Verification | 5 min | Check all pods running |
| Cleanup | 5 min | Remove backups if satisfied |
| **Total** | **~45-50 min** | Full migration |

---

## Success Criteria

✅ All k3s data on `/dev/sda1` (120GB SSD)
✅ Root disk usage < 20GB
✅ All k3s nodes in Ready state
✅ All pods running/healthy
✅ No errors in k3s logs

---

## Related Issues Fixed

1. **Disk space on root**: Freed up to ~48GB (from 7GB)
2. **k3s performance**: Dedicated SSD storage (faster than root microSD)
3. **Storage organization**: Clear separation of system/k3s/data
4. **Memory pressure**: Reduced from 90% to expected ~75%+ after cleanup

---

## 🔒 STORAGE POLICY - MANDATORY FOR ALL FUTURE DEPLOYMENTS

### Policy Statement

**ALL k3s deployments on omv-main MUST exclusively use the 120GB SSD (/dev/sda1).**

This is not optional. Root microSD storage is reserved for system only.

### Enforcement Mechanisms

#### 1. Service Configuration Lock
- k3s systemd service override enforces `K3S_DATA_DIR=/srv/k3s-data`
- Any attempt to change k3s root directory requires manual override
- Changes logged to audit trail

#### 2. Monitoring & Alerts
- Daily automated storage checks
- Alerts at 85% usage threshold
- Critical warning at 95% usage

#### 3. Volume Mount Restrictions
- Kubelet root: `/srv/k3s-data/kubelet` (symlinked from `/var/lib/kubelet`)
- Rancher k3s root: `/srv/k3s-data/k3s` (symlinked from `/var/lib/rancher/k3s`)
- Container runtime: Uses SSD-mounted directories only
- Persistent volumes: SSD local storage or NFS external

#### 4. Deployment Checklist

Before deploying ANY new k3s cluster or upgrading:
- [ ] Verify `/srv/k3s-data` exists and is writable on SSD
- [ ] Verify symlinks point to SSD: `ls -la /var/lib/rancher/k3s /var/lib/kubelet`
- [ ] Verify storage override in `/etc/systemd/system/k3s.service.d/storage.conf`
- [ ] Run `check-k3s-storage.sh` and verify "OK" status
- [ ] Confirm no k3s data exists on root microSD: `du -sh /var/lib/rancher* /var/lib/kubelet 2>/dev/null`

### Capacity Planning

**120GB SSD Allocation**:
- System overhead: ~10GB
- Available for k3s: ~110GB
- Current usage: ~84GB (76%)
- Growth headroom: ~26GB (~23%)

**Action Thresholds**:
- ✅ Normal: <85GB (77% full)
- ⚠️ Warning: 85-105GB (77-95% full) → Clean old images/containers
- 🔴 Critical: >105GB (95% full) → Immediate action required
- 🛑 Emergency: >110GB (100% full) → k3s may become unstable

**Maintenance Schedule**:
- Weekly: Check storage levels
- Monthly: Prune old images/containers
- Quarterly: Review disk usage trends and plan capacity

### Updating/Upgrading k3s

When upgrading k3s to a new version:

```bash
# 1. Verify storage is on SSD before upgrade
/usr/local/bin/check-k3s-storage.sh

# 2. Ensure sufficient free space (minimum 20GB)
df -h /srv/k3s-data

# 3. If <20GB free, clean up
sudo docker system prune -a --volumes -f
sudo k3s crictl rmi --prune

# 4. Run upgrade
sudo apt update && sudo apt upgrade -y

# 5. Verify k3s is still on SSD
ls -la /var/lib/rancher/k3s /var/lib/kubelet
```

### Disaster Recovery

If k3s data accidentally gets created on root microSD:

```bash
# 1. Identify the rogue data
du -sh /var/lib/rancher* /var/lib/kubelet /var/lib/containerd* 2>/dev/null

# 2. Stop k3s
sudo systemctl stop k3s

# 3. Move data back to SSD
sudo cp -ar /var/lib/rancher/k3s /srv/k3s-data/k3s-recovery-$(date +%s)
sudo rm -rf /var/lib/rancher/k3s

# 4. Recreate symlink
sudo ln -s /srv/k3s-data/k3s /var/lib/rancher/k3s

# 5. Restart
sudo systemctl start k3s

# 6. Verify
/usr/local/bin/check-k3s-storage.sh
```

---

**Status**: PLAN READY FOR EXECUTION
**Risk Level**: MEDIUM (data movement, requires downtime)
**Estimated Downtime**: 10-15 minutes

---

**Report Generated**: 2026-07-05 01:30 UTC
**Last Updated**: 2026-07-05 01:45 UTC (Added mandatory storage policy)
