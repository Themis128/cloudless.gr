# SST Cloudflare AI Integration Plan

## Current State Analysis

### Workers AI Configuration (Current)
- **Binding**: Configured in `wrangler.jsonc` as `AI` (line 55-57)
- **Model**: `@cf/meta/llama-3.1-8b-instruct` (used in `bedrock-chat.ts`)
- **Usage**: Primary chat path via `ai.run()` in `runWorkersAiChat()` function
- **Fallback**: Bedrock Nova Micro (`us.amazon.nova-micro-v1:0`) when Workers AI fails

### SST Configuration (Current)
- **SST v4** with `home: "aws"` - no native Cloudflare provider support
- Cloudflare infrastructure managed via Wrangler directly
- `sst.config.cf-infra.ts` is a placeholder (not creating resources via SST)

## SST Python SDK - Cloudflare AI Integration Options

### Option 1: Python Worker for AI Tasks (Recommended)

Create a dedicated Python-based Worker using SST Python SDK:

```python
# lambda/ai-worker/index.py (NEW)
from sst import cloudflare

def handler(event, context):
    # Workers AI inference via SST Python SDK
    ai = cloudflare.ai("cloudless-chat-ai")
    result = ai.run(
        "@cf/meta/llama-3.1-8b-instruct",
        {
            "messages": [{"role": "user", "content": event["prompt"]}],
            "max_tokens": 500
        }
    )
    return {"response": result}
```

### Option 2: SST Config for AI Resources

Update `sst.config.cf-infra.ts` to define AI resources:

```typescript
// sst.config.cf-infra.ts (UPDATED)
import { ai } from "sst/cloudflare";

const ai = new $cf.ai("CloudlessChatAI", {
  model: "@cf/meta/llama-3.1-8b-instruct",
  // SST manages the binding automatically
});

// Link to Worker
new $cf.Worker("CloudlessChat", {
  handler: "src/index.ts",
  bindings: [ai],
});
```

### Option 3: Python-based ETL for AI Analytics

Use Python SDK for analytics processing with Workers AI:

```python
# scripts/ai-analytics.py (NEW)
import sst

def process_logs_with_ai(log_chunks: list[str]) -> dict:
    """Analyze log patterns using Workers AI"""
    ai = sst.cloudflare.ai("@cf/meta/llama-3.1-8b-instruct")
    insights = []
    
    for chunk in log_chunks[:10]:  # Max 10 chunks per job
        result = ai.run({
            "prompt": f"Analyze these log entries for anomalies:\n{chunk}",
            "temperature": 0.3,
            "max_tokens": 200
        })
        insights.append(result)
    
    return {"anomalies": insights}
```

## Integration Steps

### Phase 1: Infrastructure (SST + Wrangler)
1. Add missing secrets to GitHub Actions:
   - `CLOUDFLARE_API_TOKEN` (Account:Edit, Workers:Edit scopes)
   - `CF_ACCOUNT_ID` (from Cloudflare dashboard)

2. Update `sst.config.cf-infra.ts` to use SST's Cloudflare provider (if available in SST v4)

### Phase 2: Python Worker Creation
3. Create `lambda/ai-worker/index.py` with:
   - `requirements.txt` for dependencies
   - Handler that uses Workers AI for chat/completions
   - Environment variable support for model selection

4. Add to `wrangler.jsonc`:
   ```json
   {
     "ai": {
       "binding": "AI",
       "models": {
         "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct"
       }
     }
   }
   ```

### Phase 3: Service Binding
5. Update `src/index.ts` to route `/api/chat` to Python worker via service binding

6. Add Python worker to `wrangler.jsonc`:
   ```json
   "services": [{
     "binding": "CHAT_AI",
     "service": "cloudless-ai-worker",
     "entrypoint": "handler"
   }]
   ```

## Current Worker AI Integration (bedrock-chat.ts)

The existing implementation:

```typescript
// src/lib/bedrock-chat.ts:49-78
const WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

async function runWorkersAiChat(
  systemPrompt: string,
  messages: BedrockMessage[]
): Promise<string | null> {
  const ai = getAiBinding();
  if (!ai) return null;

  const workersAiMessages = messages.map((m) => ({
    role: m.role,
    content: (m.content as TextBlock[])
      .filter((b): b is TextBlock => "text" in b && typeof b.text === "string")
      .map((b) => b.text)
      .join(""),
  }));

  try {
    const result = (await ai.run(WORKERS_AI_CHAT_MODEL, {
      messages: [{ role: "system", content: systemPrompt }, ...workersAiMessages],
    })) as { response?: string };
    return result.response ?? null;
  } catch (err) {
    console.warn("[chat] Workers AI chat failed, falling back to Bedrock:", err);
    return null;
  }
}
```

## Python Requirements

For Python-based Workers AI integration, add to `requirements.txt`:

```txt
# For Python Workers AI
cloudflare-py>=1.0.0  # If available
# Or use raw fetch via standard library
```

## Benefits of SST Python SDK Integration

1. **Infrastructure as Code**: Define AI models and bindings in Python
2. **Type Safety**: Python decorators provide type-safe bindings
3. **Multi-language Support**: Mix Python workers with TypeScript workers
4. **SST Benefits**: Automatic secret management, staging environments

## Next Steps

1. **Verify SST Cloudflare AI support** in current SST v4.17.0
2. **Create GitHub issue** for tracking this integration
3. **Add secrets** to unblock workflows (see ACTIONS-REQUIRED.md)
4. **Decide on approach** based on SST's actual Cloudflare support level