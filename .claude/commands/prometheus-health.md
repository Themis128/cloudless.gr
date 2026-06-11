# /prometheus-health — Prometheus monitoring stack health check

Checks Prometheus targets, firing alerts, and scrape health for the cloudless.gr k3s cluster.

## Steps

1. **Pod health** — call `mcp__cloudless-infra__cluster_run_command` on `omv-main`:

   ```
   kubectl get pods -n monitoring --no-headers
   ```

   Confirm all pods are `Running`. Flag any pod in `CrashLoopBackOff`, `Pending`, or `Error`.

2. **Active targets** — call `mcp__cloudless-infra__prometheus_check_targets`.
   Report:
   - Total active targets
   - Any target with `health: "down"` — print its job, instance, and last error
   - Any target with scrape duration > 10s

3. **Firing alerts** — call `mcp__cloudless-infra__prometheus_check_alerts`.
   For each firing alert, print: name, severity, summary, duration firing.
   Group by severity (critical → warning → info).

4. **Custom queries** — run these via `mcp__cloudless-infra__prometheus_query`:
   - Pod restart rate (last 1h): `sum(increase(kube_pod_container_status_restarts_total[1h])) by (pod, namespace)`
   - Memory pressure: `(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`
   - Disk usage: `(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100`

5. **Alerting rules** — call `mcp__cloudless-infra__prometheus_check_rules`. Report any rule in error state.

6. Print summary:

   ```
   Prometheus targets:  N active, N down
   Firing alerts:       N critical, N warning, N info
   Pod restarts (1h):   N
   Memory free:         N%
   Disk used:           N%
   ```

## Common Issues and Fixes

| Issue | Fix |
|---|---|
| Target `cloudless-app` down | Check `kubectl get pods -n cloudless` — restart if needed |
| Grafana pod crash | `kubectl rollout restart deployment/kube-prom-grafana -n monitoring` |
| Prometheus OOM | Check `node_memory_MemAvailable_bytes`; reduce retention if needed |
| Scrape timeout | Increase `scrapeTimeout` in ServiceMonitor or fix slow endpoint |

## Notes

- Prometheus runs at `http://monitoring-prometheus.monitoring.svc.cluster.local:9090` (cluster-internal).
- All queries are executed via SSH curl from `omv-main`.
- Retention: 15 days (default kube-prometheus-stack setting).
- Do not modify Prometheus config directly — use `values.yaml` and `helm upgrade`.
