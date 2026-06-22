# Weekly Newsletter

Automated pipeline that drafts a blog article every Monday with Claude, lets a human approve it in Notion, then publishes the post to the live blog and emails it to every newsletter subscriber via SES from `noreply@cloudless.gr`.

Subscribers live in **EspoCRM**. The weekly send runs through the site's own `/api/newsletter/send` endpoint, which executes on Lambda (where SES credentials already exist), so no AWS keys are needed in CI.

## Architecture at a glance

```
Mon 06:00 UTC                     [human review window]                      Mon 09:00 UTC       Mon 10:00 UTC
────────────────                  ────────────────────                        ─────────────       ─────────────
GitHub Actions                    Notion Blog DB                              GitHub Actions      GitHub Actions
weekly-article-draft.yml          (Status: Draft to Approved)                 weekly-newsletter.yml weekly-subscriber-report.yml
        │                                  │                                          │                   │
        ▼                                  ▼                                          ▼                   ▼
generate-weekly-article.ts        you flip Status                           publish-and-send-newsletter.ts  weekly-subscriber-report.ts
  • LRU category pick               in the Notion UI                          • query Status=Approved         • count EspoCRM subscribers
  • Claude Sonnet 4.6                                                         • flip to Published             • post to Slack #subscribers
  • Insert as Draft                                                           • revalidate /blog              • log to Notion "Newsletter Reports"
  • Slack ping                                                                • POST /api/newsletter/send
                                                                             • Slack confirm
                                                                                       │
                                                                                       ▼
                                                                              /api/newsletter/send (Lambda)
                                                                                • resolve EspoCRM subscribers
                                                                                • deliver via SES
```

If nothing is approved by 09:00 UTC, the publisher exits cleanly with no newsletter sent. **No empty newsletters.**

## Components

### Subscriber capture and lifecycle

- [src/app/api/subscribe/route.ts](../src/app/api/subscribe/route.ts) records the email in EspoCRM via `setNewsletterStatus(email, "newsletter_signup")`, clears any stale SES suppression so a returning subscriber can be emailed again, then sends the branded welcome email and a real-time Slack ping to `#subscribers`.
- [src/app/api/unsubscribe/route.ts](../src/app/api/unsubscribe/route.ts) (POST for the in-app form, GET for the one-click `List-Unsubscribe` link) atomically adds the address to the SES suppression list and flips the EspoCRM contact to `lead_source = "newsletter_unsubscribed"`, removing it from the send audience.
- [src/lib/espocrm.ts](../src/lib/espocrm.ts) — `setNewsletterStatus()` creates or updates a contact and sets the subscription state; `listNewsletterSubscribers()` returns every contact with `lead_source = "newsletter_signup"` (cursor-paginated search). _(EspoCRM was decommissioned in PR #1043; this lib is the drop-in replacement with the same 21 exports.)_

### Welcome email

- [src/lib/email.ts](../src/lib/email.ts) — `sendSubscriberWelcome()` sends a branded dark-theme email from `Themis at Cloudless` with subject "Welcome to Cloudless — your first issue lands Monday". The email previews the three content categories (Cloud and Serverless, Analytics and AI Marketing, Company Updates and Offers), links to the blog archive, and includes a one-click `List-Unsubscribe` header (RFC 8058).

### Send endpoint

- [src/app/api/newsletter/send/route.ts](../src/app/api/newsletter/send/route.ts) — `POST` authenticated with the `x-newsletter-secret` header against `NEWSLETTER_SEND_SECRET`. Accepts `{ subject, html, text }`, resolves the subscriber list from EspoCRM, and delivers one email per recipient via `sendEmail()` (SES). Returns `{ sent, failed, total }`. The `%UNSUBSCRIBELINK%` token in the body is replaced per recipient with `/api/unsubscribe?email=...`, and a matching `List-Unsubscribe` header is added.

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
- [scripts/publish-and-send-newsletter.ts](../scripts/publish-and-send-newsletter.ts) finds Approved rows, renders Notion blocks to HTML and plaintext (including a category-matched "This Week at Cloudless" service offer section), marks Published with `Date` and `PublishedAt`, hits the existing Notion webhook to revalidate ISR, then POSTs the rendered email to `/api/newsletter/send`, and Slack-confirms with the delivered/failed counts.
- `scripts/weekly-subscriber-report.ts` _(decommissioned with EspoCRM in PR #1043; equivalent reporting now flows from the espocrm-to-lake ETL → Athena)_ — historically queried EspoCRM for total active subscribers, new signups this week, and total unsubscribed contacts; posted a formatted Block Kit summary to Slack `#subscribers`; and inserted a timestamped row into a Notion "Newsletter Reports" database.

### Workflows

- [.github/workflows/weekly-article-draft.yml](../.github/workflows/weekly-article-draft.yml) — `cron: "0 6 * * 1"` (Mondays 06:00 UTC, 08:00 Athens).
- [.github/workflows/weekly-newsletter.yml](../.github/workflows/weekly-newsletter.yml) — `cron: "0 9 * * 1"` (Mondays 09:00 UTC, 11:00 Athens).
- `.github/workflows/weekly-subscriber-report.yml` _(removed in PR #1043 alongside the EspoCRM decom — superseded by the daily espocrm-to-lake ETL workflow)_ — historically `cron: "0 10 * * 1"` (Mondays 10:00 UTC, 12:00 Athens).
- All three have `workflow_dispatch` for manual triggering from the Actions UI.

## Local commands

```bash
pnpm newsletter:draft   # run the generator (creates a Notion Draft)
pnpm newsletter:send    # run the publisher (publishes approved drafts and sends)
pnpm newsletter:report  # run the subscriber report (Slack + Notion stats)
```

All commands need the env vars listed below.

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
| `HUBSPOT_API_KEY` | EspoCRM private-app token (used by the report script to query subscriber stats) |
| `SITE_URL` | Default `https://cloudless.gr` (script falls back to this) |
| `SLACK_WEBHOOK_URL` | Optional. Slack notifications on success and failure |

## One-time setup

1. **Confirm `cloudless.gr` is a verified SES sending domain** with SPF/DKIM in place. The site already sends transactional email (welcome, order confirmations) through SES, so this is normally done already.
2. **Share the Notion Blog database with your Notion integration.** The integration token cannot see new databases until you explicitly share them: open the database, then Connections, then add the Cloudless integration.
3. Add `NEWSLETTER_SEND_SECRET` as a GitHub Actions secret with the same value as the SSM parameter.
4. Add `HUBSPOT_API_KEY` as a GitHub Actions secret (same private-app token used by the Lambda runtime). This allows the report script to query subscriber stats from CI without going through the site API.
5. **Notion "Newsletter Reports" database** — created automatically on the first run of `weekly-subscriber-report.ts` if the Notion integration has workspace-level access. If auto-creation fails (integration has page-only access), create the database manually in Notion and share it with the integration; the script will find it by title on subsequent runs.

## Operating notes

- **AI safety**: every AI-generated article is `Status=Draft`, `GeneratedBy=AI`. Nothing publishes without a human flipping Status to Approved. The 3-hour gap between draft (06:00 UTC) and publisher (09:00 UTC) is the review SLA.
- **Topic rotation**: the generator picks the category with the oldest `PublishedAt`/`Date`/`created_time` of the last 12 posts. Categories that have never been used win outright.
- **Topic dedupe**: the generator passes the last 8 titles to Claude and instructs it to avoid those topics.
- **Newsletter content**: each issue contains the published blog article plus a "This Week at Cloudless" service offer block matched to the article's category (Cloud Consulting offer for Cloud articles, Serverless review for Serverless articles, etc.).
- **Welcome email**: new subscribers immediately receive a branded dark-theme email from `Themis at Cloudless` that previews the newsletter's content categories and links to the blog archive.
- **Failure modes**:
  - Generator fails: Slack ping; a human writes a draft manually if they want a Monday send.
  - Publisher with nothing approved: exits 0, no newsletter, no error. Quiet skip.
  - Publisher with a send error: Slack ping; the post is still flipped to Published in Notion. Re-running the publisher finds no Approved rows, so re-trigger the send manually via `workflow_dispatch` only after re-approving, or call `/api/newsletter/send` directly.
  - Per-recipient SES failures do not abort the batch; they are counted in `failed` and logged.
  - Report script failure: Slack ping; EspoCRM contacts view remains the authoritative source.
- **From address**: SES sends newsletter issues from `SES_FROM_EMAIL` (default `noreply@cloudless.gr`), resolved from SSM inside `sendEmail()`. The welcome email sends from `Themis at Cloudless <noreply@cloudless.gr>` for a personal touch.
- **Unsubscribe**: the `%UNSUBSCRIBELINK%` token in the email template is replaced per recipient with `/api/unsubscribe?email=...`, and a one-click `List-Unsubscribe` header is attached. Unsubscribing both suppresses the address in SES and flips the EspoCRM contact to `newsletter_unsubscribed`, so the next weekly send no longer targets it.
- **Re-subscribe**: subscribing again clears the SES suppression entry and flips the EspoCRM contact back to `newsletter_signup`, so a returning subscriber is fully restored without manual cleanup.
- **Weekly report**: runs at 10:00 UTC (one hour after the send), posts subscriber counts to Slack `#subscribers`, and appends a timestamped row to the Notion "Newsletter Reports" database. "New this week" counts contacts whose EspoCRM record was created within the last 7 days AND who are active subscribers; use the EspoCRM contacts view for full historical trend data.
- **Scale**: the send loop is sequential, one SES call per subscriber. This is fine for the current list size. For a large list the route should move to a batched or queued send.

## Smoke test sequence

1. Actions tab, **Weekly Article Draft**, Run workflow. Confirm a Draft row appears in Notion plus a Slack ping.
2. In Notion, flip Status `Draft` to `Approved`.
3. Actions tab, **Weekly Newsletter**, Run workflow. Confirm: the row flips to Published, `/blog/[slug]` shows the post, the Slack ping reports delivered/failed counts, and the email lands — including the "This Week at Cloudless" offer section.
4. Actions tab, **Weekly Subscriber Report**, Run workflow. Confirm a Slack message arrives in `#subscribers` with the subscriber counts, and a new row appears in the Notion "Newsletter Reports" database.
5. Subscribe with a fresh email at cloudless.gr. Confirm: a branded welcome email arrives from `Themis at Cloudless`, the contact appears in EspoCRM with `lead_source = newsletter_signup`, and a real-time Slack ping fires in `#subscribers`.
