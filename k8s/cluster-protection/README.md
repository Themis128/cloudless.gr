# k3s overload protection

Manifests and patches that keep the omv k3s node alive under load. Born
from the 2026-05-28 overload incident — see
[`docs/cluster-overload-runbook.md`](../../docs/cluster-overload-runbook.md)
for the full RCA.

## What's here

| File | What it does | How to apply |
|---|---|---|
| `limit-ranges.yaml` | Namespace `LimitRange` + `ResourceQuota` for `monitoring` and `cloudless` | `kubectl apply -f limit-ranges.yaml` |
| `monitoring-resources.yaml` | Explicit `resources.{requests,limits}` for Prometheus / Loki / Grafana / Alertmanager / operator + Prometheus retention trim (7d/4GB → 3d/2GB) | `bash apply-monitoring-resources.sh` |
| `apply-monitoring-resources.sh` | Wrapper that applies both manifests and rolls out the workloads | `bash apply-monitoring-resources.sh` |
| `k3s-config-overlay.md` | Patch instructions for `/etc/rancher/k3s/config.yaml` (kubelet eviction + system-reserved) | manual, see file |

## Apply order

1. `k3s-config-overlay.md` first. Without the kubelet eviction tuning, the
   quotas in step 2 still let the host die if a workload squeaks through
   under the limits.
2. `apply-monitoring-resources.sh` second. This is the workload that has
   historically triggered the overload; the resource caps make a recurrence
   recoverable.
3. After both are applied, scale monitoring back up if it's still at 0:

   ```bash
   ssh 192.168.1.128 'kubectl -n monitoring scale \
     statefulset/prometheus-monitoring-prometheus \
     statefulset/loki \
     statefulset/alertmanager-monitoring-alertmanager \
     --replicas=1 && kubectl -n monitoring scale \
     deployment/kube-prom-grafana \
     deployment/monitoring-operator \
     --replicas=1'
   ```

## Not in scope

- Auto-eject of the Pi/k3s SECONDARY from Route 53 when k3s is degraded.
  Currently the SECONDARY health check probes only the APIGW frontend,
  which stays healthy even when k3s is dead. Fixing this needs a
  Route 53 health check path update and is tracked as a follow-up in
  `docs/cluster-overload-runbook.md`.
- Migrating the standalone Keycloak from the `tbaltzakis` user shell into
  the cluster. Also a follow-up.
- Boot SD card cleanup (was 90% during the incident).
