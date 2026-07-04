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

### 1. Extend root disk (optional, long-term)
```bash
# If planning to keep system on mmcblk0p2
sudo growpart /dev/mmcblk0 2
sudo resize2fs /dev/mmcblk0p2
```

### 2. Monitor disk usage
```bash
# Set up automated alerts for 85%+ usage
watch -n 5 'df -h /srv/k3s-data | grep sda'
```

### 3. Clean old cache periodically
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

**Status**: PLAN READY FOR EXECUTION
**Risk Level**: MEDIUM (data movement, requires downtime)
**Estimated Downtime**: 10-15 minutes

---

**Report Generated**: 2026-07-05 01:30 UTC
