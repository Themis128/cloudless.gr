# Weekly Newsletter

Automated pipeline that drafts a blog article every Monday with Claude, lets a human approve it in Notion, then publishes the post to the live blog and sends it as a newsletter via ActiveCampaign from `noreply@cloudless.gr`.

## Architecture at a glance

```
Mon 06:00 UTC                     [human review window]                      Mon 09:00 UTC
────────────────                  ────────────────────                        ─────────────
GitHub Actions                    Notion Blog DB                              GitHub Actions
weekly-article-draft.yml          (Status: Draft → Approved)                  weekly-newsletter.yml
        │                                  │                                          │
        ▼                                  ▼                                          ▼
generate-weekly-article.ts        you flip Status                           publish-and-send-newsletter.ts
  • LRU category pick               in the Notion UI                          • query Status=Approved
  • Claude Sonnet 4.6                                                         • flip to Published
  • Insert as Draft                                                           • revalidate /blog
  • Slack ping                                                                • create + send AC campaign
                                                                              • Slack confirm
```

If nothing is approved by 09:00 UTC, the publisher exits cleanly with no newsletter sent. **No empty newsletters.**

## Components

### Subscriber capture
- [src/app/api/subscribe/route.ts](../src/app/api/subscribe/route.ts) — adds the email to the `ACTIVECAMPAIGN_NEWSLETTER_LIST_ID` list via `addContactToList()`. Team-notify email + Slack ping run in parallel as a manual fallback if the AC call fails.
- [src/lib/activecampaign.ts](../src/lib/activecampaign.ts) — `addContactToList(email, listId, fields?)` is idempotent: AC's `contact/sync` upserts by email, then `contactLists` with `status=1` subscribes them.

### CMS
- Notion database **Blog** — fetched at runtime via [src/lib/notion-blog.ts](../src/lib/notion-blog.ts). 5-min ISR on `/blog` and `/blog/[slug]`.
- Schema (workflow-relevant fields):
  - `Status` — select: Draft / Approved / Published. Editorial state machine.
  - `Published` — checkbox. Public visibility flag (set atomically with Status=Published).
  - `Date`, `PublishedAt` — both set to publish day.
  - `Category` — Cloud / Serverless / Analytics / AI Marketing. Drives LRU rotation.
  - `GeneratedBy` — AI / Human. Provenance audit trail.
  - `Slug`, `Excerpt`, `Title`, `ReadTime`, `Author` — content fields.

### Cron scripts (self-contained — read env directly, no `src/lib/*` imports)
- [scripts/generate-weekly-article.ts](../scripts/generate-weekly-article.ts) — picks the least-recently-used category, calls Claude with a brand-voice system prompt + the last 8 titles to avoid, parses the JSON response, inserts as a Notion Draft, Slack-pings the editor.
- [scripts/publish-and-send-newsletter.ts](../scripts/publish-and-send-newsletter.ts) — finds Approved rows, renders Notion blocks → HTML + plaintext, marks Published with `Date` and `PublishedAt`, hits the existing Notion webhook to revalidate ISR, creates an AC campaign with `status=1` (immediate send), Slack-confirms.

### Workflows
- [.github/workflows/weekly-article-draft.yml](../.github/workflows/weekly-article-draft.yml) — `cron: "0 6 * * 1"` (Mondays 06:00 UTC, 08:00 Athens).
- [.github/workflows/weekly-newsletter.yml](../.github/workflows/weekly-newsletter.yml) — `cron: "0 9 * * 1"` (Mondays 09:00 UTC, 11:00 Athens).
- Both have `workflow_dispatch` for manual triggering from the Actions UI.

## Local commands

```bash
pnpm newsletter:draft  # run the generator (creates a Notion Draft)
pnpm newsletter:send   # run the publisher (sends approved drafts)
```

Both commands need the env vars listed below.

## Required configuration

### SSM (production runtime — for the Next.js app)
```
/cloudless/production/ACTIVECAMPAIGN_NEWSLETTER_LIST_ID
/cloudless/production/NOTION_BLOG_DB_ID
```

### GitHub Actions secrets (for the cron jobs)
| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API for article generation |
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_BLOG_DB_ID` | Blog database id (shared with the integration) |
| `NOTION_WEBHOOK_SECRET` | Used by the publisher to call the existing `/api/webhooks/notion` revalidator |
| `ACTIVECAMPAIGN_API_URL` | e.g. `https://your-account.api-us1.com` |
| `ACTIVECAMPAIGN_API_TOKEN` | AC API token |
| `ACTIVECAMPAIGN_NEWSLETTER_LIST_ID` | Numeric list id |
| `SES_FROM_EMAIL` | Default `noreply@cloudless.gr` (script falls back to this) |
| `SITE_URL` | Default `https://cloudless.gr` (script falls back to this) |
| `SLACK_WEBHOOK_URL` | Optional — Slack notifications on success and failure |

## One-time setup

1. **Verify `cloudless.gr` as a sending domain in ActiveCampaign.** Settings → Domains → add the domain and the SPF/DKIM/DMARC DNS records they generate to Route 53. Configure default sender as `Cloudless <noreply@cloudless.gr>`.
2. **Create the AC list "Newsletter"** and note its numeric id (visible in URL `/lists/N/...`).
3. **Share the Notion Blog database with your Notion integration.** The integration token can't see new databases until you explicitly share them: open the database → ⋯ → Connections → add the Cloudless integration.
4. Set the SSM parameters and GitHub secrets listed above.

## Operating notes

- **AI safety**: every AI-generated article is `Status=Draft`, `GeneratedBy=AI`. Nothing publishes without a human flipping Status to Approved. The 3-hour gap between draft (06:00 UTC) and publisher (09:00 UTC) is the review SLA.
- **Topic rotation**: the generator picks the category with the oldest `PublishedAt`/`Date`/`created_time` of the last 12 posts. Categories that have never been used win outright.
- **Topic dedupe**: the generator passes the last 8 titles to Claude and instructs it to avoid those topics.
- **Failure modes**:
  - Generator fails → Slack ping; human writes a draft manually if they want a Monday send.
  - Publisher with nothing approved → exits 0, no newsletter, no error. Quiet skip.
  - Publisher with AC error → Slack ping; the post is still flipped to Published in Notion, but the email didn't go. Re-run the publisher manually after the AC issue is resolved (it'll find no Approved rows; you'd resend from the AC dashboard).
- **From address preservation**: AC sends from `noreply@cloudless.gr` because the verified sending domain in AC is `cloudless.gr`, with the right SPF/DKIM. The `fromemail` field in the campaign payload is `SES_FROM_EMAIL` env var (default `noreply@cloudless.gr`).
- **Unsubscribe**: AC injects unsubscribe links via the `%UNSUBSCRIBELINK%` token already present in the email template. Bounces and complaints are handled by AC's reputation infrastructure.

## Smoke test sequence

1. Actions tab → **Weekly Article Draft** → Run workflow. Confirm a Draft row appears in Notion + Slack ping.
2. In Notion, flip Status `Draft → Approved`.
3. Actions tab → **Weekly Newsletter** → Run workflow. Confirm: row flips to Published, `/blog/[slug]` shows the post, AC campaign appears in the AC dashboard, email lands.
4. Subscribe with a fresh email at cloudless.gr → confirm contact appears in the Newsletter AC list.
