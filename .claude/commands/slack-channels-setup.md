# Slack Channels Setup

Provision all required Slack channels for cloudless.gr and ensure the bot is a member of each.

## Channels to provision

| Channel        | Purpose                                              |
|----------------|------------------------------------------------------|
| `#bookings`    | New consultation bookings from cloudless.gr          |
| `#orders`      | Stripe orders and payments from cloudless.gr         |
| `#errors`      | Application errors and exceptions from cloudless.gr  |
| `#deployments` | Deploy events from the cloudless.gr CI pipeline      |
| `#contacts`    | Contact form submissions from cloudless.gr           |
| `#subscribers` | Newsletter subscriber sign-ups from cloudless.gr     |

## Steps

1. Read `src/lib/slack-admin.ts` to understand the `ensureAllChannels()` function and `SLACK_CHANNELS` registry.

2. Check whether a `SLACK_BOT_TOKEN` is available:
   - Look in `.env.local`, `.env`, or ask the user if not found.
   - The token must have scopes: `channels:manage`, `channels:read`, `channels:write.invites`, `groups:write`, `groups:read`.

3. Run `ensureAllChannels()` by executing a small Node script:

   ```bash
   node --input-type=module << 'EOF'
   import { ensureAllChannels } from "./src/lib/slack-admin.js";
   const results = await ensureAllChannels();
   for (const [key, r] of Object.entries(results)) {
     const status = r.created ? "created" : r.joined ? "joined" : "already ok";
     console.log(`#${r.name} (${key}): ${status} — ID: ${r.id}`);
   }
   EOF
   ```

   Or, if the project uses ts-node / tsx:

   ```bash
   npx tsx -e "
   import { ensureAllChannels } from './src/lib/slack-admin.js';
   const r = await ensureAllChannels();
   console.table(r);
   "
   ```

4. Report which channels were **created**, which were **joined** (existed but bot wasn't a member), and which were **already ok**.

5. If any channel fails with a scope error, tell the user exactly which OAuth scope is missing and where to add it in the Slack App settings (<https://api.slack.com/apps> → OAuth & Permissions → Bot Token Scopes).

6. After all channels are provisioned, confirm that `slack-notify.ts` already routes every notification type to the correct channel:
   - `slackSubscriberNotify` → `#subscribers`
   - `slackContactNotify`    → `#contacts`
   - `slackBookingNotify`    → `#bookings`
   - `slackOrderNotify`      → `#orders`
   - `slackErrorNotify`      → `#errors`
   - `slackDeployNotify`     → `#deployments`
