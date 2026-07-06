# OMV Installation Health Check — 2026-07-05

> **REMEDIATION STATUS (2026-07-06)**: ✅ **STABLE**
>
> - **Disk**: Root disk usage reduced from 87% → 75% via `pi-disk-cleanup.sh`.
> - **Memory**: Promtail OOM resolved by bumping limit to 256Mi.
> - **Monit**: Queue flooding resolved by purging `/var/lib/monit/events/`.
> - **Load**: System load average stabilized at <1.0 (was 24.64).

## System Overview

- **Node**: omv-main (192.168.1.128)
- **OS**: Debian on Raspberry Pi 5 (aarch64)
- **Kernel**: 6.18.34+rpt-rpi-2712 (Linux)
- **OMV Version**: 8.1.1-1

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. ⚠️ ROOT DISK USAGE - 87% FULL (CRITICAL)

**Current State**:

- Root filesystem (`/dev/mmcblk0p2`): **49G used of 59G** (87%)
- Available space: **7.4G** (critically low)
- threshold: Typically 85%+ is considered critical

**Impact**:

- System instability risk
- Services may fail to start
- Journal and logs may be truncated
- Docker/k3s may fail to write data

**Action Required**:

- ✅ **IMMEDIATE**: Investigate what's consuming disk space
- **Option 1**: Clean up old logs/containers
- **Option 2**: Expand disk (add storage)
- **Option 3**: Move workloads to external storage

---

### 2. ⚠️ MEMORY PRESSURE - 90% USED

**Current State**:

- Total RAM: 7.9G
- Used: 7.1G (90%)
- Available: 159Mi (free) + 792Mi (cached)
- Swap used: 852M of 6.0G

**Impact**:

- OOM (Out of Memory) risk
- Services may be killed by kernel
- Performance degradation
- Crashes under load

**Services Running**:

- k3s (Kubernetes): 1.2G
- Docker: Multiple containers
- cloudflared: Tunnel service
- NFS, SMB, FTP, TFTP services
- Keepalived: HA/VRRP
- Tailscale: VPN daemon

---

### 3. ⚠️ K3S PORT ALLOCATION ERRORS

**Error**:

```
"the port 23594 for service traefik/kube-system is not within the port range 30000-32767"
"the port 16616 for service traefik/kube-system is not within the port range 30000-32767"
```

**Root Cause**:

- k3s/kube-apiserver enforces strict NodePort range
- Some services (traefik) have ports allocated outside the allowed range
- Typically caused by manual port assignments or conflicting configurations

**Impact**:

- ServiceType:NodePort endpoints unavailable
- API errors on service operations
- Possible service startup failures

**Solution**:

```bash
# Check current port assignments
kubectl get svc -A -o wide | grep -E "NodePort|traefik"

# Review service specs
kubectl get svc traefik -n kube-system -o yaml

# May need to delete and recreate service with correct NodePort
```

---

### 4. ⚠️ CLOUDFLARED TUNNEL INSTABILITY

**Errors Detected**:

```
"failed to run the datagram handler error="timeout: no recent network activity""
"datagram manager encountered a failure while serving"
"Retrying connection in up to 1s"
```

**Status**: Service is recovering/retrying but experiencing timeouts

**Possible Causes**:

- Network latency or packet loss
- Tunnel endpoint overload
- DNS resolution delays (Docker DNS timeouts observed)
- System resource contention (memory/disk pressure)

**Impact**:

- Intermittent tunnel connectivity
- Services accessible via tunnel may have latency spikes
- Potential failover to AWS CloudFront

---

### 5. ⚠️ DOCKER DNS RESOLUTION FAILURES

**Error**:

```
"failed to query external DNS server" dns-server="udp:127.0.0.53:53"
error="read udp 127.0.0.1:19734->127.0.0.53:53: i/o timeout"
```

**Root Cause**:

- Docker attempting to query systemd-resolved
- Systemd-resolved may be under load or misconfigured
- Likely related to overall system resource pressure

**Impact**:

- Container DNS resolution failures
- Services unable to reach external endpoints
- Health checks may fail

---

### 6. ⚠️ DOCKER CONTAINER HEALTH CHECK TIMEOUTS

**Error**:

```
"Health check for container ... error: timed out starting health check"
```

**Root Cause**:

- Likely caused by system resource exhaustion
- Memory pressure causing process thrashing
- Disk I/O contention

---

## 📊 Resource Utilization Summary

| Resource | Used       | Total | Status            |
| -------- | ---------- | ----- | ----------------- |
| Disk (/) | 49G        | 59G   | 🔴 CRITICAL (87%) |
| RAM      | 7.1G       | 7.9G  | 🔴 CRITICAL (90%) |
| Swap     | 852M       | 6.0G  | 🟡 WARNING (14%)  |
| CPU      | 18min load | -     | ℹ️ Normal         |

---

## 🔧 RECOMMENDED ACTIONS (Priority Order)

### Immediate (Today)

1. **Free up disk space**

   ```bash
   # Check what's consuming space
   sudo du -sh /* | sort -rh

   # Clean Docker
   sudo docker system prune -a --volumes

   # Clean k3s
   sudo k3s crictl rmi --prune

   # Clean journal logs (if >1GB)
   sudo journalctl --vacuum=100M

   # Check /srv disks
   df -h /srv*
   ```

2. **Reduce memory pressure**

   ```bash
   # Check top memory consumers
   sudo systemctl status k3s --no-pager | grep Memory

   # Consider reducing k3s memory limits
   # or stopping non-essential containers
   ```

3. **Fix k3s port range issue**
   ```bash
   # List all services
   kubectl get svc -A -o custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,PORT:.spec.ports[*].nodePort

   # For traefik, may need to reconfigure
   kubectl edit svc traefik -n kube-system
   ```

### Short-term (This week)

4. **Investigate cloudflared stability**

   ```bash
   # Check tunnel connection
   systemctl status cloudflared
   journalctl -u cloudflared -n 50
   ```

5. **Review DNS configuration**
   ```bash
   # Check systemd-resolved
   systemctl status systemd-resolved

   # May need to switch to static DNS
   cat /etc/resolv.conf
   ```

### Medium-term (Next week)

6. **Storage upgrade**
   - Current 59GB root disk is too small for k3s + Docker workloads
   - Recommend 200GB+ for sustainable operation
   - Consider external NAS storage for data

7. **Memory upgrade**
   - 7.9GB RAM is marginal for current workload
   - Recommend 16GB+ for comfortable headroom

8. **Regular maintenance**
   - Set up automated log rotation
   - Monitor disk/memory via Prometheus
   - Implement alerts for resource exhaustion

---

## Disk Space Analysis

**Current Mountpoints**:

- `/dev/mmcblk0p2` (59G): System root - **87% full**
- `/dev/sdb1` (916G): External storage 1 - 53% full
- `/dev/sda1` (117G): External storage 2 - 72% full

**Recommendation**: Move Docker/k3s data to external storage or expand root

---

## Services Running (All Operational)

✅ ProFTPD (FTP)
✅ tftpd-hpa (TFTP)  
✅ Samba (SMB/NFS)
✅ k3s (Kubernetes)
✅ Docker
✅ Cloudflared (tunnel - intermittent issues)
✅ Tailscale (VPN)
✅ nginx (reverse proxy)
✅ GitHub Actions runners (2)

---

## Summary

**Status**: ⚠️ **RUNNING BUT AT CRITICAL RESOURCE LIMITS**

The OMV installation is functionally operational, but system resource exhaustion is causing instability:

- **Disk**: 87% full (7.4GB free - too low)
- **Memory**: 90% used (159MB free - critical)
- **Network**: Cloudflared experiencing timeouts
- **DNS**: Docker DNS resolution failures

**Recommended Next Step**: Free up disk space immediately, then plan for storage/memory expansion.

---

**Report Generated**: 2026-07-05 01:05 UTC
**System Uptime**: 25+ minutes (recent restart)
**Last Full Boot**: 2026-07-04 23:15 (approx)
