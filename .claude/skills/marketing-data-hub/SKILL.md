---
name: marketing-data-hub
description: >
  Orchestration guide for cloudless.gr's marketing data stack — Windsor.ai, Supermetrics,
  IFTTT, Meta Graph API, Ahrefs, and Google Search Console. Use this skill when the user
  wants a cross-platform marketing overview, needs to decide which tool to use for a
  specific task, or wants to build reports combining data from multiple sources. Triggers
  on "marketing overview", "which tool should I use", "cross-platform report", "compare
  all channels", "marketing stack", "data from all sources", "full analytics", "marketing
  dashboard", "channel comparison", or when the request spans multiple marketing platforms.
  Also use when the user asks about ad campaigns, organic social, SEO, and web analytics
  together in one request.
---

# Marketing Data Hub — Orchestration Skill

This skill helps you choose the RIGHT tool for each marketing task across cloudless.gr's
integrated data stack. Each platform has strengths — use this guide to route requests
to the optimal tool.

## Platform Capabilities Matrix

| Capability | Windsor.ai | Supermetrics | Meta Graph API | Ahrefs | GSC | IFTTT |
|-----------|-----------|-------------|---------------|--------|-----|-------|
| Facebook Ads analytics | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Facebook Page insights | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Instagram insights | ✅ (pending) | ✅ (pending) | ✅ (pending) | ❌ | ❌ | ❌ |
| LinkedIn Ads | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| LinkedIn Organic | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Google Ads | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| GA4 web analytics | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Threads | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| TikTok | ✅ (pending) | ✅ (pending) | ❌ | ❌ | ❌ | ❌ |
| SEO / keywords | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Backlinks | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Search performance | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Create ad campaigns | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish social posts | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Cross-post automation | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Blended cross-channel | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Keyword research | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

## Decision Tree: Which Tool to Use

### "How much did I spend on ads?"
→ **Windsor.ai** `get_data` with `connector="all"` for blended view
→ Or **Supermetrics** `data_query` for individual platform deep-dive

### "Show me my Facebook/LinkedIn campaign performance"
→ **Windsor.ai** for read-only analytics (fastest)
→ **Supermetrics** for analytics + campaign management (create/pause/update)

### "Create or manage an ad campaign"
→ **Meta Marketing API** for Facebook/Instagram ads with full targeting control (see `meta-marketing-api/SKILL.md`)
→ **LinkedIn Marketing API** for LinkedIn Ads (see `linkedin-marketing-api/SKILL.md`)
→ **Supermetrics** `campaign_create` / `campaign_update` (Google, Meta, Microsoft, TikTok, LinkedIn)

### "Post to social media"
→ **Meta Graph API** for Instagram posts/Reels/carousels (see `instagram-graph-api/SKILL.md`)
→ **Facebook Pages API** for Facebook Page posts (see `facebook-pages-api/SKILL.md`)
→ **Threads API** for Threads posts (see `threads-api/SKILL.md`)
→ **TikTok API** for TikTok videos/photos (see `tiktok-api/SKILL.md`)
→ **LinkedIn Marketing API** for LinkedIn org posts (see `linkedin-marketing-api/SKILL.md`)
→ **IFTTT** `run_action` for one-off posts to any platform
→ **IFTTT** applets for automated cross-posting workflows

### "How's my SEO doing?"
→ **Ahrefs** for keyword rankings, backlinks, domain rating, competitor analysis
→ **GSC** (Google Search Console) for actual search performance data from Google

### "Compare all my marketing channels"
→ **Windsor.ai** `connector="all"` with `datasource` field — blended cross-channel view
→ Or query each source separately and combine in a dashboard

### "Automate: when X happens, do Y"
→ **IFTTT** for trigger-based automation (new blog post → share to social media)

### "What keywords should I target?"
→ **Ahrefs** Keywords Explorer for volume, difficulty, suggestions
→ **Supermetrics** `campaign_and_resource_get` with `resource_type="keyword_ideas"` for Google Ads keywords

## MCP Server Reference

| Platform | MCP UUID / Location | Skill File |
|----------|---------------------|-----------|
| Windsor.ai | `524df47a-0d69-4688-a635-c2bff4cd4065` | `windsor-ai/SKILL.md` |
| Supermetrics | `d51fa0c7-528a-4fab-a916-551e27f73113` | `supermetrics/SKILL.md` |
| IFTTT | `418288e6-2c4e-48f8-8412-0b00c81b7f9d` | `ifttt-automation/SKILL.md` |
| Ahrefs | `8e7b34ec-15e2-409c-a05c-6047d9654387` | (uses Ahrefs MCP tools directly) |
| GSC | Built into Next.js | `gsc-nextjs/SKILL.md` |
| Meta Graph API | Local MCP server | `meta-instagram/SKILL.md` |
| Meta Business Suite | — (orchestration) | `meta-business-suite/SKILL.md` |
| Instagram Graph API | Via Meta Graph API | `instagram-graph-api/SKILL.md` |
| Facebook Pages API | Via Meta Graph API | `facebook-pages-api/SKILL.md` |
| Meta Marketing API | Via Meta Graph API | `meta-marketing-api/SKILL.md` |
| TikTok API | Direct REST API | `tiktok-api/SKILL.md` |
| Threads API | Direct REST API | `threads-api/SKILL.md` |
| LinkedIn Marketing API | Direct REST API | `linkedin-marketing-api/SKILL.md` |
| Chrome Browser | Claude in Chrome | `chrome-browser-automation/SKILL.md` |

## Connected Accounts Summary (2026-04-20)

### Windsor.ai (4 active connectors)
- GA4: www.baltzakisthemis.com (500620492)
- LinkedIn Ads: Baltzakis Ad Account (512642510)
- LinkedIn Organic: cloudless.gr (108614163)
- Threads: Themistoklis Baltzakis (26733238892980904)

### Supermetrics (2 known accounts)
- Facebook Ads: act_657781691826702 (needs re-auth)
- LinkedIn Ads: 512642510

### Meta Graph API
- Meta Access Token: Active (expires ~2026-06-19)
- Ad Account: 657781691826702 (Themistoklis Baltzakis)
- Instagram Business Account: BLOCKED (IG not linked to FB Page properly)
- Facebook Page: cloudless.gr (116436681562585)

### IFTTT
- Free tier (limited to 2 applets, RSS/Webhooks need Pro)

### Ahrefs
- Connected via MCP (social media features require higher plan)

## Common Multi-Platform Workflows

### Weekly Marketing Report
1. **Windsor.ai**: `get_data(connector="all", fields=["datasource","spend","clicks","impressions","date"], date_preset="last_7d")` — blended overview
2. **Ahrefs**: `gsc-performance-history` — SEO trends
3. **GA4 via Windsor**: `get_data(connector="googleanalytics4", fields=["sessions","users","bounceRate","date"], date_preset="last_7d")` — website traffic

### Campaign Launch
1. **Supermetrics**: `campaign_create` — create the campaign (PAUSED)
2. **Supermetrics**: `campaign_and_resource_get` with `resource_type="reach_estimate"` — estimate audience
3. **Supermetrics**: `campaign_update` — enable after review
4. **Windsor.ai**: Monitor spend/performance after launch

### Content Distribution
1. Create content (Canva for visuals, blog post in Next.js/Notion)
2. **Meta Graph API**: Publish to Instagram
3. **IFTTT**: Auto-cross-post to other platforms via applet triggers
4. **Windsor.ai**: Track engagement across all channels

### Competitive Analysis
1. **Ahrefs**: `site-explorer-organic-keywords` + `site-explorer-referring-domains` for competitor SEO
2. **Ahrefs**: `keywords-explorer-overview` for keyword gaps
3. **Supermetrics**: Compare your ad metrics against industry benchmarks

## Pending Setup Tasks

1. **Facebook on Windsor.ai**: OAuth completed but connector not saved in onboard flow
2. **Facebook on Supermetrics**: Needs separate OAuth authentication
3. **Instagram**: @cloudless_gr IS Business but IG-FB Page connection is in lite mode only — needs full "Review connection" completion at `facebook.com/settings/?tab=linked_instagram`
4. **TikTok**: Need OAuth on Windsor.ai + TikTok Developer Portal app audit for public posting
5. **X (Twitter)**: Need OAuth on Windsor.ai and Supermetrics
6. **YouTube**: Need OAuth on Windsor.ai and Supermetrics
7. **LinkedIn API**: Need to register app on LinkedIn Developer Portal for direct API access (Posts API)
8. **Threads API**: Need to add `threads_basic` + `threads_content_publish` scopes to Meta app
9. **IFTTT Pro**: Needed for RSS triggers and webhook actions
10. **Ahrefs Social**: Needs higher plan tier for social media features

## Important Notes

- Windsor.ai is best for **reading data** across platforms (blended queries)
- Supermetrics is best for **campaign management** + deep analytics
- Meta Graph API is best for **publishing content** to Instagram/Facebook
- IFTTT is best for **automation workflows** between services
- Ahrefs is best for **SEO** — keywords, backlinks, rankings
- Always verify connector status before querying — tokens expire
- Windsor.ai TRIAL: 10 connectors max, 15 accounts max (currently 4/10, 4/15)
