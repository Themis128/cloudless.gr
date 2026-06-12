> **HISTORICAL — 2026-06-02.** This document describes the app architecture when auth was provided by an external OIDC provider. Auth migrated to Cognito on 2026-06-08 (PR #677). Code paths described here for `/api/auth/[...nextauth]` are still valid; only the OIDC provider changed.

# Cluster Overload Runbook

When the omv k3s node enters a crash-restart loop driven by memory pressure
and/or disk-I/O saturation. Captured from the incident on 2026-05-28 so the
recovery path is repeatable.

## When to use this

- `kubectl` against the omv apiserver returns intermittent
  `TLS handshake timeout` / `connection refused`.
- `systemctl status k3s` shows `NRestarts` climbing into double digits.
- `journalctl -u k3s` contains repeated
  `level=fatal msg="leaderelection lost for k3s-etcd"` or
  `"leaderelection lost for k3s"`.
- Load average ≫ number of cores; `vmstat` shows `wa` > 15%.
- `cloudless.gr` is still up (Lambda primary) but
  `/ha-status` reports the SECONDARY (Pi) origin as unhealthy.

## What is actually broken

A compound memory/IO failure. The trigger is usually one of:

1. A non-k8s process on the host runs away (e.g. an orphaned process in a
   user shell, an `aws s3 sync` cron without limits).
2. A monitoring-namespace pod (Prometheus, Loki, Grafana, Alertmanager) hits
   its working set and starts swapping.
3. A burst of cronjob creates many short-lived pods, each forcing etcd
   writes.

Any of those pushes the 8 GiB host into swap. Once swap is in use, `fsync`
latency on the data SSD climbs from a few ms to ~300–500ms. etcd needs
sub-100ms writes to keep its single-node lease alive; at 300ms it misses
renewals and crashes. systemd `Restart=always` brings k3s back, which
re-replays the WAL, which adds more IO load, which keeps the host loaded.
The loop sustains itself even after the original trigger is gone.

## Site impact

**None for end users.** Route 53 failover serves `cloudless.gr` from
CloudFront → Lambda (PRIMARY) by default. The Pi/k3s path is SECONDARY and
only takes traffic when the PRIMARY health check fails. So this is a
*standby capacity* incident, not a customer-facing outage — but if PRIMARY
also has an incident in this window, there is no failover target.

## Recovery (in order)

### 1. Confirm the diagnosis

```bash
ssh 192.168.1.128 'uptime && free -h && systemctl show k3s -p NRestarts'
ssh 192.168.1.128 'sudo journalctl -u k3s --since "5 min ago" --no-pager \
  | grep "apply request took too long" | wc -l'
```

Expect: load ≫ 10, swap > 1 GiB used, NRestarts ≥ 10, slow-write count > 0.

### 2. Identify the trigger

```bash
ssh 192.168.1.128 'ps -eo pid,pcpu,pmem,rss,user,args --sort=-rss | head -20'
ssh 192.168.1.128 'systemd-cgtop -m -n 1 --depth=3 | head -25'
```

Look for:

- Non-k8s processes ≥ 200 MiB RSS (especially in `user.slice`).
- `kubepods.slice` ≥ 4.5 GiB total.
- Anything in `tbaltzakis` shell sessions that isn't VSCode Server.

### 3. Stop the trigger

For user-session bloat, kill the process directly:

```bash
ssh 192.168.1.128 'pkill -f "aws s3 sync"'
```

For monitoring-namespace bloat, scale to 0 via kubectl (use long timeouts
because the apiserver is flapping):

```bash
ssh 192.168.1.128 'for t in \
  statefulset/prometheus-monitoring-prometheus \
  statefulset/loki \
  statefulset/alertmanager-monitoring-alertmanager \
  deployment/kube-prom-grafana \
  deployment/monitoring-operator; do
  for try in 1 2 3 4 5; do
    kubectl --request-timeout=120s -n monitoring scale "$t" --replicas=0 \
      && break || sleep 8
  done
done'
```

### 4. Wait for swap to drain

No active step. Watch:

```bash
ssh 192.168.1.128 'vmstat 5 3'
```

`wa` should fall below 10% within 5 minutes. `si`/`so` (swap in/out) should
trend toward 0. Load average 1-min should drop into single digits.

### 5. Verify recovery

```bash
ssh 192.168.1.128 'curl -sk --max-time 5 -o /dev/null -w "apiserver:%{http_code}\n" \
  https://127.0.0.1:6443/livez'
# expect: apiserver:200 or apiserver:401 (both = up)

ssh 192.168.1.128 'sudo journalctl -u k3s --since "1 min ago" --no-pager \
  | grep "apply request took too long" | wc -l'
# expect: 0
```

If both clear, the cluster is stable. The k3s `NRestarts` counter does not
reset until reboot — its absolute value after recovery does not matter, only
that it stops climbing.

### 6. Restore monitoring (after the host is stable for ≥ 10 min)

```bash
ssh 192.168.1.128 'kubectl -n monitoring scale statefulset/prometheus-monitoring-prometheus --replicas=1
kubectl -n monitoring scale statefulset/loki --replicas=1
kubectl -n monitoring scale statefulset/alertmanager-monitoring-alertmanager --replicas=1
kubectl -n monitoring scale deployment/kube-prom-grafana --replicas=1
kubectl -n monitoring scale deployment/monitoring-operator --replicas=1'
```

**Do not skip step 6.** Leaving monitoring at 0 means the next incident has
no telemetry.

## What if recovery doesn't stick?

Symptom: load returns to normal briefly, then climbs again within minutes.

Most likely cause: a workload is creating pods/jobs/events faster than etcd
can persist them. Look at `kubectl get events --sort-by=.lastTimestamp -A`
for hot cronjobs (`health-monitor`, `ml-anomaly-detect`, `auto-healer` have
all been suspects historically). Suspend the noisiest cronjob:

```bash
kubectl -n <ns> patch cronjob/<name> -p '{"spec":{"suspend":true}}'
```

## Prevention

Permanent fixes live in this PR / branch:

- **`k8s/cluster-protection/k3s-config-overlay.md`** — kubelet eviction and
  system-reserved tuning so the kernel doesn't get to swap-storm before pods
  start being evicted.
- **`k8s/cluster-protection/limit-ranges.yaml`** — namespace-level LimitRange
  - ResourceQuota so a single namespace can't take the box hostage.
- **`k8s/cluster-protection/monitoring-resources.yaml`** — explicit
  `resources.limits` on every monitoring-stack pod, with Prometheus
  retention reduced from 7d/4 GB to 3d/2 GB.

## Follow-ups (not in this PR)

- The Route 53 SECONDARY health check (`30a69f1c-8d48-49bd-9067-cabec979478b`)
  probes the APIGW frontend, not the upstream Pi. A broken k3s does not trip
  it. It should be re-pointed at a path that exercises the upstream (e.g.
  `/api/health` proxied through the Lambda), so Route 53 stops sending
  failover traffic to a degraded SECONDARY.
- The `tbaltzakis` user shell may have ad-hoc `aws s3 sync` jobs. These
  should move into the cluster as CronJobs with `resources.limits`, or be
  removed entirely.
- The omv boot SD card (`/`) was at 90% during this incident. Cleanup is a
  separate task.
