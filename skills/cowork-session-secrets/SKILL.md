---
name: cowork-session-secrets
description: |
  Update or audit Cowork desktop-app session secrets that get forwarded to
  MCP servers (CLOUDFLARE_API_TOKEN, GITHUB_PAT, TAILSCALE_AUTH_KEY,
  OMV_SSH_KEY_CONTENTS, etc.). Use whenever an mcp__* tool returns 401 /
  "Invalid access token" / "Authentication error", whenever a token has
  been rotated and the MCP needs to pick up the new value, or when the
  user can't find Cowork's settings UI. Distinct from the Claude Platform
  Console at platform.claude.com — that's a different product. This skill
  is specifically for the Cowork desktop app that mounts D:\\... folders
  and exposes the bash tool with paths like /sessions/<name>/mnt/.
---

# Cowork Session Secrets

A practical playbook for keeping the cloud-session secret store aligned
with what MCP servers expect. Two failure modes recur:

1. A token in the secret store is invalid (expired / revoked / wrong value)
   and all matching MCP tools return 401.
2. The token in the store is correct but the **session** that loaded the
   MCP server hasn't been restarted since the secret changed, so the MCP
   is still holding the stale value.

## When to invoke this skill

- Any `mcp__<server>__*` tool returns `❌ Invalid access token`,
  `Authentication error`, or `401`
- A secret was just rotated (Cloudflare, GitHub, Tailscale, an MCP-specific
  API key) and the MCP needs to pick up the new value
- The user asks "where do I update the Cowork secret?" or otherwise needs
  help locating the settings UI
- A token verified working in `curl` from the bash tool but the MCP still
  401s — that's a session-restart issue (Stage 4 below)

## Stage 0 — Identify which secret is wrong

```bash
# Try the failing MCP tool again so you have a fresh error.
# Cross-reference the failing tool's documentation to find the env var
# name it reads from. Most are obvious: cloudless-infra reads
# CLOUDFLARE_API_TOKEN, OMV_SSH_KEY_CONTENTS, TAILSCALE_AUTH_KEY.
```

Check `CLAUDE.md` → **Cloud Session Secrets** table for the canonical
mapping of secret name → MCP tools that consume it. If a secret isn't in
that table and an MCP is failing, the table is out of date — add a row
once the rotation is done (Stage 6).

## Stage 1 — Get the correct value

If the user is rotating a token, they (or you, via Chrome MCP) have to
mint the new value first. Each provider has its own playbook:

| Secret | Mint procedure |
|---|---|
| `CLOUDFLARE_API_TOKEN` | See `skills/cloudflare-token-doctor/SKILL.md` Stage 1 |
| `GITHUB_PAT` | https://github.com/settings/tokens/new — `repo` scope, no expiry |
| `TAILSCALE_AUTH_KEY` | https://login.tailscale.com/admin/settings/keys — ephemeral, pre-authorized |
| `OMV_SSH_KEY_CONTENTS` | `base64 -w0 ~/.ssh/id_ed25519` on a machine that has the key |

If the value is already known (user just rotated it elsewhere), skip
ahead.

## Stage 2 — Update the secret in the Cowork desktop app

**This is a UI-only step.** There is no `claude://settings` URL, no
in-MCP write tool, no GraphQL endpoint. The settings store lives inside
the local Cowork app process, not the Claude Platform Console at
`platform.claude.com` (that's the Managed Agents dev console — a
different product, and updating things there will not affect your
Cowork session).

Path:

1. Open the Cowork desktop app (the one rendering your current chat)
2. Find the session settings entry — usually one of:
   - A **gear/cog icon** in the title bar near the session title
   - A **menu next to your account avatar** in the top-right
   - **File → Preferences → Sessions** on macOS / Linux desktop builds
   - **Settings → Sessions** on Windows desktop builds
3. Open the **Environment** or **Secrets** section for the active session
4. Add or edit:
   - **Name**: the exact env var name from Stage 0 (case-sensitive)
   - **Value**: the value from Stage 1
5. **Save**

If you can't find the settings UI in ~60 seconds, **don't fight it**.
The MCP isn't strictly required — every Cloudflare / GitHub / AWS action
is also reachable via direct API calls from the bash tool. See Stage 5
for the fallback.

## Stage 3 — Restart the chat session

The session-start hook reads env on connect and forwards it to each MCP
server's stdin. It does **not** poll for changes. So:

- **Close** the current chat tab/window
- **Open** a new chat session (same workspace, same folder mount)
- The MCP server reconnects with the new env

If the chat won't close cleanly (it's holding open file handles), kill
the Cowork process from the OS task manager and reopen.

## Stage 4 — Verify the MCP works

```text
# In the new chat session, retry the failing tool:
mcp__cloudless-infra__cloudflare_list_tokens()
# Expected: real token list, not "Invalid access token".

mcp__cloudless-infra__cloudflare_zone_settings()
# Expected: zone settings JSON, not "Authentication error".
```

If any tool still 401s after a session restart, the value didn't make it
into the env. Most common cause: a trailing newline or quote was pasted
along with the secret. Open the settings UI again and verify the value
is exact-match against what you minted in Stage 1. Cloudflare tokens
all start with `cfut_` — if it starts with a quote, retype.

## Stage 5 — Fallback: skip the MCP entirely

The MCP being green is a convenience, not a requirement. Every secret
in the Cloud Session Secrets table is also available in one of:

- **AWS SSM** at `/cloudless/production/<KEY>` (for Cloudflare, Anthropic,
  Notion, EspoCRM, Stripe, etc.) — readable via the bash tool with
  `aws ssm get-parameter --with-decryption ...`
- **GitHub Secrets** (for `AWS_DEPLOY_ROLE_ARN`, OIDC roles)
- **Direct env in the bash sandbox** (for `GITHUB_PAT` — the agent
  already has it embedded in remote URLs)

So if Stage 2 is blocked because the user can't find Cowork's settings
UI, switch to:

```bash
# Example: every Cloudflare workflow uses the SSM token, not the MCP.
gh workflow run verify-cloudflare-token.yml
gh workflow run store-cloudflare-token.yml -f cloudflare_token=... -f apply=true
# Example: direct curl with the value from Stage 1 — no MCP needed.
curl -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/...
```

Document this fallback in chat so the user knows progress isn't blocked.

## Stage 6 — Record the rotation

After Stage 4 confirms the new secret works, update two things:

1. **`CLAUDE.md`** → **Cloud Session Secrets** table — bump the "Status"
   column to "SET ✅" or "ROTATED YYYY-MM-DD".
2. **`CLAUDE.md`** → **Pending One-Time Setup** table — if the rotation
   resolved a "TOKEN NEEDED" / "NEEDS ROTATION" row, mark it complete.

Optional but recommended: append to `docs/secret-rotations.md`:

```text
2026-06-13  CLOUDFLARE_API_TOKEN  cloudless-infra-mcp  by: themis  via: chrome-mcp+gh-workflow
```

That paper trail lets the next invocation of this skill know the
expected current value (or at least its mint date).

## Common failure modes

- **"I updated the secret but the MCP still 401s"** → Session wasn't
  restarted. Go back to Stage 3.

- **"I can't find the settings UI in the Cowork app"** → Stage 5.
  Operate via workflows + bash instead. Document the missing UI in a
  GitHub issue so future-you doesn't waste time looking again.

- **"I'm on the platform.claude.com page and there's no
  `CLOUDFLARE_API_TOKEN` field"** → That's the Claude Platform Console
  for Managed Agents, not the Cowork desktop app. Different product.
  See Stage 2 — the Cowork settings are in the desktop app itself.

- **"The verify workflow still fails after I updated the SSM token"** →
  Different store. The MCP reads from the cloud-session secret store,
  workflows read from SSM. Both need the same value. Run
  `store-cloudflare-token.yml -f apply=false` to sync SSM independently
  of the MCP store.

## Related skills

- `cloudflare-token-doctor` — full mint → store → verify → prune flow
  for `CLOUDFLARE_API_TOKEN` specifically
- `terraform-doctor` — example of the parallel pattern for fixing
  Terraform CI failures
