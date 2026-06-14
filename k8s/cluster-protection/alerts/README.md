# Repo-tracked PrometheusRules

This directory holds repo-tracked PrometheusRules that overlay or replace the
`kube-prometheus-stack` defaults for the omv 2-Pi cluster.

## Files

| File | Purpose |
|---|---|
| `cluster-alerts.yaml` | Cluster-wide event scanner CronJob — posts Crash-loop / OOM / Evicted events to Slack `#errors` every 5 min. |
| `pod-health.yaml` | Pod readiness / CPU / memory / restart alerts. The `PodRestartingFrequently` rule uses `increase(kube_pod_container_status_restarts_total[1h]) >= 5` — replacing the broken `>= 20` cumulative-counter rule that fired forever on any pod that had ever crashed. |
| `disk-pressure.yaml` | Node disk-pressure alerts. Excludes the user-data SMB mount (`/srv/dev-disk-*`) where Windows backups live — that mount sits at 80-89% by design, and k3s no longer lives there (post-2026-06-13 migration; see CLAUDE.md). |

## Apply

```bash
sudo k3s kubectl apply -f k8s/cluster-protection/alerts/pod-health.yaml
sudo k3s kubectl apply -f k8s/cluster-protection/alerts/disk-pressure.yaml
sudo k3s kubectl apply -f k8s/cluster-protection/alerts/cluster-alerts.yaml
```

## After applying

Cumulative restart counters on pods that were noisy before the migration won't
clear from these rule changes alone — the counter is stored on the pod object.
Rolling-restart the affected pods to reset counters to zero:

```bash
# Find pods with cumulative restartCount > 20
sudo k3s kubectl get pods -A -o json | python3 -c '
import sys,json; d=json.load(sys.stdin)
for p in d["items"]:
    n = sum(c.get("restartCount",0) for c in p["status"].get("containerStatuses",[]))
    if n > 20:
        print(f"{p[\"metadata\"][\"namespace\"]}/{p[\"metadata\"][\"name\"]}: {n}")
'

# Delete each (pod gets recreated; counter starts at 0)
sudo k3s kubectl -n <ns> delete pod <pod-name>
```

This was done on 2026-06-14 for: prometheus-monitoring-prometheus-0,
kube-prom-kube-state-metrics, monitoring-operator, cert-manager,
cert-manager-cainjector.

## Why these aren't in upstream chart values

The kube-prometheus-stack chart-managed rules live in the `monitoring-*`
PrometheusRule resources. The files here either **add** new rules
(`cluster-alerts.yaml` CronJob — not a PrometheusRule but lives here for
operational grouping), or **replace** rules where the upstream version
misfires on Pi-class hardware (`pod-health.yaml`, `disk-pressure.yaml`).
These survive helm upgrades because they share the rule's name.
