---
name: analytics-stack
description: Diagnose and recover the analytics namespace on the omv k3s cluster — Metabase, DuckDB API, Grafana, Loki, Alertmanager. Use when Metabase is down/OOMKilled, DuckDB API is crashing, Grafana is unreachable, analytics dashboards return errors, or the user says "fix analytics", "Metabase is down", "DuckDB crash", "Grafana 503", "charts broken". Covers both kubectl-based recovery (via analytics-restore.yml) and monitoring-stack triage.
---

# Analytics Stack — cloudless.gr (omv k3s)

The analytics namespace on the omv k3s cluster runs two services: **Metabase** (BI dashboards / admin analytics) and **DuckDB API** (query engine). Monitoring lives in the **monitoring** namespace: **Prometheus**, **Grafana**, **Alertmanager**, **Loki**.

## Service Map

| Service | Namespace | Deploy/SS | Memory limit | OOM risk |
|---|---|---|---|---|
| Metabase | analytics | `metabase` | 400Mi (restore: 600Mi) | **HIGH** — JVM with `-Xmx320m` |
| DuckDB API | analytics | `duckdb-api` | 1500Mi | Low (Go/DuckDB) |
| Grafana | monitoring | `kube-prom-grafana` | 256Mi | Low |
| Alertmanager | monitoring | `monitoring-alertmanager` | 128Mi | Low |
| Loki | monitoring | `loki` (StatefulSet) | 400Mi | Medium |
| Prometheus | monitoring | `prometheus-monitoring-prometheus-0` | 700Mi (StatefulSet) | Low |

## Recovery Workflows

| Symptom | Tool |
|---|---|
| Metabase OOMKilled / CrashLoopBackOff | `analytics-restore.yml` |
| DuckDB API high restarts / OOMKilled | `analytics-restore.yml` |
| ntfy Error / CrashLoopBackOff | `ntfy-restore.yml` |
| Grafana unreachable (HTTP 503) | Cluster doctor to check; Grafana pod restart via `kubectl -n monitoring rollout restart deploy/kube-prom-grafana` wrapped in a remediate workflow |
| Prometheus rule failures | `prometheus-tune.yml` |

**Trigger analytics-restore**: edit `.github/workflows/analytics-restore.yml` → PR → squash-merge. The workflow runs on `ubuntu-latest` via Tailscale + `KUBECONFIG_B64`, posts result to **issue #382**.

## Metabase Memory Sizing

Metabase (JVM) is the most likely OOM victim in the analytics namespace.

| Limit | `-Xmx` | Status |
|---|---|---|
| 400Mi | 320m | Original — tight, can OOMKill on heavy queries |
| 600Mi | 480m | `analytics-restore.sh` default — fits comfortably |
| 1Gi | 800m | Maximum if the node can afford it |

**Rule: never set Metabase container limit below `-Xmx` + 128Mi.**

The `memory-relief-2026-05-31.yaml` manifest caps Metabase at 400Mi. If you're seeing OOMKills, run `analytics-restore.yml` which patches to 600Mi automatically. Update the manifest to match after the fix sticks.

## Checking Analytics Health

Run the cluster doctor (touch `scripts/cluster-doctor.sh` → PR → merge) — the doctor now covers Tier 4 Analytics sections: Metabase pods, DuckDB API pods, and their resource limits.

Quick manual checks (run from a Tailscale-connected host with kubectl):

```bash
# Pod health
kubectl -n analytics get pods -o wide

# Metabase restart count
kubectl -n analytics get pods -l app=metabase -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}'

# Metabase logs
kubectl -n analytics logs deploy/metabase --tail=40

# DuckDB API logs
kubectl -n analytics logs deploy/duckdb-api --tail=20
```

## Grafana

Grafana lives in the `monitoring` namespace. The HTTP endpoint `https://grafana.cloudless.gr/api/health` returns `{"database":"ok"}` when healthy (HTTP 200).

If Grafana is unreachable:

1. Check if the pod is running: `kubectl -n monitoring get pods -l app.kubernetes.io/name=grafana`
2. Check restarts / OOM: `kubectl -n monitoring describe pod -l app.kubernetes.io/name=grafana`
3. Restart: `kubectl -n monitoring rollout restart deploy/kube-prom-grafana`
4. Grafana limit is 256Mi — if OOMKilling, patch to 384Mi (patch the deployment memory limit)

## Loki

Loki (log aggregation) is a StatefulSet in `monitoring`. It ingests logs from promtail running on both Pi nodes.

- **OOM risk**: Medium — Loki limit is 400Mi. If it OOMKills, log ingestion stops but metrics/alerting continue.
- **Recovery**: `kubectl -n monitoring rollout restart statefulset/loki`
- **Disk**: Loki stores chunks on a PVC; check with `kubectl -n monitoring get pvc`

## ntfy

ntfy (push notification server) is in the `ntfy` namespace with a 96Mi limit. It's been observed in Error state with 34+ restarts (2026-06-01 snapshot).

**Recovery**: trigger `ntfy-restore.yml` — patches to 128Mi if OOMKilled, restarts, posts to #382.

## Troubleshooting

### Metabase shows `(no log)` or is unreachable in Grafana dashboards

1. Run cluster doctor to get pod state
2. If OOMKilled: trigger `analytics-restore.yml` (touch the file → PR → merge)
3. After restore, check Metabase is Running before using dashboards

### DuckDB API returns 503 or query timeouts

1. `kubectl -n analytics logs deploy/duckdb-api --tail=40` — look for OOM or Go panic
2. If OOMKilled: trigger `analytics-restore.yml` (restarts DuckDB API)
3. If query timeout: check if a large analytics job is running (`kubectl -n analytics get pods`)

### Grafana shows no data / datasource error

Usually means Prometheus is not reachable from Grafana. Check:

1. Prometheus pod is Running: `kubectl -n monitoring get pods -l app.kubernetes.io/name=prometheus`
2. Prometheus rules health: cluster doctor Tier 3 section
3. If `PrometheusRuleFailures` is firing: trigger `prometheus-tune.yml`

### ntfy push notifications stopped arriving

1. Check ntfy pod: `kubectl -n ntfy get pods`
2. If in Error/CrashLoopBackOff: trigger `ntfy-restore.yml`
3. Check ntfy logs: `kubectl -n ntfy logs deploy/ntfy --tail=40`
