# Meta Business Suite — Daily Content Ops

The Business Suite is Meta's unified tool for managing Facebook + Instagram from one surface. Web version at `business.facebook.com`, mobile app in iOS/Android stores. This doc covers the day-to-day content workflow for cloudless.gr: posting, scheduling, DMs, insights.

## 1. What Business Suite replaced

- **Creator Studio** (2021–2024) — deprecated, features merged into Suite
- **Pages Manager app** — deprecated, replaced by Business Suite mobile
- **Ads Manager** — still exists separately; Suite has a "lite" Ads section but for anything beyond boosting posts, use `adsmanager.facebook.com`

For cloudless.gr content ops, Business Suite is the primary tool. Ads Manager is only opened for dedicated campaigns.

## 2. Web vs. mobile — feature parity

| Feature | Web | Mobile app |
|---------|-----|-----------|
| Post to FB Page | ✅ | ✅ |
| Post to IG | ✅ | ✅ |
| Schedule posts | ✅ | ✅ |
| Story scheduling | ✅ (7-day limit) | ✅ |
| Reels scheduling | ✅ (with caveats — see §5) | ✅ (limited) |
| DM inbox (FB + IG + Messenger) | ✅ | ✅ |
| Comments across accounts | ✅ | ✅ |
| Insights | ✅ (full) | ✅ (summary) |
| Boost post | ✅ | ✅ |
| Ads creation beyond boost | ❌ (Ads Manager) | ❌ |
| Multi-account switching | ✅ | ✅ |
| Content library (upload assets reusable across posts) | ✅ | ❌ |

**Recommendation:** Do content authoring on web (bigger canvas, easier scheduling), use mobile for inbox/DM management on the go.

## 3. Composer — creating a post

### Web composer flow

1. Business Suite → **Posts & stories** (left nav) → **Create post**
2. Top of composer: select destinations
   - Checkbox for Facebook Page
   - Checkbox for Instagram
   - Can post to one, both, or neither (neither = draft)
3. Write the caption — one text box, but if both FB+IG are checked you can expand a "Customize for each platform" toggle to write distinct copy
4. Add media (image/video/carousel)
5. Tag other accounts (IG mentions, FB tags)
6. Add location (geotag)
7. Choose action button / CTA if posting a FB Link post
8. Bottom: **Publish now** / **Schedule** / **Save as draft**

### Cross-posting gotchas

| What | FB Page | Instagram |
|------|--------|----------|
| Link in post body | Clickable (full URL) | NOT clickable (captions don't linkify); use "link in bio" convention or Stories link sticker |
| #hashtags | Low discoverability (FB doesn't surface hashtag feeds much) | High discoverability — use 3-10 relevant tags |
| Line length of first line | Shorter first line preferred | First line is what shows before "... more" — critical hook space |
| Image aspect ratio | 1:1, 4:5, 16:9 all fine | 1:1 or 4:5 (9:16 for Reels) — 16:9 horizontal crops poorly in feed |
| Character limit | 63,206 | 2,200 (IG) — but first ~125 is what shows |

For cloudless.gr: write the IG version first (more constrained), let FB inherit it, then expand FB with a clickable link as a separate comment if needed.

## 4. Scheduling

### How to schedule

1. Compose as normal
2. Click **Schedule** instead of Publish now
3. Pick date + time (respects the **Page's timezone** — for cloudless.gr = Europe/Athens)
4. Confirm

Scheduled posts appear in **Posts & stories → Scheduled** — you can edit, reschedule, or delete before the publish time.

### Scheduling limits

| Content type | How far ahead | Constraints |
|--------------|--------------|-------------|
| FB Page post | Up to 75 days ahead | No limit on number of scheduled posts |
| FB Story | Up to 7 days ahead | - |
| IG post | Up to 75 days ahead | - |
| IG Story | Up to 7 days ahead | - |
| IG Reel | Up to 75 days ahead | Must be uploaded from Business Suite (not pulled from IG app drafts) |

### Best posting times for cloudless.gr (Greek tech audience)

Rough starting points — validate with Insights after 4 weeks:
- **LinkedIn-adjacent IT audience:** Tue–Thu 9:30–11:30 local, 14:00–16:00 local
- **B2B content:** Weekday mornings before 11:00
- **Personal/brand-building:** Sunday evenings 19:00–21:00 for slow scroll engagement

Avoid: Friday afternoons, all-day Saturdays, public holidays.

## 5. Reels specifics

Reels in Business Suite have quirks that trip people up:

- Reels **scheduled from Suite** behave differently than Reels posted natively from IG app — music library is limited to "commercial use" tracks only (no chart hits)
- Custom audio uploaded with the video works fine
- Thumbnail selection: upload a custom 9:16 image OR pick a frame from the video (frame picker is primitive on web)
- Cover text: can't add via Suite web; if you need Reels cover text, author in Canva/Figma first and upload the finished 9:16 asset
- Captions (burned-in text) should also be authored externally; Suite has no auto-captions for scheduled Reels

For polished Reels workflow: Canva or CapCut → export 9:16 MP4 → upload to Business Suite → schedule.

## 6. Stories

- FB and IG Stories are SEPARATE in Suite — you pick destination at compose time
- Can't schedule more than 7 days ahead
- Stickers (polls, questions, location, music) MUST be added in the native IG app (Suite's composer has limited sticker support)
- Link stickers on IG: available to all Business accounts with verified contact info

For content strategy, treat Stories as real-time tools — don't try to schedule 4 weeks of Stories from Suite, author them same-day or day-before.

## 7. Inbox — unified DMs and comments

Business Suite's Inbox pulls in:
- FB Page messages (from Messenger)
- IG direct messages (only Business account DMs; personal chat accounts don't route here)
- FB Page comments
- IG post comments
- FB Page reviews / Recommendations

### Routing

- One big inbox by default; filter by channel via tabs
- Assign conversations to teammates (if portfolio has multiple people)
- Use labels (e.g., "Lead", "Support", "Spam") to organize
- Saved replies: templates for common questions — Settings → Saved replies

### Automated responses

Suite → Inbox → **Automations**:

- **Instant reply** — auto-responds to the first message of a conversation (e.g., "Thanks for reaching out! We'll get back to you within 1 business day.")
- **Away message** — custom message during hours you're not available
- **FAQs** — bot-style menu of common question → canned answer pairs

For cloudless.gr:
- Instant reply acknowledging receipt + setting 1-business-day expectation
- FAQs covering: pricing, service areas, tech stack, contact options
- Away message: off-hours / weekends

### Notifications

Turn on push notifications in the mobile app for high-priority events (new DM, new review) — otherwise messages sit unread.

## 8. Insights

Suite → **Insights** (left nav) — lighter than Ads Manager or Meta Graph API Insights, but fine for daily/weekly check-ins.

### Key metrics to track

| Metric | What it tells you |
|--------|-------------------|
| Reach | Unique accounts who saw your content |
| Impressions | Total views (includes repeats) |
| Engagement rate | (Reactions + comments + shares) / reach |
| Follower growth | Net new followers per period |
| Profile visits | How many clicked through to the profile |
| Content interactions per post | Ranks your top performers |
| Audience demographics | Age / gender / geo / active times |

### What Insights CAN'T tell you

- Website click-throughs beyond basic link clicks (use GA4 for this)
- Conversion/lead tracking (use Pixel + Ads Manager)
- Historical data beyond 2 years (use Windsor for archival)

For deeper analysis, export or run Windsor + Claude queries.

## 9. Content Planner view

Suite → **Planner** — calendar visualization of scheduled and published content.

- Month / week / day views
- Drag-and-drop to reschedule
- Color-coded by platform
- Click a slot to create a new post at that time

Useful for visualizing content cadence and identifying quiet days. Not useful for campaign planning (no ad campaigns shown).

## 10. Multi-account switching

If you manage multiple businesses:

- Top-left dropdown shows all Portfolios + Pages you have access to
- Click to switch context
- Each switch reloads inbox, insights, scheduled posts, etc. for that account
- Notifications stay global (you see alerts for any managed account)

For cloudless.gr with one portfolio, this is just the one cloudless.gr context.

## 11. Meta Business AI / copy suggestions

Inside the composer, recent additions:

- **Generate variations** — AI rewrites your caption in different tones
- **Generate images** — text-to-image, limited to ad creative quality at time of writing
- **Smart captions** — AI proposes hashtags and mentions

Treat as drafts, always edit. Don't publish AI-raw output — tone and clichés are obvious.

## 12. Troubleshooting content ops

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Post failed" scheduled-time passed | Time was in the past OR offline during publish | Reschedule; ensure wifi present if using mobile for scheduling |
| IG post skips — no error | Account connection went lite-mode | Re-link IG per `page-and-ig.md` |
| Can't schedule Reel | File format wrong (must be MP4, 9:16, <90s) | Re-export |
| Hashtags not clickable on FB | Normal — FB doesn't render hashtags as links like IG | Ignore; or add them as a comment for less visual clutter |
| Inbox shows zero messages | Channel permissions off; toggle in Settings → Inbox → Channels |
| Insights show zero | New account with <7 days data, or account in review | Wait 7+ days; check Account Quality if stagnant |
| Scheduled post publishes with wrong image | Upload race condition OR cache issue | Delete + reschedule, clear browser cache |
| Draft lost after navigate away | Autosave is imperfect | Always click "Save draft" explicitly before leaving the tab |

## 13. Weekly content ops routine for cloudless.gr

Suggested rhythm:

**Monday morning (30 min)**
- Review last week's Insights top-3 posts + bottom-1 post
- Write this week's 3-5 posts in Business Suite
- Schedule across Tue-Fri mornings

**Daily (5 min)**
- Check Inbox, reply to DMs + comments
- Monitor ads (if running) via Ads Manager

**Friday afternoon (15 min)**
- Review week's Insights
- Export data to Notion "Social Media Dashboard" (via Windsor MCP or manual)
- Plan next week's themes

For scheduled automation beyond Suite (e.g., cross-post to LinkedIn, trigger a Slack notification on a new DM), use the existing IFTTT / Windsor integrations — see `social_media_integration.md` in auto-memory.

## 14. Keyboard shortcuts (web)

Some useful ones buried in Suite's web UI:
- `N` — New post from Home
- `I` — Inbox
- `P` — Posts & stories
- `L` — Planner (Content calendar)
- `?` — Show all shortcuts

Only work when focus is on the main pane, not inside a text field.
