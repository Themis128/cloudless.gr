# Weekly Newsletter (3-layer quality gates)

Automated Monday pipeline: AI draft → Layer 1+2 gates → human Slack ops (Layer 3) → publish + SES send to EspoCRM subscribers.

Ops channel: **`#newsletter`** (`C0BBDKY6Q9E`). Signup pings and editorial confirmations land there.

## Architecture

```
Mon 06:00 UTC (dispatch)          [Layer 3 Slack review]                 Mon 09:00 UTC
────────────────                  ─────────────────────                  ─────────────
weekly-article-draft.yml          AppFlowy page prefixes                  weekly-newsletter.yml
generate-weekly-article.ts          [Draft]  = gates HOLD                 publish-and-send-newsletter.ts
  • LRU category                    [Review] = gates PASS / ops approve     • find [Review] pages
  • Workers AI / Bedrock            Slack: /newsletter-*                    • strip prefix (= publish)
  • Layer 1+2 quality gates                                                 • POST /api/webhooks/content
  • Slack ping #newsletter                                                  • POST /api/newsletter/send
                                                                            • Slack confirm #newsletter
```

If nothing is `[Review]` by 09:00 UTC, the publisher exits 0. **No empty newsletters.**

### 3 layers

1. **Deterministic** — `scripts/article-quality-gates.ts` (word count, structure, slug, banned phrases, title novelty).
2. **LLM critic** — Workers AI llama score ≥ 7.0.
3. **Human ops** — Slack App Home + `/newsletter-send` / `/cloudless-newsletter send` (or auto-promote to `[Review]` when layers 1–2 pass).

## Components

| Surface | Path |
|---------|------|
| Signup | `POST /api/subscribe` → EspoCRM + welcome email + Slack `#newsletter` |
| Unsub | `/api/unsubscribe` → SES suppress + EspoCRM |
| Broadcast | `POST /api/newsletter/send` (`x-newsletter-secret`) |
| Slack Newsletter app | `/api/newsletter-slack/{events,commands,interactions}` |
| Main Slack app | `/cloudless-draft`, `/cloudless-newsletter` |
| CMS admin | `src/lib/appflowy-blog-admin.ts` (name prefixes, not Notion Status) |
| Gates | `scripts/article-quality-gates.ts` |

## Local commands

```bash
pnpm newsletter:draft   # AppFlowy draft + gates + Slack ping
pnpm newsletter:send    # publish [Review] pages + email subscribers
```

## Required secrets

| Secret | Used by |
|--------|---------|
| `APPFLOWY_API_URL` / `APPFLOWY_EMAIL` / `APPFLOWY_PASSWORD` | Draft + publish scripts, Slack admin |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | Direct Workers AI (preferred) |
| `AI_GENERATE_SECRET` / `SITE_URL` | Fallback `/api/internal/ai/generate` |
| `NEWSLETTER_SEND_SECRET` | `/api/newsletter/send` |
| `CONTENT_WEBHOOK_SECRET` | ISR revalidate via `/api/webhooks/content` |
| `SLACK_BOT_TOKEN` | chat.postMessage to `#newsletter` |
| `NEWSLETTER_SLACK_CHANNEL_ID` | Prefer `C0BBDKY6Q9E` |
| `NEWSLETTER_SLACK_BOT_TOKEN` / `NEWSLETTER_SLACK_SIGNING_SECRET` | Dedicated Newsletter Slack app |

Seed Newsletter app secrets with `scripts/setup-newsletter-slack-app.sh` (must set signing secret on the Pi/D1 path or `/api/newsletter-slack/*` rejects all requests).

## Slack channel wiring

| Event | Channel |
|-------|---------|
| New subscriber | `#newsletter` |
| Draft ready / gates HOLD DM | `#newsletter` (+ optional ops DM) |
| Publish + send result | `#newsletter` |
| Slash ops | Newsletter app + main Cloudless app |

There is no separate `#subscribers` / `#newsletters` channel in the live workspace — do not reintroduce those names.
