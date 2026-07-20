# Wrangler AI Search Integration

## Overview
Cloudflare AI Search is a managed semantic search service that combines vector search with LLM-powered question answering. Use this skill when working with `wrangler ai-search` commands for document indexing, semantic search, and search-enabled agents.

## Installation

Update Wrangler to latest version (Jul 8, 2026+) to get AI Search commands:

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

### Get AI Search Instance Details
```bash
npx wrangler ai-search get cloudless-docs --namespace docs
npx wrangler ai-search get cloudless-docs --json
```

### Update AI Search Instance
```bash
# Update models
npx wrangler ai-search update cloudless-docs \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/deepseek-ai/deepseek-r1-distill-qwen-32b

# Toggle features
npx wrangler ai-search update cloudless-docs --reranking
npx wrangler ai-search update cloudless-docs --cache
```

### Delete AI Search Instance
```bash
npx wrangler ai-search delete cloudless-docs --force
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

### Get Usage Statistics
```bash
npx wrangler ai-search stats cloudless-docs
npx wrangler ai-search stats cloudless-docs --json
```

## Namespace Management

### List Namespaces
```bash
npx wrangler ai-search namespace list
npx wrangler ai-search namespace list --search docs
```

### Create Namespace
```bash
npx wrangler ai-search namespace create docs \
  --description "Documentation search for cloudless.gr"
```

### Get Namespace Details
```bash
npx wrangler ai-search namespace get docs
```

### Update Namespace
```bash
npx wrangler ai-search namespace update docs \
  --description "Updated description with max 256 chars"
```

### Delete Namespace
```bash
npx wrangler ai-search namespace delete docs --force
```

## Indexing Jobs

### List Indexing Jobs
```bash
npx wrangler ai-search jobs list cloudless-docs
```

### Create Indexing Job
```bash
npx wrangler ai-search jobs create cloudless-docs \
  --description "Initial indexing of documentation"
```

### Get Job Details
```bash
npx wrangler ai-search jobs get cloudless-docs job_abc123
```

### Cancel Job
```bash
npx wrangler ai-search jobs cancel cloudless-docs job_abc123 --force
```

### Get Job Logs
```bash
npx wrangler ai-search jobs logs cloudless-docs job_abc123 --per-page 50
```

## Use Cases for cloudless.gr

### Documentation Search Service
Create AI Search for dev docs and technical articles:

```bash
# Namespace: dev-docs
npx wrangler ai-search namespace create dev-docs

# Instance: main docs
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

### Blog Content Search
Create AI Search for blog posts:

```bash
# Namespace: blog
npx wrangler ai-search namespace create blog

# Instance: blog posts
npx wrangler ai-search create posts \
  --namespace blog \
  --source datalake-bucket \
  --type r2 \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/meta/llama-3.1-8b-instruct \
  --chunk-size 1024 \
  --reranking \
  --prefix "blog/" \
  --include-items "*.md" "*.html"
```

## Integration with Workers

Example Worker handler using AI Search:

```typescript
// src/workers/ai-search.ts
import { Resource } from "sst";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    
    if (!query) {
      return new Response("Missing query parameter", { status: 400 });
    }
    
    // Call AI Search API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai-search/v1/search/main-docs`,
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

## Common Workflows

### Initial Setup
```bash
# 1. Create namespace
npx wrangler ai-search namespace create docs

# 2. Create instance
npx wrangler ai-search create docs-search \
  --namespace docs \
  --source app-media-bucket \
  --type r2 \
  --embedding-model @cf/baai/bge-large-en-v1.5 \
  --generation-model @cf/meta/llama-3.1-8b-instruct

# 3. Trigger indexing
npx wrangler ai-search jobs create docs-search
```

### Query from Chat
```typescript
// src/lib/ai-search-chat.ts
async function searchDocs(query: string) {
  const response = await fetch(
    `${process.env.AI_SEARCH_ENDPOINT}/${process.env.AI_SEARCH_INSTANCE}/search`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.CF_API_TOKEN}` },
      body: JSON.stringify({ query })
    }
  );
  return response.json();
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `unknown command 'ai-search'` | Update Wrangler to latest version |
| `R2 source not found` | Verify bucket name and API token permissions |
| `Indexing job stuck` | Check job logs, verify source data exists |
| `No results returned` | Adjust score-threshold, try hybrid search |
| `Rate limited` | Add caching, reduce query frequency |

## Related Skills
- `skills/sst-cloudflare/SKILL.md` - SST Cloudflare provider
- `skills/sst-cloudflare-ai.md` - Workers AI integration