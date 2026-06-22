---
name: slack-app-builder
description: End-to-end guide for building a Slack app from scratch — manifest, scopes, OAuth install, signing-secret verification, slash commands, events, interactions, App Home. Use when the user asks to "create a new Slack app", "build a Slack bot", "add a slash command", "set up an Events Request URL", "wire up App Home", or any greenfield Slack-app task. Pulls in the current (June 2026) docs.slack.dev schema; do NOT use legacy `api.slack.com/docs/*` URLs or the classic `bot` scope.
argument-hint: "what to build — e.g. 'newsletter ops app', 'on-call bot for #incidents', 'support-ticket slash command'"
---

# Slack App Builder — current best practices (June 2026)

Use this skill whenever the user wants to **create or extend a Slack app**.
It collapses the docs.slack.dev surface area into the 8 decisions you actually
have to make, with copy-pasteable scaffolds. The companion skills
`slack-app-routes-nextjs` (server code) and `slack-app-debugging` (when things
break) handle the next phase.

> **Authoritative doc root: `https://docs.slack.dev/`.** The old
> `api.slack.com/docs/*` URLs redirect here — never cite the old paths.
> `api.slack.com/apps` is still the live app-management UI.

## The 8 decisions

| # | Decision | Default for an internal-org app |
|---|---|---|
| 1 | Single-workspace vs public distribution | Single-workspace (no review needed) |
| 2 | HTTP request URLs vs Socket Mode | HTTP (prod-grade; works through Lambda/Next.js) |
| 3 | Granular vs classic scopes | **Granular** — classic `bot` scope is deprecated |
| 4 | Slash commands vs shortcuts | Slash for "do X", shortcut for "do X to this message/channel" |
| 5 | App Home tab | Yes if there's any state worth visualising; cheap to add |
| 6 | Messages tab (DMs) | Yes if the bot DMs users — otherwise `chat.postMessage` to user DMs silently no-ops |
| 7 | Token rotation (`token_rotation_enabled`) | Off for internal apps; on for distributed/marketplace |
| 8 | Per-feature dedicated app or one bigger app | Dedicated when one team owns a domain (newsletter, on-call, support); reduces blast radius on scope/token incidents |

## The minimum-viable manifest (copy-paste, then edit)

Save as `<thing>-app.manifest.json` and paste at
**https://api.slack.com/apps/new → From an app manifest → pick workspace**.

```json
{
  "display_information": {
    "name": "<App Name>",
    "description": "<one-line, ≤140 chars>",
    "background_color": "#0B5174",
    "long_description": "<174–4000 chars — what the app does, why, and who owns it>"
  },
  "features": {
    "app_home": {
      "home_tab_enabled": true,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "bot_user": {
      "display_name": "<Bot>",
      "always_online": true
    },
    "slash_commands": [
      {
        "command": "/<thing>-help",
        "url": "https://<your-domain>/api/<thing>-slack/commands",
        "description": "Show all /<thing>-* commands",
        "usage_hint": "(no arguments)",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "chat:write",
        "commands",
        "im:history",
        "im:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://<your-domain>/api/<thing>-slack/events",
      "bot_events": ["app_home_opened", "app_mention", "message.im"]
    },
    "interactivity": {
      "is_enabled": true,
      "request_url": "https://<your-domain>/api/<thing>-slack/interactions"
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}

```

Manifest validation reference: <https://docs.slack.dev/reference/app-manifest>.
**Hard limits** to keep handy: `name` ≤35, `description` ≤140, `long_description`
174–4000, `bot_user.display_name` ≤80, `slash_commands[].command` ≤32 (including
the leading `/`), `usage_hint` ≤1000, `description` ≤2000.

## The right starting scopes (per use-case)

Granular scopes are **additive on install** — adding one later means the user
re-OAuths the app. Start with what you need; don't over-grant.

| You want to… | Add scopes |
|---|---|
| Receive `@bot` mentions in channels | `app_mentions:read` |
| Post as the bot anywhere | `chat:write` |
| Post to channels the bot isn't a member of | `chat:write.public` |
| DM users + read those DMs | `im:write`, `im:history` |
| Resolve user IDs to names/emails | `users:read`, `users:read.email` |
| Run slash commands | `commands` |
| Have the bot join public channels | `channels:join`, `channels:read` |
| Have the bot join private channels (invited) | `groups:read`, `groups:write` |
| Get notified when someone joins a channel | `channels:read` or `groups:read` |
| Read messages in channels | `channels:history` (public) / `groups:history` (private) |
| React with emoji | `reactions:write` |
| Upload files | `files:write` |
| Open modals + receive button clicks | (only `commands` + `interactivity` enabled — no extra scope needed) |
| Use App Home tab | (no extra scope — controlled by manifest `features.app_home`) |

Doc: <https://docs.slack.dev/reference/scopes>.

## OAuth install flow (single-workspace path)

For an internal app, the simplest flow is the **"Install to Workspace"** button
on the app's own settings page. No callback URL needed; Slack hands you the
`xoxb-…` token directly. Copy it into your secret manager (SSM, Vercel env,
1Password) — never commit.

If you want a public **"Add to Slack"** install button anyway:

1. `oauth_config.redirect_urls`: add `https://<your-domain>/api/<thing>-slack/oauth-callback`.
2. Authorize URL: `https://slack.com/oauth/v2/authorize?client_id=…&scope=<csv-of-bot-scopes>&user_scope=<csv-of-user-scopes>&redirect_uri=…&state=<csrf>`.
3. Exchange: `POST https://slack.com/api/oauth.v2.access` form-encoded with
   `code`, `client_id`, `client_secret`, optional `redirect_uri`. The `code`
   expires in 10 min.

4. Response: top-level `access_token` is the **bot token (`xoxb-…`)**;
   `authed_user.access_token` is the **user token (`xoxp-…`)** if you asked
   for any `user_scope`.

`xapp-…` app-level tokens are **only for Socket Mode** (`connections:write`
scope) and do not call Web API methods like `chat.postMessage` — don't confuse
them with bot tokens.

## App Home — render a live dashboard

App Home is the cheapest way to give ops a real surface. It's a single block-kit
view published on demand via [`views.publish`](https://docs.slack.dev/reference/methods/views.publish)
each time the user opens the Home tab (`app_home_opened` event).

Pattern:

```ts
// On app_home_opened event:
const data = await gatherDashboardData();      // your DB / connector calls
const view = renderHomeView(userId, data);     // block-kit JSON
await fetch("https://slack.com/api/views.publish", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${botToken}`,
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({ user_id: userId, view }),
});

```

Hard caps: **100 blocks per Home view, 100 per modal, 50 per chat message.**
Server code lives in `slack-app-routes-nextjs` skill (events route).

## Slash commands vs shortcuts

- **Slash command** (`/<thing>-list`): the user is creating an action.
  Payload is form-encoded; you respond synchronously in 3s or post via
  `response_url`.

- **Message shortcut**: the user is acting on a specific message.
  Payload is the interactions endpoint; needs `commands` scope still.

- **Global shortcut**: lives in the ⚡ menu; no message context.
- All slash commands share the same Request URL — switch on `payload.command`
  inside one handler.

Don't put more than ~6 slash commands on a single app — past that, prefer a
single `/<thing>` command with subcommands (`/<thing> list`, `/<thing> send`).

## Distribution checklist

For a **single-workspace internal app** (the default):

- Install via "Install to Workspace" on app settings page
- No HTTPS-only review, no marketplace listing
- HTTP request URLs are fine (just must be HTTPS)
- No `oauth_config.redirect_urls` needed

For **public distribution** (Marketplace):

- Toggle "Distribution → Manage Distribution → Activate Public Distribution"
- HTTPS-only `redirect_uri`, no self-signed certs
- Security review required for Marketplace listing
- **Forces granular-scope minimum** (no classic `bot` scope)

## The hand-off to other skills

| Next step | Skill |
|---|---|
| Write the Next.js endpoints (commands/events/interactions) | `slack-app-routes-nextjs` |
| Hit a confusing Slack error | `slack-app-debugging` |
| Bootstrap the bot token + signing secret into your env | `scripts/slack-app-doctor.sh` (live health check) |
| Rotate the **app-config token** for manifest API access | `cloudless-token-rotation` skill family |

## Common-mistakes cheat sheet

1. **Asking for the legacy `bot` scope.** Use granular (`chat:write`,
   `app_mentions:read`, …). The `bot` scope only works for classic apps,
   which can't be created anymore on a new app form.

2. **Forgetting `messages_tab_enabled`.** If the bot DMs users and this is
   `false`, `chat.postMessage` returns `ok:true` but the user never sees it.

3. **Putting the wrong URL paths in the manifest.** Slash commands /
   interactivity / events all point to *different* endpoints — Slack does
   not auto-discover.

4. **Reusing the same app for two unrelated domains.** A scope rotation,
   token leak, or quota incident on one will take down the other. Spin a
   dedicated app per domain (e.g. newsletter ops vs general bookings).

5. **Adding a scope without re-installing.** Existing tokens don't backfill
   new scopes. After every manifest scope change, the install button on
   the app page is the *required* second step.

## Reference URLs (current — never use the old api.slack.com/docs/* paths)

- App manifest schema: <https://docs.slack.dev/reference/app-manifest>
- Configuring with manifests: <https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests>
- Granular scope catalog: <https://docs.slack.dev/reference/scopes>
- OAuth install: <https://docs.slack.dev/authentication/installing-with-oauth>
- Token types: <https://docs.slack.dev/authentication/tokens>
- Slash commands: <https://docs.slack.dev/interactivity/implementing-slash-commands>
- Block Kit: <https://docs.slack.dev/reference/block-kit>
- App Home: <https://docs.slack.dev/surfaces/app-home>
- Events API: <https://docs.slack.dev/apis/events-api/>
- Web API method index: <https://docs.slack.dev/reference/methods>
- Rate limits: <https://docs.slack.dev/apis/web-api/rate-limits>
