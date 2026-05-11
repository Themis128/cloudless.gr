# Slack Brand

Inspect and configure cloudless.gr branding in Slack. Explains what can be set via API vs what requires the Slack App dashboard.

## Branding layers

Slack has three distinct branding layers — each with different controls:

### 1. Per-message branding (code-controlled ✅)

Every message sent by `slack-notify.ts` carries:
- `username: "Cloudless"` — display name shown on each message
- `icon_url: "https://cloudless.gr/icons/icon-512.png"` — 512×512 PNG avatar

This is already wired in `src/lib/slack-notify.ts`. No action needed.

### 2. App-level branding (one-time manual setup ⚠️)

The Slack App's icon and name shown in the workspace sidebar / app directory.
**Cannot be set via the bot token API** — must be done at:

👉 **<https://api.slack.com/apps> → select your app → Basic Information → Display Information**

Steps:
1. App Name: `Cloudless`
2. Short Description: `Notifications from cloudless.gr — bookings, orders, errors & deploys`
3. App Icon: upload `/public/icons/icon-512.png` (512×512 PNG, already in the repo at `https://cloudless.gr/icons/icon-512.png`)
4. Background Color: `#0B1D51` (or the brand primary — adjust to match design system)
5. Save Changes → reinstall app if prompted

### 3. Workspace branding (admin only 🔒)

Workspace icon, name, and theme — set in:
**Slack Desktop → workspace name (top-left) → Settings & administration → Workspace settings**

Requires Workspace Owner or Admin role. Not scriptable via bot token.

## Steps

1. Read `src/lib/slack-workspace.ts` and `src/lib/slack-notify.ts`.

2. Resolve `SLACK_BOT_TOKEN` from `.env.local` or integrations config.

3. Call `getSlackBrandingAudit(token)` and report the current state:

   ```bash
   npx tsx -e "
   import { getSlackBrandingAudit } from './src/lib/slack-workspace.js';
   import { getSlackConfigAsync } from './src/lib/integrations.js';
   const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
   const audit = await getSlackBrandingAudit(token);
   console.log('--- Bot identity ---');
   console.log('Bot user:', audit.bot.botName, '(', audit.bot.userId, ')');
   console.log('Workspace:', audit.bot.team, '/', audit.bot.teamId);
   console.log('');
   console.log('--- Workspace ---');
   console.log('Name:', audit.workspace.name);
   console.log('Domain:', audit.workspace.domain);
   console.log('Icon:', audit.workspace.iconUrl ?? '(default Slack icon — needs cloudless branding)');
   console.log('');
   console.log('--- Per-message branding (in slack-notify.ts) ---');
   console.log('username:', audit.perMessageBranding.username);
   console.log('icon_url:', audit.perMessageBranding.iconUrl);
   console.log('');
   console.log('--- App-level branding ---');
   console.log('Update at:', audit.appLevelBrandingUrl);
   "
   ```

4. Present the audit results and tell the user:
   - What is already correct (per-message branding)
   - What requires the one-time app dashboard update (app icon, name, description, color)
   - Whether the workspace icon needs updating (admin action)

5. If the workspace icon is the Slack default (`iconUrl: null`), remind the user to upload the cloudless logo at the workspace settings URL above.

## Asset reference

| Asset | Path in repo | Public URL |
|-------|-------------|-----------|
| 512×512 PNG icon | `public/icons/icon-512.png` | `https://cloudless.gr/icons/icon-512.png` |
| 512×512 maskable | `public/icons/icon-512-maskable.png` | `https://cloudless.gr/icons/icon-512-maskable.png` |
| 192×192 PNG icon | `public/icons/icon-192.png` | `https://cloudless.gr/icons/icon-192.png` |

Use `icon-512.png` for the Slack app icon (Slack recommends 512×512 PNG, square, no transparent background for best results).
