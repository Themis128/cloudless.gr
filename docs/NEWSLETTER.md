# Weekly Newsletter

Automated pipeline that drafts a blog article every Monday with Claude, lets a human approve it in Notion, then publishes the post to the live blog and emails it to every newsletter subscriber via SES from `noreply@cloudless.gr`.

Subscribers live in **HubSpot**. The weekly send runs through the site's own `/api/newsletter/send` endpoint, which executes on Lambda (where SES credentials already exist), so no AWS keys are needed in CI.

## Architecture at a glance

```
Mon 06:00 UTC                     [human review window]                      Mon 09:00 UTC
────────────────                  ────────────────────                        ─────────────
GitHub Actions                    Notion Blog DB                              GitHub Actions
weekly-article-draft.yml          (Status: Draft to Approved)                 weekly-newsletter.yml
        │                                  │                                          │
        ▼                                  ▼                                          ▼
generate-weekly-article.ts        you flip Status                           publish-and-send-newsletter.ts
  • LRU category pick               in the Notion UI                          • query Status=Approved
  • Claude Sonnet 4.6                                                         • flip to Published
  • Insert as Draft                                                           • revalidate /blog
  • Slack ping                                                                • POST /api/newsletter/send
                                                                              • Slack confirm
                                                                                       │
                                                                                       ▼
                                                                              /api/newsletter/send (Lambda)
                                                                                • resolve HubSpot subscribers
                                                                                • deliver via SES
```

If nothing is approved by 09:00 UTC, the publisher exits cleanly with no newsletter sent. **No empty newsletters.**

## Components

### Subscriber capture and lifecycle
- [src/app/api/subscribe/route.ts](../src/app/api/subscribe/route.ts) records the email in HubSpot via `setNewsletterStatus(email, "newsletter_signup")`, and clears any stale SES suppression so a returning subscriber can be emailed again. Team-notify email and Slack ping run in parallel as a manual fallback if the HubSpot call fails.
- [src/app/api/unsubscribe/route.ts](../src/app/api/unsubscribe/route.ts) (POST for the in-app form, GET for the one-click `List-Unsubscribe` link) adds the address to the SES suppression list and flips the HubSpot contact to `lead_source = "newsletter_unsubscribed"`, which removes it from the send audience.
- [src/lib/hubspot.ts](../src/lib/hubspot.ts) — `setNewsletterStatus()` creates or updates a contact and sets the subscription state; `listNewsletterSubscribers()` returns every contact with `lead_source = "newsletter_signup"` (cursor-paginated search).

### Send endpoint
- [src/app/api/newsletter/send/route.ts](../src/app/api/newsletter/send/route.ts) — `POST` authenticated with the `x-newsletter-secret` header against `NEWSLETTER_SEND_SECRET`. Accepts `{ subject, html, text }`, resolves the subscriber list from HubSpot, and delivers one email per recipient via `sendEmail()` (SES). Returns `{ sent, failed, total }`. The `%UNSUBSCRIBELINK%` token in the body is replaced per recipient with `/api/unsubscribe?email=...`, and a matching `List-Unsubscribe` header is added.

### CMS
- Notion database **Blog** — fetched at runtime via [src/lib/notion-blog.ts](../src/lib/notion-blog.ts). 5-min ISR on `/blog` and `/blog/[slug]`.
- Schema (workflow-relevant fields):
  - `Status` — select: Draft / Approved / Published. Editorial state machine.
  - `Published` — checkbox. Public visibility flag (set atomically with Status=Published).
  - `Date`, `PublishedAt` — both set to publish day.
  - `Category` — Cloud / Serverless / Analytics / AI Marketing. Drives LRU rotation.
  - `GeneratedBy` — AI / Human. Provenance audit trail.
  - `Slug`, `Excerpt`, `Title`, `ReadTime`, `Author` — content fields.

### Cron scripts (self-contained: read env directly, no `src/lib/*` imports)
- [scripts/generate-weekly-article.ts](../scripts/generate-weekly-article.ts) picks the least-recently-used category, calls Claude with a brand-voice system prompt plus the last 8 titles to avoid, parses the JSON response, inserts as a Notion Draft, Slack-pings the editor.
- [scripts/publish-and-send-newsletter.ts](../scripts/publish-and-send-newsletter.ts) finds Approved rows, renders Notion blocks to HTML and plaintext, marks Published with `Date` and `PublishedAt`, hits the existing Notion webhook to revalidate ISR, then POSTs the rendered email to `/api/newsletter/send`, and Slack-confirms with the delivered/failed counts.

### Workflows
- [.github/workflows/weekly-article-draft.yml](../.github/workflows/weekly-article-draft.yml) — `cron: "0 6 * * 1"` (Mondays 06:00 UTC, 08:00 Athens).
- [.github/workflows/weekly-newsletter.yml](../.github/workflows/weekly-newsletter.yml) — `cron: "0 9 * * 1"` (Mondays 09:00 UTC, 11:00 Athens).
- Both have `workflow_dispatch` for manual triggering from the Actions UI.

## Local commands

```bash
pnpm newsletter:draft  # run the generator (creates a Notion Draft)
pnpm newsletter:send   # run the publisher (publishes approved drafts and sends)
```

Both commands need the env vars listed below.

## Required configuration

### SSM (production runtime, for the Next.js app)
```
/cloudless/production/HUBSPOT_API_KEY        (already set)
/cloudless/production/NEWSLETTER_SEND_SECRET (already set)
/cloudless/production/NOTION_BLOG_DB_ID      (already set)
```

The `/api/newsletter/send` route reads all three from SSM at runtime. SES is reached with the Lambda execution role, so no extra credentials are required.

### GitHub Actions secrets (for the cron jobs)
| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API for article generation |
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_BLOG_DB_ID` | Blog database id (shared with the integration) |
| `NOTION_WEBHOOK_SECRET` | Used by the publisher to call the existing `/api/webhooks/notion` revalidator |
| `NEWSLETTER_SEND_SECRET` | Authenticates the publisher to `/api/newsletter/send`. Must match the SSM value. |
| `SITE_URL` | Default `https://cloudless.gr` (script falls back to this) |
| `SLACK_WEBHOOK_URL` | Optional. Slack notifications on success and failure |

## One-time setup

1. **Confirm `cloudless.gr` is a verified SES sending domain** with SPF/DKIM in place. The site already sends transactional email (welcome, order confirmations) through SES, so this is normally done already.
2. **Share the Notion Blog database with your Notion integration.** The integration token cannot see new databases until you explicitly share them: open the database, then Connections, then add the Cloudless integration.
3. Add `NEWSLETTER_SEND_SECRET` as a GitHub Actions secret with the same value as the SSM parameter.

## Operating notes

- **AI safety**: every AI-generated article is `Status=Draft`, `GeneratedBy=AI`. Nothing publishes without a human flipping Status to Approved. The 3-hour gap between draft (06:00 UTC) and publisher (09:00 UTC) is the review SLA.
- **Topic rotation**: the generator picks the category with the oldest `PublishedAt`/`Date`/`created_time` of the last 12 posts. Categories that have never been used win outright.
- **Topic dedupe**: the generator passes the last 8 titles to Claude and instructs it to avoid those topics.
- **Failure modes**:
  - Generator fails: Slack ping; a human writes a draft manually if they want a Monday send.
  - Publisher with nothing approved: exits 0, no newsletter, no error. Quiet skip.
  - Publisher with a send error: Slack ping; the post is still flipped to Published in Notion. Re-running the publisher finds no Approved rows, so re-trigger the send manually via `workflow_dispatch` only after re-approving, or call `/api/newsletter/send` directly.
  - Per-recipient SES failures do not abort the batch; they are counted in `failed` and logged.
- **From address**: SES sends from `SES_FROM_EMAIL` (default `noreply@cloudless.gr`), resolved from SSM inside `sendEmail()`.
- **Unsubscribe**: the `%UNSUBSCRIBELINK%` token in the email template is replaced per recipient with `/api/unsubscribe?email=...`, and a one-click `List-Unsubscribe` header is attached. Unsubscribing both suppresses the address in SES and flips the HubSpot contact to `newsletter_unsubscribed`, so the next weekly send no longer targets it.
- **Re-subscribe**: subscribing again clears the SES suppression entry and flips the HubSpot contact back to `newsletter_signup`, so a returning subscriber is fully restored without manual cleanup.
- **Scale**: the send loop is sequential, one SES call per subscriber. This is fine for the current list size. For a large list the route should move to a batched or queued send.

## Smoke test sequence

1. Actions tab, **Weekly Article Draft**, Run workflow. Confirm a Draft row appears in Notion plus a Slack ping.
2. In Notion, flip Status `Draft` to `Approved`.
3. Actions tab, **Weekly Newsletter**, Run workflow. Confirm: the row flips to Published, `/blog/[slug]` shows the post, the Slack ping reports delivered/failed counts, and the email lands.
4. Subscribe with a fresh email at cloudless.gr, then confirm the contact appears in HubSpot with `lead_source = newsletter_signup`.
```
