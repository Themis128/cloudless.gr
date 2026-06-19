---
name: ad-analytics
description: |
  Build, extend, or operate the reusable ad-analytics Slack module on
  cloudless.gr. Use whenever the user mentions: LinkedIn / Meta / Google /
  TikTok ad metrics, real-time conversion alerts, Slack digests of ad
  performance, /cloudless analytics slash commands, ad-anomaly DMs, the
  AdPlatformAdapter or NotificationChannel interfaces, /api/ad-analytics/*,
  /api/cron/ad-analytics-poll, or any change under src/lib/ad-analytics/**.

  The Notion canonicals are:
    - 📊 Reusable Ad Analytics Slack App — Architecture
      (3837d82c-410a-81bf-b560-d517d9140138)
    - ✅ Ad Analytics Slack App — Build Tracker
      (3837d82c-410a-81f9-ab17-f212493a4613)
  under 📣 Campaign Management (35e7d82c-410a-8193-bc45-e05668806eda).
---

# Reusable ad-analytics Slack module

cloudless.gr ships a configurable, multi-platform ad-analytics module that:

- Captures **real-time conversion events** from any campaign (in-seconds via
  the browser thanks-page fire) and posts to Slack.
- Polls **per-platform ad metrics** every 15 min (LinkedIn AdAnalytics today,
  Meta / Google Ads / TikTok as adapters land), diffs vs a DynamoDB bookmark,
  posts a Block Kit digest to Slack.
- Exposes `/cloudless analytics …` Slack slash commands for on-demand status.
- DMs the operator when configured anomaly rules fire.

**Reusability principle:** ONE configurable module — not one Slack app per
platform. Adding a new ad platform = implementing `AdPlatformAdapter`. Adding
a new notification target = implementing `NotificationChannel`. Adding a new
campaign = appending one config entry in `src/data/campaigns.ts`. Never copy.

## File map

| Piece                          | Path                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Configuration                  | `src/data/campaigns.ts` (extended schema)                                       |
| Public types                   | `src/lib/ad-analytics/types.ts`                                                 |
| Platform adapter interface     | `src/lib/ad-analytics/adapters/ad-platform.ts`                                  |
| Notification channel interface | `src/lib/ad-analytics/channels/notification.ts`                                 |
| LinkedIn adapter (concrete)    | `src/lib/ad-analytics/adapters/linkedin.ts` (wraps `lib/campaigns/linkedin.ts`) |
| Slack channel (concrete)       | `src/lib/ad-analytics/channels/slack.ts` (wraps `lib/slack-notify.ts`)          |
| Orchestrator                   | `src/lib/ad-analytics/runtime.ts`                                               |
| Bookmark state                 | `src/lib/ad-analytics/bookmarks.ts` (DynamoDB)                                  |
| Digest renderer                | `src/lib/ad-analytics/digest.ts`                                                |
| Anomaly evaluator              | `src/lib/ad-analytics/anomaly.ts`                                               |
| Real-time conversion route     | `src/app/api/ad-analytics/conversion/route.ts`                                  |
| Scheduled poll route           | `src/app/api/cron/ad-analytics-poll/route.ts`                                   |
| Slash command extension        | `src/app/api/slack/commands/route.ts` (add subcommand)                          |
| Scheduled workflow             | `.github/workflows/linkedin-poll.yml` (every 15 min)                            |
| Architecture doc               | `docs/ad-analytics-architecture.md`                                             |

## Operating principles

1. **L1 reusable, L2-extractable.** Build inside `src/lib/ad-analytics/` with
   module boundaries clean enough that a future `@cloudless/ad-analytics`
   npm extract is mechanical. Don't pay the cross-repo tax until it pays back.
2. **Two LinkedIn conversion IDs per event.** Per the Gilgamesh CAPI
   source-bound finding, every event needs `insightTagConversionId` (browser)
   AND `capiConversionId` (server). Same `eventId` (Stripe session ID) on both.
   LinkedIn dedupes account-scoped. The CAPI-typed conversion must be created
   in Campaign Manager UI BEFORE the server path is enabled.
3. **`LinkedIn-Version: 202605`** — pin the API version explicitly. The
   existing `src/lib/campaigns/linkedin.ts` pins `202401` which is 16 months
   stale and missing the `appointmentsScheduled` metric.
4. **No webhooks from LinkedIn.** Polling is the only ad-metrics path.
   Practical floor is 15 min — LinkedIn's reporting pipeline lag makes
   anything faster wasteful.
5. **AdAnalytics has no pagination.** Partition queries by campaign ×
   time-window (the Singer.io tap pattern).
6. **Slack 3-second budget** for slash commands. Existing
   `/api/slack/commands` handler already implements the lazy-listener
   pattern (ack <3s, defer, `chat.update`). Reuse it.
7. **Cron-secret gating** identical to `/api/cron/slack-digest` already in
   the codebase — reuse `CRON_SECRET`.
8. **Idempotent bookmarks.** Each `(campaign, platform, metric, window)`
   tuple has its own DynamoDB item. Polling is idempotent — re-running a
   poll over the same window produces the same result.

## Adding a new ad platform (3 steps)

1. Create `src/lib/ad-analytics/adapters/<platform>.ts` implementing
   `AdPlatformAdapter`. Wrap the existing `src/lib/campaigns/<platform>.ts`
   client if one exists.
2. Register it in `src/lib/ad-analytics/runtime.ts` `ADAPTERS` map.
3. Append a `{ platform: "<platform>", … }` entry to the campaign's
   `adPlatforms[]` in `src/data/campaigns.ts`.

No other code changes required. Notifications, digests, slash commands, and
anomaly evaluation all flow automatically.

## Adding a new notification channel (3 steps)

1. Create `src/lib/ad-analytics/channels/<channel>.ts` implementing
   `NotificationChannel`.
2. Register it in `src/lib/ad-analytics/runtime.ts` `CHANNELS` map.
3. Append a `{ channel: "<channel>", target: "…", level: "event" | "digest" }`
   entry to the campaign's `notifyChannels[]`.

## Required env

| Variable                                | Where       | Purpose                                           |
| --------------------------------------- | ----------- | ------------------------------------------------- |
| `LINKEDIN_ACCESS_TOKEN`                 | SSM, server | LinkedIn Marketing API (already set)              |
| `LINKEDIN_AD_ACCOUNT_ID`                | SSM, server | (already set)                                     |
| `SLACK_BOT_TOKEN` / `SLACK_WEBHOOK_URL` | SSM         | Slack outbound (already set)                      |
| `CRON_SECRET`                           | SSM, server | Gates `/api/cron/ad-analytics-poll` (already set) |
| `AD_ANALYTICS_BOOKMARKS_TABLE`          | SSM, server | DynamoDB table for poll state (NEW, Phase 2)      |

## Verification recipe

After any change:

```bash
pnpm typecheck
pnpm test:ci -- ad-analytics
pnpm test:e2e -- --grep ad-analytics  # once e2e exists
```

Live verification of a real conversion via Chrome MCP:

1. Hit `https://cloudless.gr/en/campaigns/shop-online/thanks?tier=full-bundle&order=cs_test_xyz`
2. Within 5 s a Block Kit message should appear in `#ads-realtime`.
3. `window.lintrk("track", { conversion_id: 26846068 })` still fires.

## Phase order (do not skip steps)

- **Phase 0** — Scaffold types + interfaces. Zero behavior change.
- **Phase 1** — Real-time conversion → Slack.
- **Phase 2** — Scheduled 15-min digest.
- **Phase 3** — Slash command surface.
- **Phase 4** — Anomaly DM alerts.

Each phase ships as its own PR with typecheck + tests + a verification log.

## Anomaly thresholds (Phase 4)

`src/lib/ad-analytics/anomaly.ts` `DEFAULTS` are tuned from the 2026 industry
consensus. Change them only with a cited reason — the test
`__tests__/ad-analytics/anomaly.test.ts > evaluateAnomalies > DEFAULTS pins
the contract` is the regression guard.

| Rule                  | Default        | Source                                                        | Notes                                                 |
| --------------------- | -------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `cpcSpikeMultiplier`  | 1.4 (40% over) | Improvado — "if CPC jumps by 40%, alert"                      | Skipped on cold start (no previous bookmark)          |
| `spendPaceMultiplier` | 1.5 (50% over) | Go-Insights pacing methodology                                | Skipped on cold start                                 |
| `zeroConversionsHours`| 24             | Ryze — "give the funnel one full day"                         | Skipped when poll window < this                       |
| `minCtr`              | 0.003 (0.3%)   | LinkedIn effective floor + Improvado CTR-drop                 | Skipped below 200 impressions (small-sample guard)    |
| `maxCpcEur`           | unset          | Operator hard ceiling                                         | Fires `critical` when set and exceeded                |

Per-campaign overrides live in `Campaign.anomalyRules` in
`src/data/campaigns.ts`. Findings are de-duped via the bookmark store on
`findingDedupKey({ campaign, platform, rule, day })` — the same anomaly
re-firing in the next 15-min tick stays silent until the next calendar day.

## References

- Notion: [📊 Reusable Ad Analytics Slack App — Architecture](https://app.notion.com/p/3837d82c410a81bfb560d517d9140138)
- Notion: [✅ Ad Analytics Slack App — Build Tracker](https://app.notion.com/p/3837d82c410a81f9ab17f212493a4613)
- Gilgamesh: [LinkedIn CAPI Is Not Meta CAPI — the source-bound conversion trap](https://gilgamesh.in/blog/linkedin-capi-source-bound-conversions)
- Singer.io: [tap-linkedin-ads](https://github.com/singer-io/tap-linkedin-ads) — bookmark pattern reference
- Microsoft Learn: [LinkedIn Reporting API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting?view=li-lms-2026-03)
- Improvado: [Marketing Anomaly Detection & Automated Alerts: 2026 Guide](https://improvado.io/blog/marketing-anomaly-detection-automated-alerts) — Phase 4 threshold source
- Go-Insights: [How monitoring works](https://www.go-insights.com/anomaly-detection) — pacing methodology
- Ryze AI: [How to Stop Wasting Ad Spend Automatically (2026)](https://www.get-ryze.ai/answers/how-to-stop-wasting-ad-spend-automatically) — alert cadence + conservative-threshold guidance
- Tinybird: [Z-score anomaly detection](https://github.com/tinybirdco/use-case-real-time-anomaly-detection/blob/main/content/z-score.md) — statistical layer reference for the planned ≥7-snapshot upgrade
- Existing repo skill: [linkedin-campaigns](../linkedin-campaigns/SKILL.md)
