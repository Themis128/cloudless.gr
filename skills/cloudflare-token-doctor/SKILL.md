---
name: cloudflare-token-doctor
description: |
  Diagnose and fix an invalid, expired, or under-scoped Cloudflare API token.
  Use whenever the infra MCP returns "Invalid access token" from any
  `mcp__cloudless-infra__cloudflare_*` tool, when Dependabot or a deploy
  workflow mentions Cloudflare 401/403, when the Cloudflare email warning
  about Workers limits arrives and we can't read analytics to confirm, or
  when a freshly created token needs to be wired into the GitHub Secret +
  the infra MCP in one shot.
---

# Cloudflare Token Doctor

A practical playbook for restoring a working Cloudflare API token without
leaving the chat session. Order is deliberate — each stage gates the next.

## When to invoke this skill

- Any `mcp__cloudless-infra__cloudflare_*` tool returns `❌ Invalid access token`
- The Cloudflare HA LB workflow (`cloudflare-lb.yml`,
  `apply-cloudflare-lb.yml`, `cloudflare-disable-email-obfuscation.yml`)
  fails with a 401 / 403 from `api.cloudflare.com`
- The Cloudflare admin emails a "Workers request limit warning" and we
  need analytics to confirm impact
- The pending-setup table in `CLAUDE.md` lists "TOKEN NEEDED"
- A new token has been minted in the Cloudflare dashboard and needs to
  be propagated to the GitHub Secret `CLOUDFLARE_API_TOKEN` + the infra MCP

## Stage 0 — Diagnose

**One API call decides whether the token is alive.** Don't guess.

```bash
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify \
  | jq '.success, .result.status, .errors'
```

Outcomes:

| Output | Meaning | Next stage |
|---|---|---|
| `true / "active" / []` | Token alive | Stage 4 (scope check) |
| `false / null / [{"code":1000,...}]` | Token revoked or wrong | Stage 1 |
| `false / null / [{"code":1001,...}]` | Token expired | Stage 1 |
| `false / null / [{"code":10000,...}]` | Network/parse error | Stage 1 |

The same check from inside CI is available via `verify-cloudflare-token.yml`
(dispatch only). Use that when the token is already in the GitHub Secret and
you want a clean log entry rather than a one-liner.

## Stage 1 — Mint a new token

**Two paths. Pick whichever is reachable.**

### Path A — Bootstrap from an existing high-privilege token

If the **invalid** token is the only one in the GitHub Secret but you (the
human) still have a working Cloudflare login, run the dashboard flow once
and store the output. This is the path you'll take if every prior token is gone.

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token →
   Create Custom Token**
2. Name: `cloudless-infra-mcp` (or `cloudless-infra-mcp-YYYY-MM` if you
   rotate yearly).
3. Permissions (add each as a separate row):

   | Scope | Resource | Permission |
   |---|---|---|
   | Account | User API Tokens | Edit |
   | Account | Account Settings | Read |
   | Account | Workers Scripts | Read |
   | Zone | Zone | Read |
   | Zone | Analytics | Read |
   | Zone | Zone Settings | Edit |
   | Zone | DNS | Edit |
   | Zone | Load Balancing: Monitors and Pools | Edit |
   | Zone | Load Balancing: Load Balancers | Edit |

4. Account Resources: **Include — All accounts**
5. Zone Resources: **Include — Specific zone — cloudless.gr**
   (cloudless.online has been decommissioned — do not add it.)
6. TTL: **1 year** (or no expiry — your call; expiry forces rotation,
   no expiry forces vigilance).
7. **Continue → Create → copy the secret once.** Cloudflare will not
   show it again.

### Path B — Mint a scoped token from an existing high-privilege token

If a working token with `User API Tokens:Edit` is already available (GitHub
Secret / session secret), the infra MCP can mint narrower derivative tokens
itself:

```text
mcp__cloudless-infra__cloudflare_list_permission_groups(filter: "analytics")
mcp__cloudless-infra__cloudflare_create_token(
  name: "cloudless-readonly-analytics",
  policies: [{
    effect: "allow",
    resources: { "com.cloudflare.api.account.zone.<ZONE_ID>": "*" },
    permission_groups: [{ id: "<id-from-list>" }]
  }]
)
```

Use Path B for read-only consumers (Grafana, dashboards) so the wide
`User API Tokens:Edit` token never leaves the primary store.

## Stage 2 — Store the token

Two stores keep them in sync:

### 2a — GitHub Actions secret (source of truth for CI / LB workflows)

Requires repo secret `GH_PAT` (PAT with `repo` scope) so
`store-cloudflare-token.yml` can run `gh secret set`. Do **not** use
`aws ssm put-parameter`.

```bash
gh workflow run store-cloudflare-token.yml \
  -f cloudflare_token="<token>" \
  -f apply=false
```

`apply=false` stores only. Use `apply=true` after Stage 4 verifies the
scopes are right and you actually want to re-wire the HA load balancer
in the same run.

Alternatively (local, with `gh` authenticated to an account that can
write secrets):

```bash
echo -n "<token>" | gh secret set CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr --body -
```

### 2b — Cloud session secret (consumed by `cloudless-infra` MCP server)

The session-start hook reads `CLOUDFLARE_API_TOKEN` from the chat session's
secret store and forwards it to the MCP server. Set it in:

**Claude Code web UI → Session → Environment → Secrets**

Use the **same** value as the GitHub Secret. If they drift, the MCP will
keep returning "Invalid access token" until you also rotate the session
secret.

## Stage 3 — Smoke-test

```bash
bash scripts/cf-token-smoketest.sh
```

The script (shipped alongside this skill) hits one endpoint per
permission row from Stage 1 and reports pass/fail per scope. Exit code is
non-zero if any scope is missing — useful for CI gating.

Manual equivalents:

```bash
# Token verify
curl -sS -H "Authorization: Bearer $CF" \
  https://api.cloudflare.com/client/v4/user/tokens/verify

# Zone list (Zone:Read)
curl -sS -H "Authorization: Bearer $CF" \
  https://api.cloudflare.com/client/v4/zones \
  | jq '.result[].name'

# Workers list (Workers Scripts:Read)
curl -sS -H "Authorization: Bearer $CF" \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/scripts" \
  | jq '.result[].id'

# Zone analytics (Analytics:Read)
curl -sS -X POST -H "Authorization: Bearer $CF" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { zones(filter:{zoneTag:\"<ZONE_ID>\"}){ httpRequests1hGroups(limit:1){ sum { requests } } } } }"}' \
  https://api.cloudflare.com/client/v4/graphql

# Token list (User API Tokens:Read)
mcp__cloudless-infra__cloudflare_list_tokens()
```

## Stage 4 — Verify the infra MCP works

The MCP server reads from the cloud-session secret store, **not** the
GitHub Secret. After Stage 2b, every MCP call must succeed:

```text
mcp__cloudless-infra__cloudflare_list_tokens()
  → should list at least the freshly minted token

mcp__cloudless-infra__cloudflare_zone_settings()
  → should return real settings, not "Invalid access token"

mcp__cloudless-infra__cloudflare_zone_analytics(since_hours: 24)
  → should return requests/bandwidth/cached% (not error)
```

If any returns `❌ Invalid access token`:

1. Did the session-start hook actually pick up the new value? Close +
   reopen the cloud session, or run the hook manually.
2. Did Stage 1 grant the corresponding permission row? The scopes in
   Stage 1 cover every infra MCP tool that mentions Cloudflare; if you
   skipped one, the matching tool will keep failing.
3. Did you set the value in the right environment (Production vs Local)?
   The hook only reads the active environment's secrets.

## Stage 5 — Inventory and prune old tokens

Once the new token is live, list every token on the account and revoke
anything older / unused — minimizes blast radius if any token leaks.

```text
mcp__cloudless-infra__cloudflare_list_tokens()
mcp__cloudless-infra__cloudflare_delete_token(token_id: "<id>")
```

Keep:

- The currently active infra token
- Anything used by a CI workflow (look for `gh secret list | grep -i cloudflare`)
- Any tokens with a documented purpose in `docs/`

Revoke:

- "Edit Cloudflare Workers" default-named tokens you don't remember creating
- Tokens with expiry > 1 year in the past
- Duplicates from prior rotations

## Stage 6 — Record the rotation

Update `CLAUDE.md`'s **Pending One-Time Setup** table: change the status
of any "TOKEN NEEDED" rows that the new token covers to "SET ✅".

Optionally append a one-line entry to `docs/cloudflare-tokens.md`
(create it if it doesn't exist):

```text
2026-06-13  cloudless-infra-mcp  expires 2027-06-13  scopes: …  by: themis
```

This is the audit trail that lets the *next* invocation of this skill
know which token to expect.

## Common failure modes

- **"Invalid access token" only on a single MCP tool, but `verify` passes**
  → The token is alive but the missing scope is what that tool needs.
  Go back to Stage 1 and add the row from the failing tool's
  documentation.

- **HA LB workflows still fail after a fresh token**
  → They read `CLOUDFLARE_API_TOKEN` (GitHub Secret / workflow input), not
  the cloud-session secret. Did Stage 2a run?
  Re-run `store-cloudflare-token.yml -f apply=true`.

- **"AUTH_INVALID_TOKEN_HEADER" from the GraphQL endpoint**
  → The token format is correct but the header was typed `X-Auth-Key`
  instead of `Authorization: Bearer`. GraphQL only accepts the latter.

- **Token verify works in `curl` but the MCP still 401s**
  → The cloud-session hook wasn't reloaded. Close + reopen the session.
