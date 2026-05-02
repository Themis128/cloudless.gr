# Anthropic / Claude AI Integration

cloudless.gr uses the Anthropic Messages API for two distinct surfaces:

1. **Public chatbot** — `ChatWidget` on every page; streaming SSE via `/api/chat`
2. **Admin AI tools** — copy generation, campaign strategy, audience targeting, and report insights under `/api/admin/ai/*`

All surfaces share a single `ANTHROPIC_API_KEY` loaded through `src/lib/anthropic.ts`.

> **Status:** Optional — `/api/chat` returns 503 when the key is absent (widget shows a graceful error). Admin AI routes return 503 similarly. The rest of the site is unaffected.
>
> **Last verified:** 2026-05-01 — 13 unit tests pass (anthropic.ts lib) + 12 existing admin-ai-api tests + 7 chat-api tests

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

    subgraph Lib["src/lib/anthropic.ts"]
        Key["getAnthropicApiKey()"]
        Call["callClaude()"]
        Verify["verifyAnthropicKey()"]
    end

    Widget -->|POST messages| ChatRoute
    ChatRoute -->|getAnthropicApiKey| Key
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
```

### Production (AWS SSM Parameter Store)

| Parameter path | Type |
|----------------|------|
| `/cloudless/production/ANTHROPIC_API_KEY` | SecureString |

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
| Model | `claude-haiku-4-5-20251001` (fast, low-cost) |
| `max_tokens` | 300 |
| Streaming | SSE (`text/event-stream`) |
| Max history | 10 turns |
| Max message length | 500 chars |
| Auth | None (public endpoint) |
| 503 when | `ANTHROPIC_API_KEY` not configured |

The system prompt positions Claude as "Cloudless Assistant" with knowledge of services, pricing, and how to direct prospects to book a free audit.

---

## Admin AI Routes

All require a valid Cognito JWT with the `admin` group. Return 503 when the API key is not configured.

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

| Surface | Model | Reason |
|---------|-------|--------|
| Public chatbot (`/api/chat`) | `claude-haiku-4-5-20251001` | Low latency, low cost for high-volume public traffic |
| Admin AI routes | `claude-sonnet-4-6` | Higher reasoning quality for structured JSON outputs |
| `verifyAnthropicKey()` ping | `claude-haiku-4-5-20251001` | Cheapest possible health check (1 token) |

---

## Running Tests

```bash
# Shared lib
pnpm test -- --reporter=verbose __tests__/anthropic.test.ts

# Public chat route
pnpm test -- --reporter=verbose __tests__/chat-api.test.ts

# Admin AI routes
pnpm test -- --reporter=verbose __tests__/admin-ai-api.test.ts
```

Test coverage:

| File | Tests | What is tested |
|------|-------|---------------|
| `anthropic.test.ts` | 13 | `isAnthropicConfigured`, `verifyAnthropicKey` (5 paths), `callClaude` (6 paths: success, model/tokens, system prompt, api-key header, non-OK throws, empty content) |
| `chat-api.test.ts` | 7 | 400 validation, 503 no key, 200 streaming, correct model/stream flag, history capped at 10 |
| `admin-ai-api.test.ts` | 12 | 401, 400, 503, 200 for campaign + copy + audience routes |

---

## Security Notes

- **Key in SSM SecureString:** `ANTHROPIC_API_KEY` is never committed. Stored as SecureString in SSM.
- **Public endpoint rate limiting:** `/api/chat` has no built-in rate limit — consider adding one (e.g. 20 req/IP/10 min) to control costs.
- **Message length cap:** User messages are truncated to 500 chars before being sent to the API.
- **History window:** Only the last 10 turns are forwarded — prevents unbounded context growth.
- **No PII forwarding:** The chat system prompt does not ask users for personal data. Conversation history lives only in the browser session (React state, cleared on refresh).

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/anthropic.ts` | Shared client: `callClaude`, `getAnthropicApiKey`, `verifyAnthropicKey` |
| `src/app/api/chat/route.ts` | Public streaming chatbot endpoint |
| `src/components/ChatWidget.tsx` | Floating chat UI — mounted in `[locale]/layout.tsx` |
| `src/app/api/admin/ai/copy/route.ts` | Ad copy generation |
| `src/app/api/admin/ai/campaign/route.ts` | Campaign strategy |
| `src/app/api/admin/ai/audience/route.ts` | Audience targeting |
| `src/app/api/admin/ai/report-insights/route.ts` | Report commentary |
| `__tests__/anthropic.test.ts` | Lib unit tests |
