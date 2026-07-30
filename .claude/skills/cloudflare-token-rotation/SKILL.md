---
name: cloudflare-token-rotation
description: Step-by-step playbook for rotating the Cloudless.gr Cloudflare API token. Combines the automated workflow (GitHub Secret) with the manual Cowork session-secret update step.
when_to_use:
  - The current token has been exposed (e.g. accidentally pasted in a transcript)
  - Quarterly scheduled rotation
  - After a CodeQL or secret-scanning alert flags the token
  - When the token is about to expire (CLAUDE.md noted: token id 5fc6ace69cb4aed01d6319fbae993181 was last verified active 2026-06-13)
---

# Cloudflare API Token Rotation

The token lives in two places for operators. One is automated; one is manual.

| Where | How to update | Status when done |
|---|---|---|
| GitHub Actions secret `CLOUDFLARE_API_TOKEN` | `cloudflare-token-rotate.yml` (or `store-cloudflare-token.yml`) | ✅ Auto |
| Cowork session-environment secret `CLOUDFLARE_API_TOKEN` | Manual UI step — covered below | 🟡 You |

Source of truth for CI is the **GitHub Actions secret**. Do **not** use
`aws ssm put-parameter` / `get-parameter` for this token.

**Required:** repo secret `GH_PAT` (PAT with `repo` scope) so the workflow
can run `gh secret set`. `GITHUB_TOKEN` cannot write Actions secrets.

## Procedure

### 1. Dry-run the rotation (verify token + scopes)

Trigger the workflow with `apply=false`:

```bash
gh workflow run cloudflare-token-rotate.yml --repo Themis128/cloudless.gr --ref main -f apply=false
gh run watch --repo Themis128/cloudless.gr
```

The step summary will print:

- The current token id
- Verify-call success
- A plan of what `apply=true` will do

If the verify step fails, the token is already dead — see "Recovery" at the bottom.

### 2. Apply the rotation

```bash
gh workflow run cloudflare-token-rotate.yml --repo Themis128/cloudless.gr --ref main -f apply=true
gh run watch --repo Themis128/cloudless.gr
```

What happens:

1. Workflow reads the current token from `secrets.CLOUDFLARE_API_TOKEN`.
2. Calls `PUT /user/tokens/{id}/value` — Cloudflare returns a new secret. **Old secret is invalidated immediately on this call.**
3. New value is verified against `/user/tokens/verify`.
4. GitHub Actions secret is updated via `gh secret set` (requires `GH_PAT`).

If any step fails after step 2, the token is in a half-rotated state — see "Recovery".

### 3. Manual: update the Cowork session secret

After rotation, paste the new value into Cowork session secrets so the
`cloudless-infra` MCP can use it. The rotated secret is not readable back
from GitHub Actions — if you did not capture it from a controlled mint,
re-mint and run `store-cloudflare-token.yml`, then paste that same value here.

#### Then in Claude Code web UI

1. Open the desktop app's session menu (top-right gear or Cmd/Ctrl+,)
2. Navigate to **Session → Environment → Secrets**
3. Find the existing secret named **`CLOUDFLARE_API_TOKEN`** (or add it if absent)
4. Click **Edit** → paste → **Save**
5. Reload the Cowork session

The next `mcp__cloudless-infra__cloudflare_*` call should succeed.

## Verification

After the manual step, verify both stores agree:

Ask Claude in the Cowork session:
> Run `mcp__cloudless-infra__cloudflare_list_tokens` and confirm the active token id matches the rotation run summary.

The MCP wraps the session secret as the bearer. If `list_tokens` returns the rotated id and `status=active`, both stores are aligned.

## Recovery (token rotation half-failed)

**Scenario:** Workflow's PUT call succeeded (old token dead), but the GitHub secret update failed (e.g. missing `GH_PAT`).

You're stuck — the new token value was returned ONCE in the workflow output, then masked. To recover:

1. Mint a brand-new token in the Cloudflare dashboard (`https://dash.cloudflare.com/profile/api-tokens`) with the same scopes as the original. See `cloudless.gr`'s CLAUDE.md "Cloudflare HA LB" item and the `cloudflare-token-doctor` skill for the exact scope list.
2. Ensure `GH_PAT` is set on the repo, then run `store-cloudflare-token.yml` with the new token + `apply=true`.
3. Update the Cowork session secret manually (step 3 above).

## Scope requirements

The token doing the rotation needs the **"API Tokens Write"** permission group at User scope (perm group id `4755a26eedb94da69e1066d98aa820be`). The current token (id `5fc6ace69cb4aed01d6319fbae993181`) does NOT yet have this scope based on CLAUDE.md's HA-LB blocker comment.

If `apply=true` fails with error code 9007 ("Could not route to ..."), the current token lacks the scope. Mint a one-off token with just "API Tokens Write" at User scope, run the rotation manually via curl, then store the new token via `store-cloudflare-token.yml`.

```bash
# Manual one-off rotation if the workflow can't:
curl -X PUT -H "Authorization: Bearer $ONEOFF_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/5fc6ace69cb4aed01d6319fbae993181/value" \
  -d '{}'
```

## See also

- `cloudflare-token-rotate.yml` — the workflow
- `store-cloudflare-token.yml` — mint/store path (GitHub Secret)
- `verify-cloudflare-token.yml` — daily smoketest that catches expiries
- CLAUDE.md "Pending One-Time Setup" → "Cloudflare infra MCP token"
