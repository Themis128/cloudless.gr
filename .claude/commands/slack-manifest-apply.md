# Slack Manifest Apply

Push the versioned `slack-app.manifest.json` to the live Slack app via the Manifests API.
This registers all slash commands, OAuth scopes, event subscriptions, and display branding in one shot.

## When to run

Run this after any change to `slack-app.manifest.json` — new slash commands, scope additions,
URL changes, or branding updates.

## Token requirements

| Operation | Token type | How to get it |
|-----------|-----------|---------------|
| Validate only | App-level token (`xapp-…`) | api.slack.com/apps → Basic Information → App-Level Tokens → Generate (scope: `authorizations:read`) |
| Apply (update) | User OAuth token with `apps:write` | api.slack.com/apps → OAuth & Permissions → add `apps:write` to user scopes → reinstall → copy User OAuth Token |

A bot token (`xoxb-…`) **cannot** update the manifest.

## Steps

1. Read `slack-app.manifest.json` and `src/lib/slack-manifest.ts` to understand the manifest structure and API wrapper.

2. Ask the user for:
   - Their **Slack App ID** (format: `A08XXXXXXX`) — found at api.slack.com/apps → Basic Information → App Credentials
   - A **user OAuth token** with `apps:write` scope

3. **Validate first** (safe, no changes):

   ```bash
   npx tsx -e "
   import { validateManifest } from './src/lib/slack-manifest.js';
   const token = process.env.SLACK_USER_TOKEN ?? '';
   const result = await validateManifest(token);
   if (result.valid) {
     console.log('✅ Manifest is valid — ready to apply');
   } else {
     console.error('❌ Validation errors:');
     result.errors.forEach(e => console.error(' •', e));
   }
   " SLACK_USER_TOKEN=xoxp-your-token-here
   ```

   If validation fails, fix `slack-app.manifest.json` and re-validate before proceeding.

4. **Apply the manifest** (overwrites live app config):

   ```bash
   npx tsx -e "
   import { applyManifest } from './src/lib/slack-manifest.js';
   const appId = process.env.SLACK_APP_ID ?? '';
   const token = process.env.SLACK_USER_TOKEN ?? '';
   const result = await applyManifest(appId, token);
   console.log('✅ Manifest applied — App ID:', result.appId);
   " SLACK_APP_ID=A08XXXXXXX SLACK_USER_TOKEN=xoxp-your-token-here
   ```

5. Verify in Slack:
   - Open any channel and type `/cloudless-` — autocomplete should show all 4 commands
   - Run `/cloudless-help` to confirm the handler responds correctly
   - Check api.slack.com/apps → your app → Slash Commands to confirm all 4 are listed

6. If the user doesn't have a user OAuth token with `apps:write`, provide the manual fallback:

   **Manual registration at api.slack.com/apps → Slash Commands → Add:**

   | Command | Request URL | Description | Usage hint |
   |---------|-------------|-------------|-----------|
   | `/cloudless-status` | `https://cloudless.gr/api/slack/commands` | App health check — version and uptime | |
   | `/cloudless-orders` | `https://cloudless.gr/api/slack/commands` | Recent Stripe orders | `[count]` |
   | `/cloudless-channels` | `https://cloudless.gr/api/slack/commands` | List notification channel status | |
   | `/cloudless-help` | `https://cloudless.gr/api/slack/commands` | Show all available commands | |

   After saving, reinstall the app to the workspace (banner appears at top of the page).

## Manifest fields reference

The manifest controls:

- `display_information` — app name, description, background color shown in channel sidebar
- `features.bot_user` — bot display name ("Cloudless")
- `features.slash_commands` — all `/cloudless-*` commands and their request URLs
- `oauth_config.scopes.bot` — all required bot token scopes
- `settings.event_subscriptions` — Events API URL + subscribed bot events
- `settings.interactivity` — Interactions URL for button clicks
