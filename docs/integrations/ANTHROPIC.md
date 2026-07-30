# Anthropic / Claude AI Integration

cloudless.gr uses Claude on two distinct surfaces with different backends:

1. **Public chatbot agent** — `ChatWidget` on every page; calls `/api/chat`. Backed by **AWS Bedrock Converse API** (IAM auth, no API key) with a tool-use loop and three tools (`lookup_product`, `check_calendar_availability`, `book_slot`). The final response is delivered as SSE so the widget keeps its existing event handling.
2. **Admin AI tools** — copy generation, campaign strategy, audience targeting, and report insights under `/api/admin/ai/*`. Uses the **Anthropic Messages API** directly via `src/lib/anthropic.ts`.
3. **Admin assistant** — multi-tool chat agent on `/admin/assistant`; calls `/api/admin/ai/assistant`. Tool-use loop (max 4 iterations) with `search_notion`, `get_recent_orders`, `draft_email` tools. See [Phase 2c in AGENTS_ROADMAP.md](../roadmap/AGENTS_ROADMAP.md).

> **Status:** `/api/chat` returns 503 when `AccessDeniedException` is thrown by Bedrock (IAM misconfiguration) or 502 on transient failures. Admin AI routes return 503 when `ANTHROPIC_API_KEY` is absent. The rest of the site is unaffected.
>
> **Last verified:** 2026-05-17 — `/api/chat` uses AWS Bedrock Converse API (IAM auth). Admin AI routes use `ANTHROPIC_API_KEY`. See log patterns table in the tool-use loop section for CloudWatch monitoring.

---

## Architecture

```mermaid
graph TB
    subgraph Public["Public (all locales)"]
        Widget["ChatWidget.tsx\n(fixed bottom-right)"]
        ChatRoute["/api/chat\nStreaming SSE"]
    end

    subgraph Admin["Admin (auth required)"]
        Copy["/api/admin/ai/copy"]
        Campaign["/api/admin/ai/campaign"]
        Audience["/api/admin/ai/audience"]
        Insights["/api/admin/ai/report-insights"]
    end

    subgraph BedrockLib["src/lib/bedrock-chat.ts"]
        BedrockLoop["runBedrockChatLoop()"]
        Tools["runTool() — chat-tools.ts"]
    end

    subgraph AnthropicLib["src/lib/anthropic.ts"]
        Key["getAnthropicApiKey()"]
        Call["callClaude()"]
        Verify["verifyAnthropicKey()"]
    end

    Widget -->|POST messages| ChatRoute
    ChatRoute --> BedrockLoop
    BedrockLoop -->|ConverseCommand IAM auth| Bedrock["AWS Bedrock\nus.anthropic.claude-haiku-4-5"]
    BedrockLoop --> Tools

    Copy & Campaign & Audience & Insights -->|callClaude + getAnthropicApiKey| Call & Key
    Key -->|getConfig()| SSM["AWS SSM / .env.local"]
    Call -->|POST /v1/messages| Anthropic["api.anthropic.com"]
    Verify -->|1-token ping| Anthropic
```

---

## Environment Variables

### Local development (`.env.local`)

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_CHAT_MODEL=claude-haiku-4-5
```

### Production (AWS SSM Parameter Store)

| Parameter path | Type |
|----------------|------|
| `/cloudless/production/ANTHROPIC_API_KEY` | SecureString |
| `/cloudless/production/ANTHROPIC_CHAT_MODEL` | String (optional) |

---

## Public Chatbot — `ChatWidget`

`src/components/ChatWidget.tsx` is mounted on every page via `src/app/[locale]/layout.tsx`:

```tsx
const ChatWidget = dynamic(() => import("@/components/ChatWidget"));
// ...
<ChatWidget />
```

**Features:**

- Fixed bottom-right floating button, expands to a 380px chat panel
- Streaming responses via SSE — text appears token by token
- Retains last 10 turns for context window management
- Quick-suggestion chips on the first turn
- Graceful degradation: shows a "use Contact page" message if `/api/chat` returns an error

### `/api/chat` route

| Property | Value |
|----------|-------|
| Backend | AWS Bedrock Converse API — IAM auth via Lambda execution role (no API key) |
| Model | `BEDROCK_MODEL_ID` env var or `us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| `maxTokens` | 600 |
| Streaming | SSE (`text/event-stream`) — final assistant text chunk-encoded after tool loop |
| Tools | `lookup_product`, `check_calendar_availability`, `book_slot` (see below) |
| Tool-use loop cap | 4 iterations (`MAX_TOOL_ITERATIONS` in `src/lib/bedrock-chat.ts`) |
| Max history | 10 turns |
| Max message length | 500 chars |
| Auth | None (public endpoint, rate-limited in `src/proxy.ts`) |
| Rate limit | 20 req/min/IP (set in `src/proxy.ts` RATE_LIMITS) |
| 503 when | Bedrock returns `AccessDeniedException` or `UnauthorizedException` |
| 502 when | other Bedrock errors (throttling, model unavailable, iteration cap hit) |

The system prompt positions Claude as "Cloudless Assistant" with knowledge of services, pricing, and how to direct prospects to book a free audit. It also instructs the model to call tools only when their output would beat memory — never just to confirm something it already knows.

#### Tools (Phase 2a of [`docs/AGENTS_ROADMAP.md`](../roadmap/AGENTS_ROADMAP.md))

Tool definitions and the `runTool` dispatcher live in [`src/lib/chat-tools.ts`](../src/lib/chat-tools.ts). Each tool's executor returns a plain string — errors are converted to user-facing nudges so a thrown tool never crashes the loop.

| Tool | Input | What it does | Backed by |
|------|-------|--------------|-----------|
| `lookup_product(query)` | `query: string` | Searches the live storefront for matches by name / description / category / features. Returns up to 3 results with name, price, category, and `/store/<id>` URL. | `getProducts()` from `src/lib/store-products.ts` (5 min in-process cache, Stripe-backed when configured, else `defaultProducts`) |
| `check_calendar_availability(days_ahead?)` | `days_ahead?: integer` clamped to `[1, 14]` (default 7) | Returns up to 5 open 30-minute consultation slots in Athens local time, with a `/book` CTA. Returns a graceful contact-page nudge when Google Calendar isn't configured or no slots are open. | `getAvailableSlots()` from `src/lib/google-calendar.ts` |
| `book_slot(name, email, start, end, notes?)` | name, email: string; start, end: ISO-8601 | Confirms a booking after the visitor picks a slot. Only called after check_calendar_availability and after name/email are collected. Returns a confirmation with a Meet link. | `bookConsultation()` from `src/lib/google-calendar.ts` |

#### Tool-use loop

```mermaid
sequenceDiagram
    participant Browser
    participant API as /api/chat
    participant Bedrock as AWS Bedrock Converse
    participant Tool as runTool (chat-tools.ts)

    Browser->>API: POST { messages }
    loop ≤ 4 iterations (MAX_TOOL_ITERATIONS)
        API->>Bedrock: ConverseCommand (IAM auth)
        Bedrock-->>API: { stopReason, output.message.content }
        alt stopReason = tool_use
            API->>Tool: runTool(name, input) — parallel per block
            Tool-->>API: string (always resolves, errors become nudges)
            note over API: append assistant content + user toolResult blocks
        else stopReason = end_turn
            note over API: extract text blocks and break
        end
    end
    API-->>Browser: SSE chunks of final text + [DONE]
```

If the loop hits the cap without a final text response, the route logs `[chat] hit MAX_TOOL_ITERATIONS without a final response` and returns a contact-page nudge as a single SSE message. The Bedrock calls are non-streaming for simpler tool round-trips; the final text is chunk-encoded back as SSE so the existing `ChatWidget` event handlers keep working unchanged.

#### Log patterns emitted by `/api/chat`

| Pattern | Source | Severity |
|---------|--------|----------|
| `[chat] bedrock loop failed:` | `src/app/api/chat/route.ts` | `console.error` |
| `[chat] tool_use <name>` | `src/lib/bedrock-chat.ts` | `console.warn` |
| `[chat] hit MAX_TOOL_ITERATIONS without a final response` | `src/lib/bedrock-chat.ts` | `console.warn` |
| `[chat-tools] getAvailableSlots failed:` | `src/lib/chat-tools.ts` | `console.error` |
| `[chat-tools] <toolname> threw:` | `src/lib/chat-tools.ts` | `console.error` |
| `[chat-tools] slackBookingNotify failed:` | `src/lib/chat-tools.ts` | `console.warn` |
| `[chat-tools] sendBookingConfirmation failed:` | `src/lib/chat-tools.ts` | `console.warn` |

CloudWatch Logs Insights query to monitor tool usage:

```
fields @timestamp, @message
| filter @message like /\[chat\] tool_use/
| stats count(*) by toolName
| sort count desc
```

---

## Admin AI Routes

All require a valid admin session or Bearer JWT with the `admin` group. Return 503 when the API key is not configured.

### `POST /api/admin/ai/copy`

Generates 5 ad copy variants (headline + body + CTA + tone) for a given service and platform.

**Body:** `{ service, platform?, objective?, language? }`

**Platforms:** Meta, LinkedIn, TikTok, X, Google (each with correct character limits)

**Response:** `{ variants: [{ headline, body, cta, tone }] }`

### `POST /api/admin/ai/campaign`

Generates a full campaign strategy from a brief.

**Body:** `{ brief, budget?, targetAudience? }`

**Response:** `{ strategy: { recommended_platforms, campaign_objective, budget_split, audience, ad_formats, copy_suggestions, estimated_results, timeline } }`

### `POST /api/admin/ai/audience`

Generates platform-specific audience targeting parameters.

**Body:** `{ description, platforms?, objective? }`

**Response:** `{ targeting: { summary, demographics, platforms: { Meta, LinkedIn, Google, TikTok, X }, estimated_audience_size } }`

### `POST /api/admin/ai/report-insights`

Writes 3–5 sentences of marketing analyst commentary on campaign metrics.

**Body:** `{ metrics, period? }`

**Response:** `{ insights: "..." }`

---

## `src/lib/anthropic.ts` API

### `getAnthropicApiKey(): Promise<string | null>`

Reads `ANTHROPIC_API_KEY` from `getConfig()` (SSM-backed). Returns `null` when not configured.

### `isAnthropicConfigured(): Promise<boolean>`

Returns `true` if the API key is present.

### `verifyAnthropicKey(): Promise<{ status, message? }>`

Sends a 1-token ping to verify the key is valid.

| Status | Meaning |
|--------|---------|
| `valid` | Key accepted |
| `rejected` | 401/403 — key invalid or billing lapsed |
| `not_configured` | Key not in SSM/env |
| `error` | Network failure or unexpected HTTP error |

### `callClaude(prompt, apiKey, options?): Promise<string>`

Non-streaming single-turn call. Returns the text of the first content block.

| Option | Default |
|--------|---------|
| `model` | `claude-sonnet-4-6` |
| `maxTokens` | 1000 |
| `system` | — |

Throws on API errors — callers catch and return 500.

---

## Model Selection

| Surface | Model | Auth |
|---------|-------|------|
| Public chatbot (`/api/chat`) | `BEDROCK_MODEL_ID` env var or `us.anthropic.claude-haiku-4-5-20251001-v1:0` | IAM (Lambda execution role via `sst.config.ts` permissions) |
| Admin AI routes | `claude-sonnet-4-6` | Anthropic API key from SSM (`ANTHROPIC_API_KEY`) |
| `verifyAnthropicKey()` ping | `ANTHROPIC_CHAT_MODEL` (or `claude-haiku-4-5`) | Anthropic API key |

---

## Running Tests

```bash
# Shared lib
pnpm test -- --reporter=verbose __tests__/anthropic.test.ts

# Public chat route + tools
pnpm test -- --reporter=verbose __tests__/chat-api.test.ts __tests__/chat-tools.test.ts

# Admin AI routes
pnpm test -- --reporter=verbose __tests__/admin-ai-api.test.ts
```

Test coverage:

| File | Tests | What is tested |
|------|-------|---------------|
| `anthropic.test.ts` | 13 | `isAnthropicConfigured`, `verifyAnthropicKey` (5 paths), `callClaude` (6 paths: success, model/tokens, system prompt, api-key header, non-OK throws, empty content) |
| `chat-api.test.ts` | 10 | 400 validation, 503 no key, 502 upstream non-2xx, plain-text streaming, tools declared, history capped, tool-use round trip with `tool_result`, iteration-cap fallback |
| `chat-tools.test.ts` | 9 | `lookup_product` match / no-match / bad query, `check_calendar_availability` slots / no-config / no-slots / clamp, unknown tool, tool throw → contact nudge |
| `admin-ai-api.test.ts` | 13 | 401, 400, 503, 200 for campaign + copy + audience routes |

---

## Security Notes

- **Key in SSM SecureString:** `ANTHROPIC_API_KEY` is never committed. Stored as SecureString in SSM.
- **Public endpoint rate limiting:** `/api/chat` is rate-limited at 20 req/min/IP via `RATE_LIMITS` in `src/proxy.ts`. Tool round-trips amplify per-request LLM cost (1 chat → up to 4 LLM calls), so the cap is sized for that.
- **Message length cap:** User messages are truncated to 500 chars before being sent to the API.
- **History window:** Only the last 10 turns are forwarded — prevents unbounded context growth.
- **No PII forwarding:** The chat system prompt does not ask users for personal data. Conversation history lives only in the browser session (React state, cleared on refresh).
- **Tool execution is read-only:** Both shipped tools only read public-ish data (the storefront catalog and free/busy lookup). No mutations, no auth-scoped data, no secret leakage path.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/anthropic.ts` | Shared client: `callClaude`, `getAnthropicApiKey`, `verifyAnthropicKey` |
| `src/app/api/chat/route.ts` | Public chatbot endpoint — tool-use loop with SSE response |
| `src/lib/chat-tools.ts` | `CHAT_TOOLS` definitions + `runTool` dispatcher |
| `src/components/ChatWidget.tsx` | Floating chat UI — mounted in `[locale]/layout.tsx` |
| `src/app/api/admin/ai/copy/route.ts` | Ad copy generation |
| `src/app/api/admin/ai/campaign/route.ts` | Campaign strategy |
| `src/app/api/admin/ai/audience/route.ts` | Audience targeting |
| `src/app/api/admin/ai/report-insights/route.ts` | Report commentary |
| `__tests__/anthropic.test.ts` | Lib unit tests |
| `__tests__/chat-api.test.ts` | Chat route tests (tool-use loop, SSE, fallbacks) |
| `__tests__/chat-tools.test.ts` | Tool dispatcher tests |
