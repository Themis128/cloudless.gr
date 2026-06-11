# /grafana-ops — Grafana operations and dashboard management

Manages Grafana on the k3s cluster: health checks, dashboard listing, datasource verification, and restart.

## Steps

### Default: health + datasource check

1. **Health check** — call `mcp__cloudless-infra__grafana_check_health`. Confirm `{"database":"ok"}` response.

2. **Datasources** — call `mcp__cloudless-infra__grafana_get_datasources`. Confirm:
   - `Prometheus` datasource is present and connected to `http://monitoring-prometheus.monitoring.svc.cluster.local:9090`
   - No datasource reports an error

3. **Dashboards** — call `mcp__cloudless-infra__grafana_list_dashboards`. Print the list of dashboards with their folder and UID.

4. **Firing alerts** — call `mcp__cloudless-infra__grafana_check_alerts`. Report any alerts not in `OK` state.

5. Print summary:

   ```
   Grafana health:   OK / ERROR
   Datasources:      N found, N healthy
   Dashboards:       N total
   Alerts:           N firing / all OK
   ```

### Restart Grafana

If user asks to restart Grafana (e.g., after config change or crash):

1. Call `mcp__cloudless-infra__grafana_restart` — runs `kubectl rollout restart deployment/kube-prom-grafana -n monitoring`.
2. Wait 30 seconds, then call `mcp__cloudless-infra__grafana_check_health` to confirm recovery.
3. Report new pod name and uptime.

### Admin password reset

If Grafana admin password is lost or needs rotation:

1. Fetch current password from SSM: `aws ssm get-parameter --name /cloudless/production/GRAFANA_ADMIN_PASSWORD --with-decryption --output text --query Parameter.Value`
2. To reset via CLI (inside the pod):

   ```
   kubectl exec -n monitoring deployment/kube-prom-grafana -- grafana-cli admin reset-admin-password <new-password>
   ```

3. Update SSM parameter with the new password.
4. Confirm login works with `grafana_check_health`.

## Key Info

| Resource | Value |
|---|---|
| Grafana URL (internal) | `http://kube-prom-grafana.monitoring.svc.cluster.local:80` |
| Grafana URL (external) | `https://grafana.cloudless.gr` |
| Deployment | `kube-prom-grafana` in namespace `monitoring` |
| Admin password SSM | `/cloudless/production/GRAFANA_ADMIN_PASSWORD` |
| Helm chart | `kube-prometheus-stack` (via `kube-prom` release) |

## Notes

- Grafana is exposed externally via `grafana.cloudless.gr` → cloudflared tunnel → k3s Traefik → `kube-prom-grafana` service.
- Authentication is handled by Grafana's built-in auth — admin only.
- Dashboard changes made in the UI are ephemeral unless exported and committed to the Helm values or a ConfigMap.
- Do not exec into the Grafana pod to edit configs directly — use Helm values or the API.
