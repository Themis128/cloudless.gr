# SST Cloudflare AI Component Integration

## Overview
SST's Cloudflare AI component for managing Workers AI models and bindings. Use this skill when working with SST's Cloudflare infrastructure for AI-powered applications.

**UPDATE**: SST v4 now has native Cloudflare provider support via `sst.cloudflare.Ai`. The `sst.config.cf-infra.ts` should be updated to use the Cloudflare provider.
```

## SST Cloudflare AI Configuration

### Basic AI Component Definition

```typescript
// sst.config.ts (when SST adds Cloudflare provider)
import { ai } from "sst/cloudflare";

// Create an AI binding
export const chatAi = new $cf.ai("ChatAI", {
  models: {
    "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
    "deepseek-coder": "@cf/deepseek-ai/deepseek-coder-6-7b-base",
  }
});

// Link to Worker
export const chatWorker = new $cf.Worker("ChatWorker", {
  handler: "src/workers/chat.py",  // Python handler
  bindings: [chatAi]
});
```

### Python Worker with SST AI Binding

```python
# lambda/ai-worker/index.py
import os
import json

def handler(event, context):
    """
    SST-managed Cloudflare AI worker.
    The AI binding is injected automatically by SST.
    """
    # AI is available via SST binding (not via SDK call)
    # In SST-managed Workers, bindings are injected as environment/secrets
    
    messages = event.get("messages", [])
    system = event.get("system", "")
    
    # Workers AI inference - when SST provides the binding
    # This requires SST to set up the AI binding in the Worker environment
    response = ai.run(
        "@cf/meta/llama-3.1-8b-instruct",
        {
            "messages": [{"role": "system", "content": system}, *messages],
            "max_tokens": 500
        }
    )
    
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"response": response})
    }
```

## Current Integration (Wrangler-Based)

Since SST v4 doesn't have native Cloudflare provider support, use the existing Wrangler setup:

```json
// wrangler.jsonc (CURRENT - works today)
{
  "ai": {
    "binding": "AI"
  }
}
```

```typescript
// src/lib/bedrock-chat.ts (CURRENT IMPLEMENTATION)
const WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

async function runWorkersAiChat(systemPrompt: string, messages: any[]): Promise<string | null> {
  const ai = getAiBinding();
  if (!ai) return null;
  
  const result = (await ai.run(WORKERS_AI_CHAT_MODEL, {
    messages: [{ role: "system", content: systemPrompt }, ...workersAiMessages],
  })) as { response?: string };
  
  return result.response ?? null;
}
```

## SST Cloudflare AI Features (When Available)

### Model Configuration
- Multiple models per binding
- Automatic model routing
- Usage tracking and limits

### Environment Management
- Automatic secret injection
- Staging/production separation
- Cross-stage model aliases

### Service Bindings
- Python Workers calling SST AI
- TypeScript Workers with AI bindings
- Cross-worker AI sharing

## Migration Path

### Current (Stable)
```
wrangler.jsonc → Workers AI binding
src/lib/bedrock-chat.ts → Uses AI binding directly
GitHub secrets → Provide CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID
```

### Future (SST Managed)
```
sst.config.ts → $cf.ai() component
SST → Deploy Worker + AI binding together
GitHub secrets → SST manages via stages
```

## Available Models (Workers AI)

| Model | Use Case | Neurons/Cost |
|-------|----------|--------------|
| `@cf/meta/llama-3.1-8b-instruct` | General chat | Low |
| `@cf/deepseek-ai/deepseek-coder-6-7b-base` | Code generation | Low |
| `@cf/baai/bge-large-en-v1.5` | Embeddings | Very low |
| `@cf/openai/whisper-tiny` | Speech-to-text | Low |

## Implementation Checklist

- [ ] Verify SST version supports Cloudflare provider
- [ ] Create SST AI component definition
- [ ] Migrate Wrangler AI binding to SST
- [ ] Update Worker to use SST binding injection
- [ ] Test AI inference in staging
- [ ] Deploy to production

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AI binding undefined | Check wrangler.jsonc has `ai.binding` configured |
| Model not found | Verify model name is valid at ai.cloudflare.com |
| Rate limited | Workers AI has ~10K neurons/day free tier |
| SST deploy fails | SST v4 requires `home: "aws"` - use Wrangler for now |

## Related Files

- `wrangler.jsonc` - Current Workers AI binding config
- `src/lib/bedrock-chat.ts` - AI integration with fallback
- `sst.config.ts` - AWS SST config (current)
- `sst.config.cf-infra.ts` - Placeholder for Cloudflare SST config