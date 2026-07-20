---
name: sst-cloudflare
description: SST (v4) Cloudflare provider integration - deploy Workers, D1 databases, R2 buckets, Queues, and Cron triggers using SST infrastructure-as-code. Replacement for Wrangler-only workflows.
triggers: when the user mentions "sst deploy", "sst cloudflare", "sst worker", "sst d1", "sst r2", "sst bucket", "sst queue", "sst cron", "sst ai", "SST config", "sst.config", "cloudflare provider sst", "sst add cloudflare"
---

# SST Cloudflare Provider Integration

## Overview

SST v4 includes native Cloudflare provider support for deploying Workers, D1 databases, R2 buckets, Queues, and Cron triggers as infrastructure-as-code. This replaces Wrangler-only workflows with a unified SST configuration.

## Install SST Cloudflare Provider

```bash
# Add the Cloudflare provider to your SST app
sst add cloudflare
```

This adds the provider to your `sst.config.ts`:

```typescript
// sst.config.ts
{
  providers: {
    cloudflare: "5.37.1",
  },
}
```

## Credentials Setup

Create an API token in Cloudflare dashboard under **Manage Account > API Tokens**:

1. Start with **Edit Cloudflare Workers** template
2. Add permissions:
   - Account - D1 - Edit
   - Account - R2 - Edit
   - Zone - DNS - Edit
   - Account - Cloudflare Workers KV - Edit (if using KV)
   - Account - Queue - Edit (if using Queues)

Set environment variables:

```bash
export CLOUDFLARE_API_TOKEN="your_api_token_here"
export CLOUDFLARE_DEFAULT_ACCOUNT_ID="your_account_id"
```

For multiple accounts:

```typescript
const provider = new cloudflare.Provider("AnotherProvider", {
  apiToken: "another_token",
});

const worker = new sst.cloudflare.Worker("MyWorker", {
  handler: "index.ts",
  accountId: "another_account_id",
}, { provider });
```

## Available Components

### Worker

Create a Cloudflare Worker that handles HTTP requests:

```typescript
// sst.config.ts
const worker = new sst.cloudflare.Worker("MyWorker", {
  handler: "./index.ts",
  url: true,  // Enables a public URL
  link: [db, bucket],  // Link resources
  compatibility: {
    date: "2025-05-05",  // Default compatibility date
    flags: ["nodejs_compat"],  // Default: nodejs_compat
  },
});

return {
  url: worker.url,
};
```

**Handler implementation (ES Module format):**

```typescript
// index.ts
import { Resource } from "sst";

export default {
  async fetch(req: Request) {
    // Access linked resources via Resource
    const row = await Resource.MyDatabase.prepare(
      "SELECT id FROM todo ORDER BY id DESC LIMIT 1"
    ).first();
    return Response.json(row);
  },
};
```

**Worker Component Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `handler` | string | Path to handler file (required) |
| `url` | boolean | Enable dedicated endpoint (default: false) |
| `link` | any[] | Resources to link (D1, Bucket, KV, Queue, AI) |
| `compatibility.date` | string | Compatibility date (default: "2025-05-05") |
| `compatibility.flags` | string[] | Compatibility flags (default: ["nodejs_compat"]) |
| `domain.name` | string | Custom domain |
| `domain.redirects` | string[] | Redirect alternate domains |
| `domain.aliases` | string[] | Keep visitors on alias domains |
| `environment` | Record | Worker environment variables |
| `migrations` | WorkerDurableObjectMigration[] | Durable Object migrations |
| `placement.mode` | string | Smart placement ("smart") |
| `placement.region` | string | Explicit region (e.g., "aws:us-east-1") |
| `build.minify` | boolean | Minify code (default: true) |
| `build.install` | string[] | npm packages to install at bundle time |

**SDK Access in Handler:**

```typescript
import { Resource } from "sst";

// Access linked Worker (service binding)
await Resource.WorkerB.fetch(request);

// Access linked D1 database
await Resource.MyDatabase.prepare("SELECT * FROM table").all();

// Access linked Bucket
await Resource.MyBucket.put(key, data);
await Resource.MyBucket.get(key);
```

### D1 (Database)

SQLite-compatible database on Cloudflare:

```typescript
const db = new sst.cloudflare.D1("MyDatabase");

const worker = new sst.cloudflare.Worker("MyWorker", {
  handler: "./index.ts",
  link: [db],
  url: true,
});
```

Apply migrations after deploy:

```bash
npx wrangler d1 migrations apply MyDatabase
# Or via SST:
pnpm sst:infra:deploy
```

### Bucket (R2 Storage)

R2 object storage for Workers:

```typescript
const bucket = new sst.cloudflare.Bucket("MyBucket");

// In your handler:
await Resource.MyBucket.put(key, data, {
  httpMetadata: { contentType: "text/plain" },
});

const result = await Resource.MyBucket.get(key);
```

### Queue

Async message queue with consumer:

```typescript
const queue = new sst.cloudflare.Queue("MyQueue");
queue.subscribe("consumer.ts");

const producer = new sst.cloudflare.Worker("Producer", {
  handler: "producer.ts",
  link: [queue],
});

// Producer sends messages:
await Resource.MyQueue.send({ message: "hello" });

// Consumer handles them:
export default {
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      console.log(msg.body.message);
    }
  },
};
```

### Cron (Scheduled Jobs)

Scheduled workers using cron expressions:

```typescript
const job = new sst.cloudflare.Cron("AnalyticsRollup", {
  schedule: "0 1 * * *",  // Daily at 01:00 UTC
  job: {
    handler: "./cron-handler.ts",
    link: [db],
  },
});
```

Cron uses Worker syntax - no special CRON_ROUTE handling needed in SST v4.

### AI Binding

Workers AI integration:

```typescript
const ai = new sst.cloudflare.Ai("MyAi");

const worker = new sst.cloudflare.Worker("AiWorker", {
  handler: "./ai-handler.ts",
  link: [ai],
});

// In handler:
const response = await Resource.MyAi.run(
  "@cf/meta/llama-3.1-8b-instruct",
  { prompt: "Hello" }
);
```

### KV (Key-Value Store)

Workers KV namespace:

```typescript
const kv = new sst.cloudflare.Kv("MyKv");

// In handler:
await Resource.MyKv.put("key", "value");
const value = await Resource.MyKv.get("key");
```

### DNS

Custom domain management:

```typescript
const worker = new sst.cloudflare.Worker("MyWorker", {
  handler: "./index.ts",
  url: "myworker.example.com",
});
```

Or with redirects and aliases:

```typescript
const worker = new sst.cloudflare.Worker("MyWorker", {
  handler: "./index.ts",
  domain: {
    name: "app1.domain.com",
    redirects: ["www.domain.com"],  // Redirect to main
    aliases: ["app2.domain.com"],   // Keep visitors on alias
  },
});
```

## Hybrid Architecture (cloudless.gr)

The current architecture uses SST for AWS resources and Wrangler for Workers:

```
┌─────────────────────────────────────────────────────────┐
│                    SST Infrastructure                   │
│                     (sst.config.ts)                     │
│                                                         │
│  ├── Next.js Lambda (site)                              │
│  ├── DynamoDB (transactions)                           │
│  ├── Cron Jobs (analytics rollup, etc.)                 │
│  └── Route 53 failover records                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           Workers Layer (Wrangler-managed)              │
│                                                         │
│  ├── Worker Entry (src/index.ts)                        │
│  ├── D1 Database (user-auth-db)                         │
│  ├── R2 Buckets (assets, analytics, media)               │
│  ├── Durable Objects (agents)                           │
│  └── Service Bindings (chat, admin)                     │
└─────────────────────────────────────────────────────────┘
```

**Note:** SST v4 Cloudflare provider requires `home: "cloudflare"` in config for state management.

## Commands

```bash
# Deploy SST infrastructure
pnpm sst:infra:deploy

# Build Next.js for Workers
pnpm cf:build

# Deploy Worker
pnpm cf:deploy

# Full deployment
pnpm deploy

# List resources
pnpm sst:list --config sst.config.cf-infra.ts --stage production

# Get outputs
pnpm sst:outputs --config sst.config.cf-infra.ts --stage production

# Remove all resources
pnpm sst:infra:remove

# Validate config
pnpm sst:validate
```

## Service Bindings Between Workers

When you link a worker to another worker, SST creates a service binding:

```typescript
const workerA = new sst.cloudflare.Worker("WorkerA", {
  handler: "worker-a.ts",
});

const workerB = new sst.cloudflare.Worker("WorkerB", {
  handler: "worker-b.ts",
  link: [workerA],  // Creates service binding
});

// In worker-b.ts, call worker-a:
await Resource.WorkerA.fetch(request);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| D1 connection errors | Check `AUTH_DB` binding in wrangler.jsonc matches database ID |
| R2 access denied | Verify bucket names match between SST config and Wrangler |
| Cron jobs not firing | Verify schedule syntax and worker deployment |
| Service binding failures | Ensure all bound Workers are deployed as separate services |
| Worker not starting | Check Node.js compatibility flags and build config |
| KV namespace not found | Verify KV binding name matches Resource access |

## Related Skills

- `skills/cloudflare-tunnel-ops/SKILL.md` - Cloudflare Tunnel management
- `skills/cloudflare-token-doctor/SKILL.md` - API token management
- `skills/cloudless-architecture/SKILL.md` - Overall architecture patterns