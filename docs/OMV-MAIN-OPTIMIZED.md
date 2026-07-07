# omv-main-optimized Architecture

## Overview
Consolidated single-node Kubernetes architecture on omv (Raspberry Pi 5, 8GB RAM, 120GB SSD NVMe)

## Node Configuration
- **Hostname:** omv
- **IP:** 192.168.1.128
- **Role:** control-plane, etcd
- **Memory:** 8GB RAM
- **Storage:** 120GB NVMe SSD (/dev/sda1)

## Architecture Principles

### 1. Minimum Replicas + Auto-Recovery
- All deployments start with `replicas: 1`
- HPA configured for scaling under load (min: 1, max: 1-3 based on requirements)
- When pods are destroyed, ReplicaSet ensures automatic recreation

### 2. Node Affinity
All pods targeted to omv via:
```yaml
spec:
  nodeSelector:
    kubernetes.io/hostname: omv
```

### 3. Resource Optimization
- Memory requests: 128Mi (minimum viable) to 256Mi (standard)
- Memory limits: 256Mi to 512Mi
- CPU requests: 100m to 250m
- Allow burst to 500m CPU

## Applied Changes (2026-07-07)

### Deployments Updated
- `cloudless-app`: added `nodeSelector: omv`, reduced to 128Mi/256Mi memory
- `appflowy-worker`: added `nodeSelector: omv`

### DaemonSets Updated
- `svclb-traefik-239feff3`: added `nodeSelector: omv`
- `kube-prom-prometheus-node-exporter`: added `nodeSelector: omv`

### CronJobs Suspended
- analytics: ml-anomaly-detect, ml-train-collab, s3-to-duckdb-sync
- cloudless: auto-healer, config-sync, image-sync
- espocrm: mariadb-xbstream-backup, pvc-backup-espocrm
- postiz: postiz-slack-notify, pvc-backup-postiz
- kube-system: health-monitor
- monitoring: cluster-alerts, omv-disk-watchdog

### HPA Updated
- `cloudless-app-hpa`: maxReplicas set to 1 (was 3)

## Remaining Issues
- ECR image pull authentication needed for `cloudless-pi-app:latest`

## Storage Strategy

### NVMe SSD Mounts
- `/var/lib/rancher/k3s/storage` - local-path-provisioner (PVs)
- `/mnt/sdb1` - NFS/secondary storage for backups

### PVCs on omv
All PVCs use `local-path` provisioner targeting omv's NVMe storage.

## Network Configuration

### Traefik Load Balancer
- Single `svclb-traefik` pod on omv
- Cloudflare Tunnel provides external access
- Tailscale for internal access

### Services
- Internal ClusterIP for all services
- NodePort for debugging/external access if needed

## Failure Recovery

### Self-Healing
1. **Liveness Probes** - Restart hung containers
2. **Readiness Probes** - Remove unhealthy pods from service
3. **ReplicaSets** - Ensure minimum pod count
4. **HPA** - Scale under CPU/memory pressure
5. **PodDisruptionBudget** - Maintain availability during maintenance

### Backup Strategy
- EspoCRM MariaDB: Daily xbstream backup to NFS
- PVC backups: Disabled (use node-level snapshots)

## Implementation Commands

```bash
# Apply nodeSelector to all deployments
kubectl patch deployment -n cloudless cloudless-app -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}'

# Suspend heavy CronJobs
kubectl patch cronjob -n analytics ml-anomaly-detect -p '{"spec":{"suspend":true}}'
kubectl patch cronjob -n analytics ml-train-collab -p '{"spec":{"suspend":true}}'
kubectl patch cronjob -n cloudless auto-healer -p '{"spec":{"suspend":true}}'
kubectl patch cronjob -n cloudless image-sync -p '{"spec":{"suspend":true}}'
kubectl patch cronjob -n cloudless config-sync -p '{"spec":{"suspend":true}}'
kubectl patch cronjob -n espocrm mariadb-xbstream-backup -p '{"spec":{"suspend":true}}'

# Cordon omv-ha to prevent scheduling
kubectl cordon omv-ha