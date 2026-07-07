---
name: bedrock-chat
description: Bedrock-powered chat widget for cloudless.gr. Use when the user asks about the chat widget, Anthropic credits, Bedrock configuration, chat API errors, tool use, SSE streaming, or the /api/chat route. Triggers on "chat", "widget", "Bedrock", "Anthropic", "tool use", "lookup_product", "calendar availability", "chat broken", "503 chat".
allowed-tools: mcp__cloudless-infra__aws_get_ssm_parameters, mcp__cloudless-infra__cluster_run_command
---

# Bedrock Chat Widget — cloudless.gr

## Overview

`/api/chat` uses **AWS Bedrock Converse API** (IAM auth, no Anthropic credits needed).
Model: `us.anthropic.claude-3-5-haiku-20241022-v1:0` (US cross-region inference profile).

**Why Bedrock?** Anthropic direct API requires prepaid credits; Bedrock is pay-per-token billed to the AWS account.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/bedrock-chat.ts` | Bedrock client, tool-config conversion, `runBedrockChatLoop()` |
| `src/app/api/chat/route.ts` | Next.js route — parses input, calls loop, streams SSE |
| `src/lib/chat-tools.ts` | Tool schemas (Anthropic `input_schema` format) + `runTool()` |
| `__tests__/chat-api.test.ts` | 11 unit tests mocking `BedrockRuntimeClient` |

## Architecture

```
POST /api/chat
  └─▶ parseMessages()          — validate + trim to last 10 turns
  └─▶ runBedrockChatLoop()     — Bedrock Converse tool-use loop (max 4 iterations)
        ├─▶ ConverseCommand    — sends messages + toolConfig to Bedrock
        ├─▶ stopReason == "tool_use" → executeToolBlocks() → runTool()
        └─▶ stopReason == "end_turn" → return final text
  └─▶ sseStreamFromText()      — emit data: {"text":"..."} chunks + data: [DONE]
```

## Bedrock vs Anthropic API Differences

| Aspect | Bedrock Converse | Anthropic direct |
|--------|-----------------|-----------------|
| Auth | IAM role/user | `x-api-key` header |
| Client | `BedrockRuntimeClient.send(ConverseCommand)` | `fetch("api.anthropic.com/v1/messages")` |
| Tool format | `toolSpec.inputSchema.json` | `input_schema` |
| Stop reason | `response.stopReason` | `response.stop_reason` |
| Text block | `{ text: "..." }` | `{ type: "text", text: "..." }` |
| Tool use | `{ toolUse: { toolUseId, name, input } }` | `{ type: "tool_use", id, name, input }` |
| Tool result | `{ toolResult: { toolUseId, content: [{text}] } }` | `{ type: "tool_result", tool_use_id, content }` |
| Message content | Always array of blocks | String or array |

## Tool Config Conversion

`CHAT_TOOLS` in `chat-tools.ts` uses Anthropic's `input_schema` format.
`bedrock-chat.ts` converts at module load time:

```typescript
const BEDROCK_TOOL_CONFIG: ToolConfiguration = {
  tools: CHAT_TOOLS.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.input_schema as unknown as Record<string, any> },
    },
  })) as ToolConfiguration["tools"],
};
```

The `as ToolConfiguration["tools"]` cast is required because Bedrock's `Tool` type is a smithy-generated discriminated union requiring a `$unknown` member — otherwise TypeScript errors.

## Available Tools

| Tool | Trigger | Implementation |
|------|---------|----------------|
| `lookup_product` | Visitor asks about services/pricing | Searches live Stripe catalog, returns name/price/URL |
| `check_calendar_availability` | Visitor asks to book/see slots | Queries Google Calendar free slots (SSM creds required — uses `isConfiguredAsync`) |
| `book_slot` | Visitor picks a slot + provides name/email | Calls `bookConsultation()` → GCal event + Meet link + email invite |

See `.claude/skills/chat-booking/SKILL.md` for full booking flow and debugging.

## Error Handling (route.ts)

| Error | HTTP Status | Cause |
|-------|------------|-------|
| `AccessDeniedException` | 503 + contact page | IAM policy missing on execution role/user |
| `UnauthorizedException` | 503 + contact page | Same |
| Any other Bedrock error | 502 | Throttling, model unavailable, transient |
| Invalid body / empty messages | 400 | Client-side validation |

## IAM Requirements

### Lambda (PRIMARY — cloudless.gr via CloudFront)
Managed via `sst.config.ts` `permissions` field — applied automatically on deploy:
```typescript
permissions: [
  {
    actions: ["bedrock:InvokeModel", "bedrock:Converse"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
      "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0",
    ],
  },
],
```

### cloudless-pi-standby (SECONDARY — pi-origin.cloudless.gr via Pi k3s)
**Must be added manually** — the GH Actions OIDC role cannot call `iam:PutUserPolicy` on IAM users.
Note: the k3s pod credential is `cloudless-pi-standby` (key `AKIAUBXIAELU7NG7LBAQ` in the
`pi-standby-aws-creds` secret). `omv-main-cli` is the Pi **node's** own IAM user — different user.
```bash
aws iam put-user-policy \
  --user-name cloudless-pi-standby \
  --policy-name BedrockChatAccess \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["bedrock:InvokeModel","bedrock:Converse"],
      "Resource":[
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
        "arn:aws:bedrock:us-east-1:278585680617:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0"
      ]
    }]
  }'
```
IAM permissions take effect immediately — no pod restart needed after applying.

## Testing

```bash
# Run all chat-api tests
pnpm exec vitest run __tests__/chat-api.test.ts --reporter=verbose

# Expected: 11/11 passing
```

### Mock pattern (vitest)
`BedrockRuntimeClient` and `ConverseCommand` are classes — mock them with `function` (not arrow function) so `new` works:

```typescript
const { mockSend, MockConverseCommand } = vi.hoisted(() => {
  const mockSend = vi.fn();
  function MockConverseCommandImpl(this: unknown, input: any) { void input; }
  const MockConverseCommand = vi.fn(MockConverseCommandImpl);
  return { mockSend, MockConverseCommand };
});

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  function BedrockRuntimeClientImpl(this: any) { this.send = mockSend; }
  return {
    BedrockRuntimeClient: vi.fn(BedrockRuntimeClientImpl),
    ConverseCommand: MockConverseCommand,
  };
});
```

### Mock response helpers
```typescript
function bedrockTextResponse(text: string) {
  return { stopReason: "end_turn", output: { message: { role: "assistant", content: [{ text }] } } };
}
function bedrockToolResponse(toolUseId: string, name: string, input: object) {
  return { stopReason: "tool_use", output: { message: { role: "assistant", content: [{ toolUse: { toolUseId, name, input } }] } } };
}
```

## Debugging Chat on Production

### Lambda (cloudless.gr)
Check CloudWatch logs for `[chat]` prefix:
```
[chat] tool_use lookup_product    ← tool was called
[chat] hit MAX_TOOL_ITERATIONS    ← loop cap hit (shows fallback message)
[chat] bedrock loop failed: ...   ← Bedrock error (check IAM if AccessDeniedException)
```

### Pi (pi-origin.cloudless.gr)
```
cluster_run_command(node: "omv-main",
  command: "kubectl logs -n cloudless deployment/cloudless --tail=50 | grep '\\[chat\\]'")
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_TOOL_ITERATIONS` | 4 | Max Bedrock turns before fallback |
| `MAX_TOKENS` | 600 | Max tokens per Bedrock response |
| `MAX_TURNS` | 10 | Max message history sent to Bedrock |
| `MAX_USER_MESSAGE` | 500 | Max chars per user message (trimmed) |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | Override via `BEDROCK_MODEL_ID` env var |
