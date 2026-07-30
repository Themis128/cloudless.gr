# /cloudflare-lb — provision Cloudflare HA load balancer for cloudless.gr

Wires the Cloudflare Health-checked Load Balancer that steers traffic
AWS CloudFront (primary) → Pi/k3s (secondary) for cloudless.gr and www.cloudless.gr.
Works from a cloud session with no direct Cloudflare or AWS access.

## What this command does

1. Checks current LB state (report run) via issue #382.
2. Asks the user for a Cloudflare API token if not already in the GitHub Secret.
3. Dispatches `store-cloudflare-token.yml` via `mcp__github__actions_run_trigger`
   with the token — stores as GitHub Secret `CLOUDFLARE_API_TOKEN` and applies
   the LB in one shot (requires repo secret `GH_PAT`).
4. Monitors the result via issue #382.

## Steps

### Step 1 — Check current state

Call `mcp__github__actions_run_trigger` to dispatch `cloudflare-lb.yml` with:

```json
{
  "owner": "themis128",
  "repo": "cloudless.gr",
  "workflow_id": "cloudflare-lb.yml",
  "ref": "main",
  "inputs": { "apply": "false" }
}
```

Check issue #382 for the result. If the LB is already provisioned and healthy, stop here.

If the output says `BLOCKED: no CLOUDFLARE_API_TOKEN`, continue to step 2.

### Step 2 — Create the Cloudflare API token

Ask the user:

> "Please go to **Cloudflare dashboard → My Profile → API Tokens → Create Token →
> Create custom token** with these permissions:
>
> | Permission | Scope |
> |---|---|
> | Zone → Zone → **Read** | cloudless.gr |
> | Zone → Load Balancing: Monitors and Pools → **Edit** | cloudless.gr |
> | Zone → Load Balancing: Load Balancers → **Edit** | cloudless.gr |
> | Zone → DNS → **Edit** | cloudless.gr |
>
> Zone Resources: Include → Specific zone → cloudless.gr
>
> Copy the token value — it is shown only once."

Wait for the user to provide the token value.

### Step 3 — Store token + apply LB

Once you have the token, call `mcp__github__actions_run_trigger` with:

```json
{
  "owner": "themis128",
  "repo": "cloudless.gr",
  "workflow_id": "store-cloudflare-token.yml",
  "ref": "main",
  "inputs": {
    "cloudflare_token": "<token from user>",
    "apply": "true"
  }
}
```

The workflow:

- Masks the token immediately (will NOT appear in logs)
- Writes it as GitHub Actions secret `CLOUDFLARE_API_TOKEN` (via `gh secret set`; requires `GH_PAT`)
- Runs `scripts/setup-cloudflare-lb.sh` in apply mode with the token from the workflow input
- Creates health monitors, origin pools (AWS + Pi), load balancers, DNS records
- Posts the full result to issue #382

### Step 4 — Verify

Check issue #382 for the latest comment. Look for:

- `pool cl-aws-cloudless.gr: HEALTHY` and `pool cl-pi-cloudless.gr: HEALTHY`
- `LB cloudless.gr: UP` and `LB www.cloudless.gr: UP`
- `DNS cloudless.gr → <lb-cname>: done`

If any pool is unhealthy, check the health monitor URL (`https://cloudless.gr/api/health`
and `https://pi-origin.cloudless.gr/api/health`) — both must return HTTP 200.

## Architecture

```
cloudless.gr / www.cloudless.gr
        │
        ▼
 Cloudflare LB  (steering_policy: "off" — first healthy pool wins)
        │
        ├─► [PRIMARY]  cl-aws-*   →  CloudFront (d3k7muo3c6lw6s / dgrxxatzrgxfi)
        │                              health: GET https://cloudless.gr/api/health → 200
        │
        └─► [FALLBACK] cl-pi-*    →  omv.tail8eb71.ts.net (Tailscale Funnel)
                                       health: GET https://cloudless.gr/api/health → 200
```

Steady state: **all traffic goes to AWS**. Pi is on standby. Cloudflare flips to Pi
automatically when the AWS health check fails (typically within 60s).

## Key secret

| Secret | Where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret (CI source of truth) |
| `GH_PAT` | Repo secret — PAT with `repo` scope so store/rotate workflows can `gh secret set` |

## Notes

- The `store-cloudflare-token.yml` workflow is idempotent — re-running with the
  same token is safe.
- Do **not** store this token with `aws ssm put-parameter` — GitHub Secrets only.
- LB provisioning requires the **Load Balancing** add-on to be enabled on the
  Cloudflare account (it is already active for cloudless.gr).
- Health monitors use a 60s interval with 2 consecutive failures before failover.
