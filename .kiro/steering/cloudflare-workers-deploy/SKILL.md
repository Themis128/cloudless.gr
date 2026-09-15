---
name: cloudflare-workers-deploy
description: >
  Diagnose and fix Cloudflare Workers Deploy failures for cloudless.gr —
  especially wrangler Authentication error 10000, missing Workers Scripts Write,
  tunnel soft-skip, and D1 migrations on Free plan. Use when cloudflare-deploy.yml
  fails, cloudless2 proxy deploy is skipped/fails, or the user mentions Workers
  Deploy / pi-origin-proxy / API 10000.
---

# Cloudflare Workers Deploy (Free path)

## Production edge (do not confuse)

```
browser → cloudless.gr → Worker cloudless2 (workers/pi-origin-proxy)
  → pi-origin.cloudless.gr (Tunnel) → k3s cloudless-app on omv
```

- **App code** ships via `deploy-pi.yml` (Pi image), not this workflow.
- **`cloudflare-deploy.yml`**: D1 migrations → tunnel point-at-Pi → deploy `cloudless2` proxy.
- Header `x-served-by: pi-tunnel-proxy` means the proxy path is live.

## Required token scopes (GH secret `CLOUDFLARE_API_TOKEN`)

Must include **all** of:

| Permission | Why |
|------------|-----|
| **Workers Scripts Write** | `wrangler deploy` cloudless2 (missing → API **10000**) |
| **D1 Write** | `wrangler d1 migrations apply` |
| **Workers R2 Storage Write** (+ bucket item) | related deploys / artifacts |
| **Cloudflare Tunnel Write** | `scripts/cf-tunnel-set-pi-origin.py` (else soft-skips with warning) |
| **API Tokens Write** | mint short-lived tunnel token when primary lacks Tunnel Edit |
| Zone Read / DNS Read | verification |

Optional dedicated secret: `CLOUDFLARE_TUNNEL_API_TOKEN` (Tunnel Edit only).

## Diagnose

```bash
# Zone-only smoke can PASS while Workers Write is missing — always run full smoke:
gh workflow run verify-cloudflare-token.yml --ref main
# or locally (needs token in env — ask operator; never read .env.local):
bash scripts/cf-token-smoketest.sh

# List / ensure CI perms (needs API Tokens Write or Global API Key):
bash scripts/cf-token-permissions.sh list
bash scripts/cf-token-permissions.sh ensure-ci "<token-name>"

# From CI (set repo secrets CF_EMAIL + CF_GLOBAL_API_KEY once):
gh workflow run "Ensure Cloudflare CI token scopes" --ref main -f dry_run=true
gh workflow run "Ensure Cloudflare CI token scopes" --ref main -f dry_run=false
```

`ensure-ci` / the workflow add the full CI set including **Workers Scripts Write**.

User API Tokens:Read and Tunnel:Read are **warnings** in the smoketest (non-fatal).
Missing **Workers Scripts Write** is a hard fail when detectable.

## Symptom → fix

| Log | Fix |
|-----|-----|
| `Authentication error [code: 10000]` on `/workers/scripts/cloudless2/versions` | Add **Workers Scripts Write**; re-store token via `store-cloudflare-token.yml` `apply=false` |
| Tunnel `401/403` then mint `9109` | Soft-skip is OK; or set `CLOUDFLARE_TUNNEL_API_TOKEN` / Tunnel Write |
| Deploy step skipped after tunnel fail | Fixed by soft-skip in `cf-tunnel-set-pi-origin.py` — re-run workflow |
| OpenNext size / 3 MiB | Expected on Free — keep pi-origin-proxy only |

## Re-run after token fix

```bash
gh workflow run "Cloudflare Workers Deploy" --ref main
# or empty commit on a path that triggers the workflow (prefer dispatch if available)
```

Confirm:

```bash
curl -sSI https://cloudless.gr/api/health | rg -i 'x-served-by|HTTP/'
```

## Related

- Token mint/store: `cloudflare-token-doctor`, `cloudflare-token-rotation`
- Permissions CLI: `scripts/cf-token-permissions.sh`
- Smoke: `scripts/cf-token-smoketest.sh`
- Workflow: `.github/workflows/cloudflare-deploy.yml`
- Proxy: `workers/pi-origin-proxy/`
