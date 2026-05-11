# Slack Invite

Invite one or more team members (by email) to the cloudless.gr Slack channels.

## Usage

```
/slack-invite <email> [<email2> …] [--channels <chan1,chan2>]
```

If `--channels` is omitted the user is invited to all 6 channels: bookings, orders, errors, deployments, contacts, subscribers.

## Steps

1. Read `src/lib/slack-users.ts` and `src/lib/slack-admin.ts` to understand `lookupUserByEmail`, `resolveEmailToUserId`, and `inviteToChannel`.

2. Read `src/lib/integrations.ts` and resolve `SLACK_BOT_TOKEN` from `.env.local` or the integrations config.
   Required scopes: `users:read.email`, `channels:manage` (or `groups:write` for private), `channels:write.invites`.

3. For each email provided:

   a. Call `lookupUserByEmail(email, token)` to resolve the Slack user ID.
      - If the result is `null`, report "User not found for `{email}` — they may not be in the workspace yet."
      - If the error is `missing_scope`, tell the user to add `users:read.email` at https://api.slack.com/apps → OAuth & Permissions.

   b. Call `inviteToChannel(channelId, [userId], token)` for each target channel.
      - Use `listChannels(token)` to map channel names to IDs.
      - Skip channels where the user is already a member (error `already_in_channel` → not a failure).

4. Report a table:

   | Email | Slack ID | Channel | Result |
   |-------|----------|---------|--------|
   | … | … | #bookings | ✅ invited / ⚠️ already member / ❌ error |

5. If the bot token lacks `channels:write.invites` scope, tell the user exactly where to add it:
   - https://api.slack.com/apps → select your app → OAuth & Permissions → Bot Token Scopes → Add `channels:write.invites`
   - Reinstall the app to the workspace after saving.

## Example script

```bash
npx tsx -e "
import { lookupUserByEmail, resolveEmailToUserId } from './src/lib/slack-users.js';
import { listChannels, inviteToChannel } from './src/lib/slack-admin.js';
import { getSlackConfigAsync } from './src/lib/integrations.js';

const { SLACK_BOT_TOKEN: token } = await getSlackConfigAsync();
const email = process.argv[1] ?? 'user@example.com';

const userId = await resolveEmailToUserId(email, token);
if (!userId) { console.log('User not found'); process.exit(1); }

const channels = await listChannels(token);
for (const ch of channels.filter(c => ['bookings','orders','errors','deployments','contacts','subscribers'].includes(c.name))) {
  try {
    await inviteToChannel(ch.id, [userId], token);
    console.log(\`✅ #\${ch.name}\`);
  } catch (e) {
    console.log(\`❌ #\${ch.name}: \${e.message}\`);
  }
}
"
```
