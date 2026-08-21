---
name: workers-ai
description: Activate, verify, rotate, and troubleshoot the Cloudflare Workers AI integration (/api/admin/ai/generate + /admin/ai-generator). Use when the AI Generator shows "not configured", when rotating CLOUDFLARE_API_TOKEN, when a Workers AI call returns 401/403/502/503, or when the user asks to "enable the AI generator", "check Workers AI", or "rotate the Cloudflare token".
argument-hint: "what's wrong, e.g. 'AI generator not configured', 'rotate token', 'verify workers ai'"
---

# Cloudflare Workers AI — activation, verification, rotation

The admin AI Generator (`/admin/ai-generator`) calls
`POST /api/admin/ai/generate`, which proxies Cloudflare Workers AI. The route
needs two Lambda env vars, forwarded by `sst.config.ts` from the deploy
workflow: `CLOUDFLARE_ACCOUNT_ID` (inline in `deploy.yml`,
`fb7dc7b69b662480cd5961a4d1913c78`) and `CLOUDFLARE_API_TOKEN` (repo secret).

## Tools

| Tool | What it does |
| --- | --- |
| `scripts/workers-ai-doctor.sh` | Full chain check: token validity + Workers AI scope (real 1-token inference), Lambda env wiring, live auth gate. Each check skips gracefully without its credential. |
| `.github/workflows/workers-ai-verify.yml` | Runs the doctor on a hosted runner **with the repo secret** (the only way to test a secret a session can't read) and posts the result to issue #382. Trigger via `gh workflow run workers-ai-verify.yml` or by editing the doctor script. |

## Activate (one-time)

1. Token: dash.cloudflare.com → Profile → API Tokens → Create Token → Custom →
   permissions **Account → Workers AI → Read + Run** (an existing token can be
   edited to add the scope instead).
2. `gh secret set CLOUDFLARE_API_TOKEN` (paste when prompted).
3. `gh workflow run deploy.yml` — the deploy injects it into the Lambda env.
4. `gh workflow run workers-ai-verify.yml` — confirm ✅ on issue #382.

## Rotate

Same as activation steps 1–3 with a fresh token; revoke the old one in the
dashboard afterwards. The route reads the env per-invocation, so rotation
needs a redeploy (Lambda env is deploy-time).

## Troubleshooting

| Symptom | Meaning | Fix |
| --- | --- | --- |
| UI shows "not configured" / route 503 | Lambda env vars missing | Set secret → `gh workflow run deploy.yml` |
| Route 401/403 | Caller isn't an admin | Sign in with a Cognito `admin`-group user |
| Route 502 `Cloudflare API error` | Upstream rejected the call | Run `workers-ai-verify.yml`; if scope MISSING, edit the token to add Workers AI Read+Run |
| Doctor: "token: INVALID" | Token revoked/expired | Create a new token, rotate |
| Doctor: "route NOT deployed (404)" | deploy.yml hasn't shipped the route | Wait for/trigger deploy |
| 429 | Shared `/api/admin/*` rate limit (90/min/IP, proxy.ts) | Back off |

## Cost

Workers AI free tier ≈ 10,000 neurons/day; Llama-3-8B costs fractions of a
neuron per short generation. Pricing:
https://developers.cloudflare.com/workers-ai/platform/pricing/

## Known issue (infra)

The cloudless-infra MCP's master Cloudflare credential is **invalid** —
`cloudflare_create_token` / `cloudflare_list_permission_groups` fail with
"Invalid access token", so tokens cannot be minted programmatically. To
restore that, put a token with **User API Tokens: Edit** into the MCP server's
`CLOUDFLARE_API_TOKEN` env. (The zone-scoped `CLOUDFLARE_GR_API_TOKEN` used by
the DNS tools is fine and unrelated.)
