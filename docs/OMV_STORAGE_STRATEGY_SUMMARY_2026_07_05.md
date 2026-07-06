# OMV Storage Strategy - Complete Summary - 2026-07-05

> **STATUS (2026-07-06)**: ✅ **DEPLOYED & ACTIVE**
>
> - **Primary SSD**: 120GB SSD (/dev/sda1) is the exclusive k3s data store.
> - **Root SD**: MicroSD usage reduced to 75% (15G free) after log/image pruning.
> - **Maintenance**: Nightly cleanup and auto-expand services are active.

## Executive Summary

**Complete storage strategy for omv-main with 3-tier architecture and automatic overflow capability.**

### Storage Hierarchy

```
TIER 1: Primary (120GB SSD)
├─ Exclusive k3s storage (/srv/k3s-data)
├─ Symlinks from /var/lib/rancher/k3s and /var/lib/kubelet
├─ Current: 84GB (76%)
└─ Headroom: 36GB (24%)

TIER 2: Overflow (916GB SSD)
├─ Auto-activates when Tier 1 reaches 98% (108GB)
├─ Container images, volumes, cache
├─ Transparent to applications (symlinked)
└─ No manual intervention needed

TIER 3: System (59GB microSD)
├─ Root filesystem only
├─ NO k3s data (policy enforced)
├─ Current after cleanup: 46GB (82%)
└─ Free space: 11GB (18%)
```

---

## Key Features

### ✅ **Primary: 120GB SSD Exclusive**

- **Mandatory policy**: All k3s must use 120GB SSD
- **Enforcement**: Symlinks + systemd service override
- **Verification**: Deployment checklist required
- **Monitoring**: Daily health checks

### ✅ **Dynamic Overflow from 916GB SSD**

- **Trigger**: Automatic at 108GB (98% full)
- **What moves**: Images, volumes, cache
- **Process**: Fully automatic, no manual steps
- **Monitoring**: Every 5 minutes via systemd service

### ✅ **Redundancy & Fallback**

- **No single failure**: Can use up to 520GB total (120 + 400GB from 916GB)
- **Performance tiered**: Active on primary SSD, cold on secondary
- **Emergency procedures**: Documented and automated

### ✅ **Monitoring & Alerts**

- **Health check**: Daily at 02:00 UTC
- **Auto-expand monitor**: Every 5 minutes (systemd service)
- **Alert thresholds**: 95% warning, 100% critical
- **Logs**: All captured in journalctl

### ✅ **High Availability (99.9% Uptime SLA)**

- **Mandatory requirement**: All apps must always be up
- **Zero-downtime operations**: Storage changes transparent to pods
- **Automatic failover**: Overflow activates without manual intervention
- **Pod protection**: Disruption budgets ensure minimum pod availability
- **Health checks**: Continuous monitoring on all pods/nodes/volumes

---

## High Availability Strategy: Apps Always Up (99.9% SLA)

### Core Principle: Zero-Downtime Storage Operations

**All storage operations must be transparent to running applications.**

#### Guaranteed Non-Disruptive Operations

✅ **Automatic overflow activation**: No service interrupt
✅ **Container image moves**: Symlink-based, non-blocking
✅ **Volume migration**: Transparent remounting
✅ **Disk space checks**: Background monitoring only
✅ **Health monitoring**: Passive observation, no intervention
✅ **Cache cleanup**: Off-peak hours (02:00 UTC)

#### Pod Uptime Guarantees

**Pod Disruption Budget** (mandatory for all apps):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: app-pdb
spec:
  minAvailable: 50% # Keep 50% running always
  maxUnavailable: 1 # Max 1 pod down at a time
  unhealthyPodEvictionPolicy: AlwaysAllow
  selector:
    matchLabels:
      app: my-app
```

**Graceful Shutdown**:

- terminationGracePeriodSeconds: 30
- preStop hooks for connection draining
- No force-kill during storage operations

#### Uptime SLA Targets

| Service       | Target | Max Downtime  | Notes                    |
| ------------- | ------ | ------------- | ------------------------ |
| k3s cluster   | 99.9%  | 43 min/month  | Auto-expand, no manual   |
| Apps (pods)   | 99.95% | 22 min/month  | Rolling updates only     |
| Primary SSD   | 99.99% | 4 min/month   | No RAID (SSD durability) |
| Overflow pool | 99.5%  | 3.6 hrs/month | Secondary tier           |
| DNS/routing   | 99.99% | 4 min/month   | Cloudflare + tunnel      |

#### Monitoring for Availability

**Real-time checks** (automated):

```bash
# All pods running
kubectl get pods -A | grep -v Running | grep -v Completed

# All nodes ready
kubectl get nodes | grep NotReady

# All volumes bound
kubectl get pv | grep -v Bound

# Service endpoints healthy
kubectl get endpoints -A | grep none
```

**Alerts triggered if**:

- Pod CrashLoopBackOff detected
- Node status NotReady
- PVC pending/failed
- etcd cluster unhealthy
- Storage utilization >95%

#### Maintenance Window Policy

**Preferred: ZERO maintenance windows** (all operations automated)

**If manual work required** (rare):

- Day: Saturdays only
- Time: 02:00-03:00 UTC (low traffic)
- Max duration: 60 minutes
- Advance notice: 7 days minimum
- Rollback: Always tested before starting
- SLA credit: If exceeds 1 hour

---

## Implementation: Migration with Zero Downtime

### Phase 1: Migration (Minimal Downtime, ~15 min actual, 1 hr total window)

**Pre-migration**:

```bash
# 1. Drain non-critical pods to secondary nodes (if multi-node)
# 2. Take backup of /var/lib/rancher/k3s
# 3. Get baseline health status
kubectl get nodes
kubectl get pods -A | wc -l

# 4. Announce maintenance window (if any pods will be briefly paused)
```

**Migration**:

```bash
# 1. Create directories
sudo mkdir -p /srv/k3s-data

# 2. GRACEFUL STOP (not force kill)
sudo systemctl stop k3s
# k3s sends SIGTERM to all pods, waits 30 sec, then exits
# Pods get time to drain connections and save state
sleep 60  # Wait for all pods to terminate

# 3. Move data (takes 5-10 min depending on size)
sudo mv /var/lib/rancher/k3s /srv/k3s-data/k3s
sudo mv /var/lib/kubelet /srv/k3s-data/kubelet

# 4. Create symlinks (instant)
sudo ln -s /srv/k3s-data/k3s /var/lib/rancher/k3s
sudo ln -s /srv/k3s-data/kubelet /var/lib/kubelet

# 5. Update k3s config
sudo mkdir -p /etc/systemd/system/k3s.service.d/
# Add K3S_DATA_DIR=/srv/k3s-data to override.conf

# 6. Start k3s (takes 30-60 sec to be ready)
sudo systemctl daemon-reload
sudo systemctl start k3s

# 7. Wait for cluster to stabilize
sleep 60  # Let etcd sync and nodes rejoin
```

**Post-migration** (verify all pods recover):

```bash
# 1. Check node status (wait until Ready)
kubectl get nodes -w

# 2. Check pod status (wait until Running)
watch kubectl get pods -A

# 3. Run smoke tests
kubectl get pods -A | wc -l  # Should match pre-migration count

# 4. Check application health
# (Application-specific checks - curl endpoints, etc)

# 5. Verify data integrity
ls -la /var/lib/rancher/k3s /var/lib/kubelet  # Should be symlinks
```

**Expected timeline**:

- Stop k3s: 1 min
- Move data: 5-10 min
- Symlinks: <1 min
- Start k3s: 1 min
- Stabilization: 2-5 min
- **Total**: 10-20 minutes
- **Pods down**: 10-15 minutes (acceptable SLA break, one-time)

**Apps experience**:

- ~15 min of pod restarts (rolling, not bulk)
- Services brief interruption while pods recover
- No data loss
- Automatic recovery once k3s starts

### Phase 2: Auto-Monitoring Setup (Minimal downtime)

```bash
# 1. Deploy monitoring scripts
sudo cp check-k3s-storage.sh /usr/local/bin/
sudo cp k3s-auto-expand.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/k3s-*.sh

# 2. Install systemd service
sudo systemctl daemon-reload
sudo systemctl enable k3s-auto-expand.service
sudo systemctl start k3s-auto-expand.service

# 3. Add crontab for daily health check
echo "0 2 * * * /usr/local/bin/check-k3s-storage.sh" | sudo crontab -
```

### Phase 3: Verification

```bash
# 1. Verify primary storage
ls -la /var/lib/rancher/k3s /var/lib/kubelet  # Should show symlinks

# 2. Verify services
sudo systemctl status k3s-auto-expand.service  # Should be running

# 3. Test health check
/usr/local/bin/check-k3s-storage.sh  # Should exit 0 (OK)

# 4. Check node status
kubectl get nodes  # All should be Ready
kubectl get pods -A | grep -i error  # Should be empty
```

---

## Capacity Planning

### Current State

| Storage      | Total    | Used     | Free     | % Full  | Notes                 |
| ------------ | -------- | -------- | -------- | ------- | --------------------- |
| 120GB SSD    | 120G     | 84G      | 36G      | 70%     | Primary k3s           |
| 916GB SSD    | 916G     | 481G     | 435G     | 53%     | Overflow available    |
| Root microSD | 59G      | 46G      | 11G      | 78%     | System only (cleaned) |
| **TOTAL**    | **1.1T** | **611G** | **482G** | **55%** | Healthy state         |

### Alert Thresholds

| Threshold | Primary   | Overflow | Total     | Action              |
| --------- | --------- | -------- | --------- | ------------------- |
| Normal    | <105GB    | 0GB      | <105GB    | ✅ Monitor weekly   |
| Warning   | 105-108GB | >0GB     | 105-200GB | 🟡 Overflow active  |
| Critical  | >108GB    | >100GB   | >200GB    | 🔴 Cleanup required |

### Headroom Calculation

- **Safe operating range**: 60-80GB used on primary (50-67%)
- **Current headroom**: 36GB (24% free)
- **Projected burnout**: 2-3 months at current growth rate
- **Recommendation**: Plan expansion in Q4 2026

---

## Monitoring & Maintenance

### Daily (Automated)

- ✅ Health check runs at 02:00 UTC
- ✅ Auto-expand monitor runs continuously (5-min intervals)
- ✅ Logs captured in journalctl

### Weekly (Manual)

```bash
# Check storage status
df -h /srv/k3s-data /srv/k3s-overflow

# Review monitoring logs
sudo journalctl -u k3s-auto-expand.service -n 20

# Verify no k3s data on root
du -sh /var/lib/rancher* /var/lib/kubelet 2>/dev/null
```

### Monthly (Maintenance)

```bash
# Prune old images
sudo docker image prune -a --filter "until=720h" -f

# Clean journals if large
sudo journalctl --vacuum-size=200M

# Review disk trends
df -h /srv/k3s-* | tee /tmp/storage-report-$(date +%Y%m%d).txt
```

### Quarterly (Planning)

- Review capacity trends
- Plan for expansion if >80% used
- Document any issues
- Update this runbook

---

## Emergency Procedures

### Scenario 1: Primary SSD Approaching Full (>108GB)

**Expected behavior**: Overflow automatically activates

```bash
# Verify overflow activated
ls -la /srv/k3s-data/overflow-* /srv/k3s-overflow/

# If needed, manually trigger cleanup
sudo docker image prune -a -f
sudo docker system prune -a --volumes -f
```

### Scenario 2: Both Primary & Overflow Full (>210GB combined)

**Immediate action required**:

```bash
# 1. Stop non-critical pods
kubectl scale deployment <app> --replicas=0 -n <namespace>

# 2. Aggressive cleanup
sudo docker image prune -a -f
sudo docker system prune -a --volumes -f
sudo journalctl --vacuum-size=100M

# 3. Identify largest consumers
du -sh /srv/k3s-data/* /srv/k3s-overflow/* | sort -rh | head -20

# 4. Manual cleanup (with caution)
# Remove old pod logs, unused volumes, etc.

# 5. Restart k3s if stuck
sudo systemctl restart k3s
```

### Scenario 3: k3s Data Found on Root MicroSD

**Data leakage - must remediate**:

```bash
# 1. Check what leaked
du -sh /var/lib/rancher* /var/lib/kubelet* /var/lib/containerd* 2>/dev/null

# 2. Stop k3s
sudo systemctl stop k3s && sleep 10

# 3. Move back to SSD
sudo cp -ar /var/lib/rancher/k3s /srv/k3s-data/k3s-recovery-$(date +%s)
sudo rm -rf /var/lib/rancher/k3s /var/lib/kubelet

# 4. Verify symlinks exist
ls -la /var/lib/rancher/k3s /var/lib/kubelet

# 5. Restart
sudo systemctl start k3s

# 6. Verify
/usr/local/bin/check-k3s-storage.sh
kubectl get nodes
```

---

## Long-Term Improvements

### 6 Months (Q4 2026)

- [ ] Evaluate current usage trends
- [ ] Plan primary SSD expansion if needed (256GB+ recommended)
- [ ] Consider tiered storage architecture

### 12 Months (Q2 2027)

- [ ] Review if overflow storage is used frequently
- [ ] If yes, upgrade 916GB SSD or add fast tier
- [ ] Implement local-path-provisioner for volumes

### 24 Months (Q2 2028)

- [ ] Full storage audit
- [ ] Performance baseline analysis
- [ ] Architecture re-assessment

---

## Success Criteria

✅ **Migration Phase**:

- All k3s data on 120GB SSD
- Root disk usage <20GB
- All nodes in Ready state
- All pods running

✅ **Monitoring Phase**:

- Auto-expand service running
- Daily health checks executing
- Overflow directories created
- No manual warnings

✅ **Long-term**:

- 120GB SSD never exceeds 110GB (100%)
- Overflow used <50% of time
- Root disk remains clean (<15GB)
- No data loss or corruption

---

## Documentation Location

Primary plan: `docs/K3S_STORAGE_MIGRATION_PLAN_2026_07_05.md`

- Step-by-step migration
- Service configurations
- Monitoring scripts (bash)
- Deployment checklist
- Disaster recovery procedures

Related documents:

- `docs/OMV_HEALTH_CHECK_2026_07_05.md` - Current system state
- `docs/K3S_STORAGE_MIGRATION_PLAN_2026_07_05.md` - Detailed implementation

---

## Contact & Escalation

**For monitoring alerts**:

- Check: `sudo journalctl -u k3s-auto-expand.service`
- Run health check: `/usr/local/bin/check-k3s-storage.sh`

**For emergency overflow**:

- See "Emergency Procedures" section above
- Follows: automated → alert → manual cleanup → expansion

**For long-term planning**:

- Review quarterly trends
- Plan expansion if >80% utilized
- Consider architecture changes if overflow used frequently

---

**Status**: ✅ **COMPLETE - READY FOR DEPLOYMENT**
**Risk Level**: MEDIUM (migration requires ~15 min downtime)
**Complexity**: HIGH (advanced storage architecture)
**Maintenance Effort**: LOW (mostly automated)

**Report Generated**: 2026-07-05 01:50 UTC
**Last Updated**: 2026-07-05 02:00 UTC (Added overflow mechanism)
