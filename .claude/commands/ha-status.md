# /ha-status — Full HA stack health check

Runs a comprehensive health check across the entire HA stack: CloudFront origin group, k3s cluster, Tailscale Funnel, cloudflared tunnel, and all monitored subdomains.

## Steps

1. **CloudFront layer** — call `mcp__cloudless-infra__ha_check_cloudfront_failover` to verify the origin group, primary (Lambda) health check, and secondary (Tailscale Funnel) origin are all healthy. Report status and failover readiness.

2. **k3s cluster** — call `mcp__cloudless-infra__k3s_get_cluster_status` for node status, then `mcp__cloudless-infra__k3s_check_ha` for the HA-specific readiness check.

3. **k3s origin reachability** — call `mcp__cloudless-infra__ha_test_k3s_origin` to send 5 HTTPS requests to `omv.tail8eb71.ts.net` and confirm 5/5 pass.

4. **Cloudflare tunnel** — call `mcp__cloudless-infra__cloudflare_tunnel_status` to confirm the `cloudless.gr` tunnel (`a82f24a8-f767-4a59-bc77-1d59ad132be2`) is healthy with active connections.

5. **Monitoring stack** — call `mcp__cloudless-infra__cluster_run_command` on `omv-main`:
   ```
   kubectl get pods -n monitoring --no-headers | awk '{print $1, $3}'
   ```
   Confirm all pods are `Running`.

6. **Subdomain reachability** — for each of the following, run a curl HEAD check via `cluster_run_command` and confirm HTTP 200/301/302:
   - `cloudless.gr`
   - `auth.cloudless.gr`
   - `grafana.cloudless.gr`
   - `manage.cloudless.gr`

7. Print a summary table:
   ```
   Layer              Status
   ─────────────────────────────
   CloudFront         ✓ / ✗
   k3s cluster        ✓ / ✗
   Tailscale origin   ✓ / ✗
   CF tunnel          ✓ / ✗
   Monitoring         ✓ / ✗
   Subdomains         ✓ N/N reachable
   ```

## Notes

- If any layer is red, suggest the relevant remediation command (`/ha-failover`, `/k3s-e2e-rerun`, or `cloudflare_restart_tunnel`).
- Do not make any changes — this command is read-only.
