---
inclusion: manual
---

# Cloudflare API Token Rotation

The token lives in three places. Two are automated, one is manual.

| Where | How to update | Status when done |
|---|---|---|
| AWS SSM `/cloudless/production/CLOUDFLARE_API_TOKEN` | `cloudflare-token-rotate.yml` workflow | ✅ Auto |
| GitHub Actions secret `CLOUDFLARE_API_TOKEN` | Same workflow (via `gh secret set`) | ✅ Auto |
| Cowork session-environment secret `CLOUDFLARE_API_TOKEN` | Manual UI step — covered below | 🟡 You |

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

1. Workflow calls `PUT /user/tokens/{id}/value` — Cloudflare returns a new secret. **Old secret is invalidated immediately on this call.**
2. New value is verified against `/user/tokens/verify`.
3. AWS SSM is updated via `aws ssm put-parameter --overwrite`.
4. GitHub Actions secret is updated via `gh secret set`.

If any step fails after step 1, the token is in a half-rotated state — see "Recovery".

### 3. Manual: update the Cowork session secret

The rotated value is now in SSM. Copy it into your Cowork session secrets so the `cloudless-infra` MCP can use it.

#### From PowerShell (Windows)

```powershell
$token = aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN --with-decryption --region us-east-1 --query 'Parameter.Value' --output text
$token | Set-Clipboard
Write-Host "Token copied to clipboard ($($token.Length) chars)"
```

#### From bash (macOS/Linux)

```bash
aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN \
  --with-decryption --region us-east-1 \
  --query 'Parameter.Value' --output text | pbcopy
```

#### Then in Claude Code web UI

1. Open the desktop app's session menu (top-right gear or Cmd/Ctrl+,)
2. Navigate to **Session → Environment → Secrets**
3. Find the existing secret named **`CLOUDFLARE_API_TOKEN`** (or add it if absent)
4. Click **Edit** → paste from clipboard → **Save**
5. Reload the Cowork session

The next `mcp__cloudless-infra__cloudflare_*` call should succeed.

## Verification

After the manual step, verify all three locations agree:

```bash
# From the Cowork session — uses the freshly-updated session secret via the MCP
# (this is the canonical "session secret works" test)
```

Then ask Claude in the Cowork session:
> Run `mcp__cloudless-infra__cloudflare_list_tokens` and confirm the active token id matches what's in SSM.

The MCP wraps the session secret as the bearer. If `list_tokens` returns the rotated id and `status=active`, all three stores are aligned.

## Recovery (token rotation half-failed)

**Scenario:** Workflow's PUT call succeeded (old token dead), but SSM or GH secret update failed.

You're stuck — the new token value was returned ONCE in the workflow output, then masked. To recover:

1. Mint a brand-new token in the Cloudflare dashboard (`https://dash.cloudflare.com/profile/api-tokens`) with the same scopes as the original. See `cloudless.gr`'s CLAUDE.md "Cloudflare HA LB" item and the `cf-token-doctor` reference for the exact scope list.
2. Run the `store-cloudflare-token.yml` workflow with the new token + `apply=true` to repopulate SSM + the GH secret.
3. Update the Cowork session secret manually (step 3 above).

To prevent recurrence, the rotation workflow does verify → rotate → verify-new → update-SSM → update-GH in that strict order. The SSM/GH steps are the cheap ones — if they fail, file an issue and figure out why before re-attempting.

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
- `verify-cloudflare-token.yml` — daily smoketest that catches expiries
- CLAUDE.md "Pending One-Time Setup" → "Cloudflare infra MCP token"
