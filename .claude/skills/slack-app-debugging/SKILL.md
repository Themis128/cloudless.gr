---
name: slack-app-debugging
description: Common Slack-app failures and how to fix them. Use when the user reports any Slack symptom — "invalid_auth", "not_allowed_token_type", "missing_scope", "trigger_expired", "channel_not_found", webhook 404, slash command returning "we had trouble", chat.postMessage silently failing, signature 401s, App Home not rendering, or a workflow that worked yesterday breaking today. Each entry maps a symptom to its root cause and a one-paragraph fix.
argument-hint: "the symptom / error string you're seeing, e.g. 'missing_scope', 'channel_not_found', 'trigger_expired'"
---

# Slack App Debugging — symptom → root cause → fix

Use this skill when **a Slack app misbehaves in production**. Look up the
symptom you're seeing in §1; if it's not there, work through §2 (the four
universal failure dimensions) to localise the layer that's broken.

Companion skills: `slack-app-builder` (manifest design), `slack-app-routes-nextjs`
(server code patterns).

## §1 — Symptom table (alphabetical)

### `app_home_disabled`

**Where:** `views.publish` response.
**Cause:** `features.app_home.home_tab_enabled: false` in the manifest.
**Fix:** Flip it to `true` in the manifest, save, reinstall the app. The
event subscription does not need to change.

### `channel_not_found` (from `chat.postMessage` or `conversations.invite`)

**Where:** Web API call returns 200 with `{ok:false, error:"channel_not_found"}`.
**Cause #1:** The bot isn't a member of the target channel and lacks
`chat:write.public`. **Fix:** add `chat:write.public` scope, reinstall.
**Cause #2:** The channel is private and the bot was never invited.
**Fix:** Invite the bot via `/invite @<bot>` in the channel.
**Cause #3:** The channel ID changed (rename can keep ID, archive cannot).
**Fix:** Re-resolve via `conversations.list`.

### `chat.postMessage` returns `{ok:true}` but no message appears in user's DM

**Cause:** `features.app_home.messages_tab_enabled: false`.
**Fix:** Set to `true` in the manifest, save, reinstall. This is the single
most surprising silent failure in the Slack API.

### Daily / hourly workflow stops posting to Slack overnight

**Cause:** The repo became public and Slack's secret scanning auto-revoked
the webhook URL within hours (you'll find a Slack notification in the owner's
inbox).
**Fix:** Mint a new webhook URL at app settings → Incoming Webhooks; move
the URL into a secret manager (SSM, env, 1Password) — never commit. See
`scripts/restore-slack-webhook.sh` for the one-shot helper.

### Generator/publisher worked at midnight, fails at 08:15

**Cause:** App-config token (`xoxe.xoxp-…`) expired at the 12-hour mark.
**Fix:** Run `scripts/rotate-slack-app-config-token.sh` (uses
`tooling.tokens.rotate`). **Don't put `refresh_token` in the Bearer header**
— it goes in the form body. Otherwise: `invalid_auth`.

### `invalid_arguments` from `chat.postMessage` with Block Kit

**Cause #1:** Unescaped apostrophe / curly quote in a JSON heredoc.
**Fix:** Use a JSON file + `--data @file.json` instead of a heredoc; or
switch to plain `text` and skip blocks.
**Cause #2:** Block-count exceeds **50 per message** (100 for Home/modal).
**Fix:** Trim or paginate.

### `invalid_auth` on every Web API call after a reinstall

**Cause:** Cached the old bot token at module load; reinstall minted a new
one but the cache wasn't invalidated.
**Fix:** Call your config-reset (`resetSlackConfigCache()` in this repo) or
restart the Lambda. **Bot tokens change on every reinstall.**

### `missing_scope` after manifest update

**Cause:** Adding a scope to the manifest does **not** backfill existing
tokens — the user has to **re-OAuth**.
**Fix:** Open app settings → Install App → "Reinstall" button. The new
token (`xoxb-…`) has the added scope; rotate it into your secret store.

### `not_allowed_token_type` from `users.profile.set`

**Cause:** Bot tokens (`xoxb-…`) can't modify user profiles — that needs a
user token (`xoxp-…`) with `users.profile:write`.
**Fix:** Ask the user to do it in the Slack UI, or add `user_scope:
users.profile:write` to the manifest and have them re-OAuth.

### Signature 401s on every request (production-only)

**Cause #1:** Cached the signing secret with an empty string (env not set in
Lambda). **Fix:** Add a missing-secret check at module load that logs
loudly; verify `SLACK_SIGNING_SECRET` is in SSM and the Lambda IAM role can
read it.
**Cause #2:** Body was JSON-parsed before signature verification — the
verifier hashes empty bytes.
**Fix:** Read `await req.text()` *once*, pass the string to both the
verifier and the JSON parser.

### Slash command shows "we had trouble" / "darn — that didn't work"

**Cause:** Handler returned non-200 *or* took longer than 3 s.
**Fix:** Return 200 immediately (with the response body or just
`{ok:true}`); defer work to `response_url` follow-up.

### `trigger_expired` from `views.open`

**Cause:** `trigger_id` is **single-use, 3-second TTL**. You held it across
an `await` to a slow API.
**Fix:** Call `views.open` *immediately* with a skeleton view, then
`views.update` once your data is ready.

### `tooling.tokens.rotate` returns `invalid_auth`

**Cause:** Tried to send `refresh_token` as `Authorization: Bearer
<refresh-token>`. The endpoint requires it in the **form body**.
**Fix:**

```bash
curl -sS https://slack.com/api/tooling.tokens.rotate \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "refresh_token=$REFRESH_TOKEN"

```

Reference: `scripts/rotate-slack-app-config-token.sh` in this repo (PR #899).

### `url_verification` fails when saving the Request URL

**Cause:** Endpoint responded with anything other than the exact `challenge`
string. Common bug: tried to JSON-parse the body but the route handler
shortcircuits on type mismatch before reaching that branch.
**Fix:** Branch on `payload.type === "url_verification"` *first*, before any
other dispatch logic. Return `Response.json({ challenge: payload.challenge })`.

## §2 — Universal failure dimensions

When the symptom isn't in §1, walk the four layers in order:

| # | Layer | What to check |
|---|---|---|
| 1 | **Manifest** | Are the scopes you need listed? Is `interactivity.is_enabled` true if you registered button handlers? Is `messages_tab_enabled` true if you DM users? |
| 2 | **Install state** | Has the user reinstalled since the last manifest change? `auth.test` returns the scope list — diff it against what the manifest declares. |
| 3 | **Signing secret + token** | Are env / SSM values populated in the runtime? `aws ssm get-parameter --name /cloudless/production/SLACK_SIGNING_SECRET --with-decryption` should show 32-char hex. |
| 4 | **Code** | Verify signature before parsing body. Return 200 in <3s. Dedup on event_id. Branch `url_verification` first. |

Quick health check command:

```bash
bash scripts/slack-app-doctor.sh \
  --token "$SLACK_BOT_TOKEN" \
  --signing-secret "$SLACK_SIGNING_SECRET" \
  --channel "$NEWSLETTER_SLACK_CHANNEL_ID"

```

Prints: `auth.test` result, granted scope list, channel reachability, and a
round-trip signed request to your `/api/<thing>-slack/commands` endpoint.

## §3 — Rate limits (numbers worth memorising)

Docs: <https://docs.slack.dev/apis/web-api/rate-limits>.

| Tier | Methods (examples) | Allowance |
|---|---|---|
| 1 | `chat.scheduledMessages.list` | ~1/min |
| 2 | `users.list`, `conversations.list` | ~20/min |
| 3 | `chat.postMessage` (non-special), most reads | ~50/min |
| 4 | `auth.test`, lightweight metadata | ~100/min |
| Special | `chat.postMessage` per channel | ~1/sec sustained, short bursts allowed |

On 429, honor the `Retry-After` header (seconds). Marketplace-**unlisted**
apps created on/after 2025-05-29 have `conversations.history` and
`conversations.replies` slammed to Tier 1 — internal customer-built apps
(like ours) are unaffected.

## §4 — Webhook lifecycle landmines

- **Public-repo commits** of an `https://hooks.slack.com/services/…` URL get
  auto-revoked by Slack within hours (sometimes minutes). The workspace
  owner gets an email.

- **Webhooks die silently** — your script will POST and get a 404; nothing
  surfaces in Slack itself. Always assert on the response status.

- **Re-minting:** app settings → Incoming Webhooks → "Add New Webhook to
  Workspace". The URL is per-channel — picking a different channel mints a
  new URL.

## §5 — Two-app pattern

If you find yourself adding scope to one app for an unrelated feature
(e.g. "the bot needs `files:write` for the newsletter PDFs but it didn't
before"), seriously consider **splitting into a second app**. Token-rotation
incidents, signing-secret leaks, and scope drift on one app do not affect
the other. See `slack-newsletter-app.manifest.json` in this repo for the
reference dedicated-app pattern; the `Newsletter` app has its own
`NEWSLETTER_SLACK_{SIGNING_SECRET,BOT_TOKEN}` and posts only to
`/api/newsletter-slack/*` routes.

## Reference URLs

- Slack error code reference (search by string): <https://docs.slack.dev/apis/web-api/errors>
- Rate limits: <https://docs.slack.dev/apis/web-api/rate-limits>
- Events API retry policy: <https://docs.slack.dev/apis/events-api/>
- Token rotation: <https://docs.slack.dev/authentication/using-token-rotation>
- App manifest schema: <https://docs.slack.dev/reference/app-manifest>
