---
name: cloudflare-lb
description: Provision and manage the Cloudflare HA load balancer for cloudless.gr. Use when the Cloudflare LB is not provisioned, DNS failover is broken, the Pi standby is not receiving traffic during AWS outage, the user asks to "set up Cloudflare LB", "wire HA failover", "Cloudflare token", "DNS failover", or after CLOUDFLARE_API_TOKEN is available. Covers token storage, LB provisioning, pool health, and DNS cutover. For the fastest cloud-session path, invoke /cloudflare-lb.
---

# Cloudflare HA Load Balancer — cloudless.gr

The Cloudflare Load Balancer provides automatic failover between AWS CloudFront (primary)
and the Pi/k3s standby (secondary) for `cloudless.gr` and `www.cloudless.gr`. The domain
is managed by Cloudflare NS (`fay.ns.cloudflare.com`, `jihoon.ns.cloudflare.com`) — NOT
Route 53. All DNS changes go through Cloudflare.

## Architecture

```
cloudless.gr / www.cloudless.gr
        │
        ▼
 Cloudflare Load Balancer  (steering: first-healthy pool)
        │
        ├─► [PRIMARY]   cl-aws-cloudless.gr    CloudFront d3k7muo3c6lw6s.cloudfront.net
        │               cl-aws-www.cloudless.gr CloudFront dgrxxatzrgxfi.cloudfront.net
        │               health: GET https://cloudless.gr/api/health → 200, interval=60s
        │
        └─► [FALLBACK]  cl-pi-cloudless.gr     omv.tail8eb71.ts.net (Tailscale Funnel)
                        cl-pi-www.cloudless.gr  same
                        health: GET https://cloudless.gr/api/health → 200, interval=60s
```

Steady state: **all traffic goes to AWS**. Pi is hot standby. Cloudflare triggers
failover automatically when the AWS health check fails 2× in a row (~2 min latency).

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `store-cloudflare-token.yml` | `workflow_dispatch` | Accepts token as input → masks → GitHub Secret → optional apply LB |
| `cloudflare-lb.yml` | `push` (path) or `dispatch` | report-only by default, apply on `apply=true` dispatch |
| `apply-cloudflare-lb.yml` | `push` (path) or `dispatch` | always apply mode |

## Token requirements

The Cloudflare API token must have:

| Permission | Type |
|---|---|
| Zone → Zone → **Read** | cloudless.gr zone |
| Zone → Load Balancing: Monitors and Pools → **Edit** | cloudless.gr zone |
| Zone → Load Balancing: Load Balancers → **Edit** | cloudless.gr zone |
| Zone → DNS → **Edit** | cloudless.gr zone |

Zone Resources: Include → Specific zone → cloudless.gr

## Token storage

| Location | Value |
|---|---|
| GitHub Secret | `CLOUDFLARE_API_TOKEN` (**source of truth** for CI) |

Store via `store-cloudflare-token.yml` (requires repo secret `GH_PAT` with
`repo` scope so the workflow can `gh secret set`). Do **not** use
`aws ssm put-parameter` for this token.

## Setup flow (cloud session — no GitHub UI needed)

### 1. Create the Cloudflare API token

Cloudflare dashboard → My Profile → API Tokens → Create Token → Create custom token.
Set the permissions above, Zone Resources = Specific zone = cloudless.gr. Copy the token value.

### 2. Store token + apply LB (one step)

Use `mcp__github__actions_run_trigger`:

```json
{
  "owner": "themis128",
  "repo": "cloudless.gr",
  "workflow_id": "store-cloudflare-token.yml",
  "ref": "main",
  "inputs": {
    "cloudflare_token": "<paste token>",
    "apply": "true"
  }
}
```

Alternatively, run the `/cloudflare-lb` slash command which handles steps 1 and 2 interactively.

### 3. Verify result

Read latest comment on issue #382. Healthy output:

```
pool cl-aws-cloudless.gr: HEALTHY
pool cl-pi-cloudless.gr:  HEALTHY
LB cloudless.gr:           UP → cloudflare-lb-xxxxxxxx.cloudflare.com
DNS cloudless.gr:          CNAME → LB: done
```

## Troubleshooting

### `BLOCKED: no CLOUDFLARE_API_TOKEN`

The token is not in GitHub Secrets (or not passed as env to the script).
Run the `/cloudflare-lb` command or dispatch `store-cloudflare-token.yml`
with the token.

### Pool is UNHEALTHY

Check that both health endpoints return HTTP 200:

- `curl -o /dev/null -w '%{http_code}' https://cloudless.gr/api/health`
- `curl -o /dev/null -w '%{http_code}' https://pi-origin.cloudless.gr/api/health`

If the Pi endpoint fails, check the k3s cloudless deployment and Tailscale Funnel.

### DNS not pointing to LB after apply

The `apply-cloudflare-lb.sh` script patches the DNS record from the existing
`A`/`CNAME` to the LB hostname. If it failed mid-run, re-dispatch with `apply=true`
(the script is idempotent).

### Token lacks Load Balancing permissions

The error message `code 10000` or `403 Forbidden` from the Cloudflare API means the
token was created without the Load Balancing scopes. Delete and recreate the token
with the full permission set listed above.

### LB add-on not enabled

Cloudflare Load Balancing is a paid feature that must be enabled per zone.
Cloudflare dashboard → cloudless.gr zone → Traffic → Load Balancing → Enable.

## Re-apply (update pools, change origins)

Edit `scripts/setup-cloudflare-lb.sh` and trigger `cloudflare-lb.yml` with `apply=true`,
or dispatch `apply-cloudflare-lb.yml`. Both are idempotent — existing resources are
updated in place.

## Manual failover test

To force traffic to the Pi standby for testing:

1. Cloudflare dashboard → cloudless.gr → Traffic → Load Balancing → edit the LB
2. Temporarily move `cl-aws-cloudless.gr` pool to "disabled" — all traffic routes to Pi
3. Re-enable to restore

Do NOT delete the health monitors or pools — re-creating them requires another apply run.
