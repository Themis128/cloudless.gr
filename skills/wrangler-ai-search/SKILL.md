---
name: wrangler-ai-search
description: Cloudflare AI Search integration - managed semantic search with vector embeddings and LLM-powered Q&A. Use with wrangler ai-search CLI commands and Workers integration.
triggers: when the user mentions "ai-search", "wrangler ai-search", "cloudflare ai search", "semantic search", "vector search", "documentation search"
---

# Wrangler AI Search Integration

## Overview
Cloudflare AI Search is a managed semantic search service that combines vector search with LLM-powered question answering. Use this skill when working with `wrangler ai-search` commands for document indexing, semantic search, and search-enabled agents.

## Installation

Update Wrangler to latest version to get AI Search commands:

```bash
npm install -g wrangler@latest
# or
pnpm add -g wrangler@latest
```

## Commands Reference

### List AI Search Instances
```bash
# List all instances in default namespace
npx wrangler ai-search list

# In specific namespace
npx wrangler ai-search list --namespace docs

# JSON output
npx wrangler ai-search list --json
```

### Create AI Search Instance
```bash
# Create with R2 source
npx wrangler ai-search create cloudless-docs \
  --source datalake-bucket \
  --type r2 \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/meta/llama-3.1-8b-instruct \
  --chunk-size 512 \
  --chunk-overlap 64 \
  --max-num-results 10 \
  --hybrid-search

# Create with web source
npx wrangler ai-search create website-search \
  --source "https://cloudless.gr" \
  --type web \
  --embedding-model @cf/baai/bge-large-en-v1.5
```

### Search AI Search Instance
```bash
# Basic search
npx wrangler ai-search search cloudless-docs --query "how to deploy workers"

# With filters
npx wrangler ai-search search cloudless-docs \
  --query "deployment guide" \
  --filter type=docs \
  --filter lang=en \
  --max-num-results 5

# JSON output
npx wrangler ai-search search cloudless-docs --query "cloud architecture" --json
```

## Namespace Management

```bash
npx wrangler ai-search namespace create docs --description "Documentation search"
npx wrangler ai-search namespace list
npx wrangler ai-search namespace get docs
npx wrangler ai-search namespace delete docs --force
```

## Indexing Jobs

```bash
npx wrangler ai-search jobs create cloudless-docs
npx wrangler ai-search jobs list cloudless-docs
npx wrangler ai-search jobs get cloudless-docs job_abc123
npx wrangler ai-search jobs cancel cloudless-docs job_abc123 --force
npx wrangler ai-search jobs logs cloudless-docs job_abc123
```

## Use Cases for cloudless.gr

### Documentation Search Service
```bash
npx wrangler ai-search namespace create dev-docs

npx wrangler ai-search create main-docs \
  --namespace dev-docs \
  --source app-media-bucket \
  --type r2 \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/meta/llama-3.1-8b-instruct \
  --chunk-size 512 \
  --chunk-overlap 64 \
  --hybrid-search \
  --cache \
  --prefix "documentation/"
```

## Integration with Workers

Example Worker handler using AI Search:

```typescript
import { Resource } from "sst";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response("Missing query parameter", { status: 400 });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai-search/namespaces/dev-docs/instances/main-docs/search`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      }
    );

    const results = await response.json();
    return Response.json(results);
  }
};
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `unknown command 'ai-search'` | Update Wrangler to latest version |
| `R2 source not found` | Verify bucket name and API token permissions |
| `Indexing job stuck` | Check job logs, verify source data exists |
| `No results returned` | Enable hybrid search, adjust score-threshold |

## Related Skills
- `skills/sst-cloudflare/SKILL.md` - SST Cloudflare provider
- `skills/sst-cloudflare-ai.md` - Workers AI integration