# /ha-failover — Manually trigger or verify CloudFront HA failover

Guides through a manual HA failover test or recovery for cloudless.gr.
Primary origin: AWS Lambda (SST). Secondary origin: k3s via Tailscale Funnel (`omv.tail8eb71.ts.net:443`).

## Failover Architecture

```
User → CloudFront
         ├── Primary:   Lambda@Edge (placeholder.sst.dev) — 200 normally
         └── Secondary: k3s via omv.tail8eb71.ts.net:443
                        └── Traefik VIP 192.168.1.200:18443
                            └── cloudless-app pods (namespace: cloudless)
```

CloudFront triggers failover on: `502`, `503`, `504` from primary.

## Steps

### A. Pre-flight check (always run first)

1. Call `mcp__cloudless-infra__ha_check_cloudfront_failover` — confirm secondary origin is healthy before simulating failure.
2. Call `mcp__cloudless-infra__ha_test_k3s_origin` — confirm k3s is serving 5/5.
3. If either is unhealthy, **stop and fix the secondary first** — do not test failover with a broken secondary.

### B. Simulate failover (for testing)

This requires temporarily breaking the Lambda origin. **Do not do this in production without user confirmation.**

Ask: "This will cause ~30s of downtime while CloudFront switches origins. Confirm? (yes/no)"

If confirmed:
1. Note the current CloudFront distribution ID from `ha_check_cloudfront_failover` output.
2. Use `mcp__AWS_API_MCP_Server__call_aws` to temporarily disable the primary origin's health check or update its domain to a broken endpoint.
3. Wait 60 seconds for CloudFront health check TTL.
4. Run `curl -sI https://cloudless.gr | head -5` via `cluster_run_command` on `omv-main` — verify `X-Cache: Miss from cloudfront` or `Age: 0` and that the response is served by k3s (check for `server: traefik` header).
5. Restore the primary origin immediately after verification.

### C. Manual failover (production incident)

If Lambda is genuinely down and CloudFront has NOT automatically failed over:

1. Check CloudFront logs: `mcp__cloudless-infra__aws_get_lambda_logs` for error patterns.
2. If primary origin is returning 5xx: CloudFront should auto-failover within 30s (health check interval = 30s, threshold = 3 failures).
3. If auto-failover did not trigger, check the origin group failover criteria:
   ```
   aws cloudfront get-distribution --id <DIST_ID> --query 'Distribution.DistributionConfig.Origins'
   ```
4. To force traffic to k3s: update the origin group to remove the primary and use only the secondary via `mcp__AWS_API_MCP_Server__call_aws`.

### D. Recovery (restore primary)

1. Confirm Lambda is healthy: check `mcp__cloudless-infra__aws_get_lambda_logs` for no recent errors.
2. Re-enable the primary origin in the CloudFront origin group if it was disabled.
3. Run `mcp__cloudless-infra__ha_check_cloudfront_failover` — confirm primary is healthy again.
4. Wait 1 minute, then verify `cloudless.gr` responds with Lambda headers (not Traefik).

## Key IDs and Endpoints

| Resource | Value |
|---|---|
| CloudFront dist | see SSM `/cloudless/production/CLOUDFRONT_DISTRIBUTION_ID` |
| Secondary origin | `omv.tail8eb71.ts.net` |
| k3s VIP | `192.168.1.200:18443` |
| cloudflared tunnel | `a82f24a8-f767-4a59-bc77-1d59ad132be2` |
| Route 53 zone | `Z079608614L53CC4EAZM3` |

## Notes

- CloudFront health check interval is 30s; failover is not instant.
- The k3s secondary serves the **same** Next.js app built from the same Docker image — zero config difference.
- TLS on k3s: Traefik serves the `cloudless.gr` wildcard cert (k8s secret `cloudless-gr-tls` in namespace `cloudless`).
- After any failover test, always run `/ha-status` to confirm full stack health.
