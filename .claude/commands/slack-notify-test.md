# Slack Notify Test

Send a test ping to every dedicated Slack channel to verify the bot is a member and messages are routing correctly.

## Steps

1. Read `src/lib/slack-notify.ts` and `src/lib/slack-admin.ts` to understand the current channel list and notifier functions.

2. Check that `SLACK_BOT_TOKEN` is set (`.env.local` or environment). If not, tell the user and stop.

3. For each notifier, call the function with realistic dummy data and report success/failure:

   | Notifier                 | Channel        | Test data to use                                      |
   |--------------------------|----------------|-------------------------------------------------------|
   | `slackSubscriberNotify`  | `#subscribers` | `email: "test@example.com"`                          |
   | `slackContactNotify`     | `#contacts`    | name, email, company, service, short message          |
   | `slackBookingNotify`     | `#bookings`    | name, email, start = now+1h, meetLink = "#"           |
   | `slackOrderNotify`       | `#orders`      | email, amount = "€1,500", sessionId = "cs_test_abc"  |
   | `slackErrorNotify`       | `#errors`      | title, message, route = "/api/test", Error object    |
   | `slackDeployNotify`      | `#deployments` | version, stage = "production", status = "succeeded"  |

4. Use a small tsx/Node script to import and call each function:
   ```bash
   npx tsx -e "
   import {
     slackSubscriberNotify, slackContactNotify, slackBookingNotify,
     slackOrderNotify, slackErrorNotify, slackDeployNotify,
   } from './src/lib/slack-notify.js';

   await slackSubscriberNotify('test@example.com');
   await slackContactNotify({ name: 'Test User', email: 'test@example.com', company: 'ACME', service: 'Cloud Audit', message: 'This is a test message from /slack-notify-test.' });
   await slackBookingNotify({ name: 'Test User', email: 'test@example.com', start: new Date(Date.now() + 3600_000).toISOString(), meetLink: 'https://meet.google.com/test' });
   await slackOrderNotify({ email: 'test@example.com', amount: '€1,500', sessionId: 'cs_test_abc123456789' });
   await slackErrorNotify({ title: 'Test error', message: 'This is a test error from /slack-notify-test.', route: '/api/test', error: new Error('boom') });
   await slackDeployNotify({ version: '0.0.0-test', stage: 'production', actor: 'Claude Code', commitSha: 'abc1234', status: 'succeeded' });

   console.log('All test messages sent.');
   "
   ```

5. Report which channels received the message successfully (true) and which failed (false / error).

6. If any channel returns `channel_not_found`, prompt the user to run `/slack-channels-setup` first.
