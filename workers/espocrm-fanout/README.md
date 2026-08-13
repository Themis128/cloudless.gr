# EspoCRM Queues fan-out Worker

Buffers EspoCRM webhook spikes so Pi Slack/n8n fan-out does not share failure modes.

## Flow

```
EspoCRM → Pi /api/webhooks/espocrm → POST this Worker /enqueue → Queue
  → consumer → POST Pi /api/webhooks/espocrm/fanout
```

## Deploy

```bash
cd workers/espocrm-fanout
npx wrangler secret put ESPOCRM_QUEUE_PRODUCER_SECRET
npx wrangler secret put ESPOCRM_FANOUT_CALLBACK_URL   # https://cloudless.gr/api/webhooks/espocrm/fanout
npx wrangler deploy
```

Create queues once:

```bash
npx wrangler queues create espocrm-events
npx wrangler queues create espocrm-events-dlq
```

## Pi env

```
ESPOCRM_QUEUE_PRODUCER_URL=https://espocrm-fanout.<account>.workers.dev/enqueue
ESPOCRM_QUEUE_PRODUCER_SECRET=<same secret>
```

When unset, Pi dispatches Slack/n8n synchronously (previous behaviour).
