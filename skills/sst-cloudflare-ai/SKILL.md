---
name: sst-cloudflare-ai
description: SST Cloudflare AI component integration - Workers AI and AI Search bindings for SST-managed infrastructure. Enables LLM-powered features in Workers with SST infrastructure-as-code.
triggers: when the user mentions "sst ai", "sst.cloudflare.ai", "cloudflare ai", "workers ai", "ai search", "llama", "bedrock", "@cf/"
---

# SST Cloudflare AI Integration

## Overview

SST v4 supports Cloudflare's AI services through native bindings. This integrates with:

- **Workers AI** (`$cf.Ai`) - On-demand LLM inference via `@cf/*` models
- **AI Search** - Managed semantic search with vector embeddings

## SST Configuration

### AI Binding (Workers AI)

```typescript
// sst.config.cloudflare.ts
export default $config({
  app(input) {
    return {
      name: "cloudless-infra",
      home: "cloudflare", // Required for AI Search state
    };
  },

  async run() {
    // Workers AI binding
    const ai = new sst.cloudflare.Ai("CloudlessChatAI");

    // Worker with AI binding
    const chatWorker = new sst.cloudflare.Worker("ChatWorker", {
      handler: "src/index.ts",
      link: [ai],
      url: true,
    });

    return {
      ai: ai.models,
      chatUrl: chatWorker.url,
    };
  },
});
```

### AI Search Integration

```typescript
// sst.config.cloudflare.ts
async run() {
  // AI Search is managed via Wrangler CLI (not yet SST-native)
  // But Workers can access via Resource binding

  // Create AI Search namespace + instance via Wrangler
  // npx wrangler ai-search create cloudless-docs --source app-media-bucket --type r2

  const worker = new sst.cloudflare.Worker("DocsWorker", {
    handler: "src/workers/docs.ts",
    url: true,
    environment: {
      AI_SEARCH_INSTANCE: "cloudless-docs",
      AI_SEARCH_NAMESPACE: "default",
    },
  });
}
```

## Handler Implementation

### Workers AI in TypeScript

```typescript
// src/index.ts
import { Resource } from "sst";

export default {
  async fetch(request: Request, env, _ctx) {
    const result = await Resource.CloudlessChatAI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "How do I deploy Workers?" }
        ],
        max_tokens: 200
      }
    );

    return Response.json({ response: result });
  }
};
```

### AI Search in Worker

```typescript
// src/workers/docs.ts
export default {
  async fetch(request: Request, env, _ctx) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response("Missing ?q=", { status: 400 });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai-search/namespaces/${env.AI_SEARCH_NAMESPACE}/instances/${env.AI_SEARCH_INSTANCE}/search`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      }
    );

    return Response.json(await response.json());
  }
};
```

## Available Models

| Model | Purpose | Cost |
|-------|---------|------|
| `@cf/meta/llama-3.1-8b-instruct` | Chat completion | Low |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | Reasoning | Medium |
| `@cf/baai/bge-large-en-v1.5` | Embeddings | Very low |
| `@cf/openai/whisper-tiny` | Speech-to-text | Low |

## Chat Tool Integration

The `search_documentation` tool uses AI Search:

```typescript
// src/lib/ai-search.ts
export async function searchAiDocs(query: string, namespace?: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai-search/namespaces/${namespace || "docs"}/instances/cloudless-docs/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    }
  );
  return response.json();
}
```

## Commands

```bash
# List AI resources
pnpm sst:infra:deploy --stage production

# Verify AI binding in Wrangler
npx wrangler whoami
npx wrangler ai-search list

# Create AI Search instance
npx wrangler ai-search create cloudless-docs \
  --source app-media-bucket \
  --type r2 \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/meta/llama-3.1-8b-instruct \
  --hybrid-search

# Trigger indexing
npx wrangler ai-search jobs create cloudless-docs
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AI binding undefined | Check SST config links, redeploy Worker |
| Model not found | Verify model name at ai.cloudflare.com |
| API 401/403 | Verify CLOUDFLARE_API_TOKEN scope |
| No search results | Enable hybrid search, check score-threshold |

## Related Skills

- `skills/sst-cloudflare/SKILL.md` - Full SST Cloudflare provider
- `skills/wrangler-ai-search/SKILL.md` - Wrangler AI Search CLI
