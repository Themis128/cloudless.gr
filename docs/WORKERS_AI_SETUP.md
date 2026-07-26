# Cloudflare Workers AI Integration

Text generation via Cloudflare Workers AI, surfaced as an admin tool.

## Implementation

| File                                           | Role                                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/admin/ai/generate/route.ts`       | `POST` route — admin-auth-gated (`requireAdmin`), validates `{ prompt, model? }`, calls the Cloudflare Workers AI REST API, returns `{ success, result, model, usage }`. 503 when credentials are absent. |
| `src/app/[locale]/admin/ai-generator/page.tsx` | Admin UI (`/admin/ai-generator`, in the Marketing Hub sidebar) — prompt box, model picker (Llama 3 8B/70B), result with copy + token usage.                                                               |
| `sst.config.ts`                                | Forwards `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` from the deploy environment into the Lambda runtime env.                                                                                        |
| `.github/workflows/deploy.yml`                 | Supplies both variables to the SST deploy step (token from the `CLOUDFLARE_API_TOKEN` repo secret).                                                                                                       |

The endpoint lives under `/api/admin/*` on purpose: every call costs Workers AI
inference, so it requires an admin session/Bearer token and inherits the shared
admin rate limit from `proxy.ts`.

## Setup

### 1. Create the API token

1. [dash.cloudflare.com → Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → **Custom token**
3. Permissions: **Account → Workers AI → Read** + **Run**
4. Create and copy the token.

### 2. Production (Lambda)

Add the repo secret `CLOUDFLARE_API_TOKEN` (Settings → Secrets → Actions).
`CLOUDFLARE_ACCOUNT_ID` (`fb7dc7b69b662480cd5961a4d1913c78`) is already inline
in `deploy.yml`. The next deploy passes both into the Lambda env.

### 3. Local development

Add to `.env.local`:

```
CLOUDFLARE_ACCOUNT_ID=fb7dc7b69b662480cd5961a4d1913c78
CLOUDFLARE_API_TOKEN=<your token>
```

Without them the route answers `503 Cloudflare Workers AI not configured.` and
the admin page shows the standard "not configured" callout.

## API contract

```
POST /api/admin/ai/generate
Authorization: (admin session cookie or Bearer token)
{ "prompt": "Write a tagline", "model": "@cf/meta/llama-3-8b-instruct" }

200 → { "success": true, "result": "...", "model": "...",
        "usage": { "inputTokens": 12, "outputTokens": 48 } }
400 → missing/empty prompt or invalid JSON
401/403 → not an admin
503 → credentials not configured
502/5xx → upstream Cloudflare error
```

Allowed models: `@cf/meta/llama-3-8b-instruct` (default),
`@cf/meta/llama-3-70b-instruct`. Anything else falls back to the default.

## Cost

Workers AI free tier: 10,000 neurons/day (≈ hundreds of Llama-3-8B calls).
Past that, [pay-per-use pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
