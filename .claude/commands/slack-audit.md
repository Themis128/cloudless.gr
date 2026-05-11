# Slack Audit

Full audit of the cloudless.gr Slack setup: channels, bot membership, topics, and notification routing.

## Steps

1. Read `src/lib/slack-admin.ts`, `src/lib/slack-notify.ts`, and `src/lib/slack-workspace.ts` to understand the expected channel registry and routing.

2. Resolve `SLACK_BOT_TOKEN` from `.env.local` or integrations config.

3. **Channel audit** — call `listChannels(token)` and compare against `SLACK_CHANNELS` registry:

   For each expected channel, report:
   - Exists in workspace: yes / no
   - Bot is a member: yes / no
   - Topic matches expected: yes / mismatch / empty
   - Action taken (if any): created / joined / topic updated

4. **Routing audit** — verify `slack-notify.ts` has a dedicated client for every channel:

   | Channel | Notifier function | Dedicated client |
   |---------|-------------------|-----------------|
   | #bookings | `slackBookingNotify` | `bookingsClient` |
   | #orders | `slackOrderNotify` | `ordersClient` |
   | #errors | `slackErrorNotify` | `errorsClient` |
   | #deployments | `slackDeployNotify` | `deploymentsClient` |
   | #contacts | `slackContactNotify` | `contactsClient` |
   | #subscribers | `slackSubscriberNotify` | `subscribersClient` |

5. **Bot identity audit** — call `getBotInfo(token)` from `slack-workspace.ts`:
   - Report bot user ID, display name, workspace name
   - Confirm the in-message `username` and `icon_url` match the expected cloudless.gr branding

6. **Scope audit** — check the token for required scopes by inspecting the `X-OAuth-Scopes` response header from `auth.test`. Report any missing scopes:

   | Scope | Purpose | Status |
   |-------|---------|--------|
   | `channels:manage` | Create public channels | |
   | `channels:read` | List channels | |
   | `channels:write.invites` | Invite users | |
   | `groups:write` | Create private channels | |
   | `chat:write` | Post messages | |
   | `users:read` | List users | |
   | `users:read.email` | Look up by email | |
   | `team:read` | Read workspace info | |

7. Output a summary:
   - **All OK** if everything passes
   - **Action required** list with specific steps for anything missing

## Example script

```bash
npx tsx -e "
import { listChannels, SLACK_CHANNELS, ensureAllChannels } from './src/lib/slack-admin.js';
import { getBotInfo, getWorkspaceInfo } from './src/lib/slack-workspace.js';
import { getSlackConfigAsync } from './src/lib/integrations.js';

const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
if (!token) { console.error('SLACK_BOT_TOKEN not set'); process.exit(1); }

const [bot, workspace, channels] = await Promise.all([
  getBotInfo(token),
  getWorkspaceInfo(token),
  listChannels(token),
]);

console.log('Bot:', bot.botName, '| Workspace:', workspace.name, '(', workspace.domain, ')');
console.log('Workspace icon:', workspace.iconUrl ?? '(default — needs update)');
console.log('');

for (const [key, { name, topic }] of Object.entries(SLACK_CHANNELS)) {
  const ch = channels.find(c => c.name === name);
  const exists = ch ? '✅' : '❌ MISSING';
  const member = ch?.is_member ? '✅' : '❌ NOT MEMBER';
  console.log(\`#\${name}: exists=\${exists} member=\${member}\`);
}
"
```
