# Ads Manager — Campaign Structure, Audiences, Optimization

End-to-end playbook for launching and running ads in `adsmanager.facebook.com`. Assumes `ad-account.md` has been completed (ad account exists with billing + Pixel).

## 1. The three-level hierarchy

Meta organizes ads as **Campaign → Ad Set → Ad**:

| Level | Defines | Key settings |
|-------|--------|-------------|
| **Campaign** | The goal | Objective (Sales, Leads, Traffic, etc.), campaign budget optimization (CBO), A/B test setup, special ad categories |
| **Ad Set** | The WHO, WHERE, WHEN, HOW MUCH | Audience, placements, budget, schedule, optimization event, bid strategy |
| **Ad** | The WHAT | Creative (image/video/carousel), copy, headline, CTA button, landing URL |

One Campaign can contain many Ad Sets, each with its own audience/placements/budget. Each Ad Set can contain many Ads (creative variations). This is how you A/B test at every level.

### Flat structure for cloudless.gr (small accounts)

For a solo/small business under €1000/mo spend:
- 1 Campaign per objective (e.g., one for "Leads", one for "Traffic")
- 1-2 Ad Sets per Campaign (e.g., one broad, one retargeting)
- 2-3 Ads per Ad Set (different creative variants)

Resist creating 10 ad sets; Meta's learning phase requires ~50 optimization events per ad set per week — fragment your budget and nothing will exit learning.

## 2. Campaign objectives

Meta consolidated from 11 objectives down to 6 in the ODAX update:

| Objective | Optimization events | When to use |
|-----------|---------------------|-------------|
| **Awareness** | Reach, impressions, ad recall lift | Brand launches, broad exposure — not for direct response |
| **Traffic** | Link clicks, landing page views | Drive people to a page; cheap clicks but often junky traffic |
| **Engagement** | Post engagement, page likes, video views, messages | Build community, grow followers, warm up an audience |
| **Leads** | Form submissions (Meta Lead Forms), calls, messages | Service businesses, B2B, consultations — best for cloudless.gr primary objective |
| **App promotion** | App installs, in-app events | Mobile apps only |
| **Sales** | Purchases, add to cart, initiate checkout | E-commerce — requires Pixel + Purchase events firing |

### Objective choice for cloudless.gr

- Primary: **Leads** with optimization for "Contact form submission" (Pixel `Lead` event)
- Secondary: **Traffic** driving to blog posts / case studies for top-of-funnel
- Re-engagement: **Engagement** optimizing for IG post engagements on existing content

## 3. Ad sets — audiences in depth

### Audience types

1. **Saved Audience** (Core) — built from demographic + interest + behavior targeting
2. **Custom Audience** — built from your OWN data (website visitors, customer list, IG engagers, etc.)
3. **Lookalike Audience** — Meta finds people similar to a Custom Audience source
4. **Advantage+ Audience** — Meta picks automatically with minimal targeting input

### Custom Audiences for cloudless.gr

Best sources in priority order:

| Source | How to build | Typical quality |
|--------|-------------|-----------------|
| Website visitors (Pixel) | Ads Manager → Audiences → Create → Custom → Website → define rules (e.g., "all visitors last 180d") | ★★★★★ highest intent |
| Customer list | Upload CSV of emails/phones | ★★★★★ matches existing customers |
| IG engagers | Custom → Instagram account → everyone who engaged in last 90d | ★★★★ warm audience |
| FB Page engagers | Custom → Facebook Page → similar settings | ★★★★ |
| Video viewers | Custom → Video → 25%/50%/75% completion | ★★★ |
| Lead form openers | Custom → Lead form → opened but didn't submit | ★★★★ rescue high-intent drop-offs |

Build these audiences BEFORE launching the first campaign — you'll use them as Exclusion sets even for prospecting.

### Lookalike Audiences

1. Pick a Custom Audience source (minimum 100 matched people; 1000+ is better)
2. Choose country (Greece for most cloudless.gr targeting)
3. Set percentage: 1% = 100k people in Greece, most similar; 10% = 1M people, least similar but larger reach
4. Start with **1%** for top-of-funnel, expand to 3-5% if the 1% audience is too small for €/day budget to spend

### Detailed targeting (interests/behaviors/demographics)

In the Ad Set → Audience → Detailed targeting field, you can add/exclude:
- Interests (e.g., "Web development", "Entrepreneurship", "Small business")
- Behaviors (e.g., "Small business owners", "Frequent travelers")
- Demographics (e.g., job titles — limited post-2022 due to EU DMA changes)

**EU restriction (important for cloudless.gr):** Since the Digital Markets Act took effect, detailed targeting based on sensitive categories (religion, politics, health, sexual orientation) is banned. Meta also phased out many job-title targeting options. Rely more on Custom Audiences + Lookalikes for precision.

### Placements

- **Advantage+ placements (Automatic)** — Meta picks across all surfaces: Feed, Stories, Reels, Audience Network, Messenger, etc.
- **Manual placements** — you select specific surfaces

**Recommendation for small budgets:** Use Advantage+. Meta's delivery algorithm will find the cheapest placement. Going manual requires enough data per placement to optimize, which requires more budget than a €500/mo advertiser typically has.

## 4. Budget & bidding

### Budget level

- **Campaign Budget Optimization (CBO)** — set at campaign level, Meta distributes between ad sets
- **Ad Set Budget Optimization** — set at each ad set, you control distribution

CBO is generally better when you have 2+ ad sets; simplifies management. Required for Advantage+ campaigns.

### Daily vs. lifetime

- **Daily** — Meta spends about €X/day (can vary ±25% on any given day)
- **Lifetime** — Meta spends €X total over the campaign date range; must set end date

Use Lifetime for time-boxed promos (e.g., "Black Friday sale 11/25–11/29"), Daily for evergreen campaigns.

### Bid strategy

| Strategy | What it does | When to use |
|----------|-------------|-------------|
| Highest volume | Maximize results regardless of cost | Default; let Meta optimize |
| Cost per result goal | Hit a specific CPA target | After learning phase; you know what "good" costs |
| ROAS goal | Hit a specific return on ad spend | Sales campaigns with enough conversion data |
| Bid cap | Never pay more than X per event | Experienced advertisers; can starve ad sets |

Start with **Highest volume** (no cap). Only switch to Cost per result goal after you've had 2+ weeks of data.

## 5. Creative — the ad itself

### Formats

| Format | Best for | Specs |
|--------|---------|-------|
| Single image | Simple, fast to produce, CTA-focused | 1080×1080 (1:1) or 1080×1350 (4:5) for feed, 1080×1920 (9:16) for Reels/Stories |
| Single video | Storytelling, demos, high engagement | Same sizes; 15s for feed, ≤60s for Reels, ≤15s for Stories |
| Carousel | Showcase multiple products/messages | 2-10 cards, each 1080×1080 |
| Collection | E-commerce with catalog | Requires product catalog |
| Dynamic creative | Auto A/B test creative combinations | Upload 2-10 images + 2-5 headlines + 2-5 texts; Meta combines |

### Copy structure (primary text)

Best-performing pattern for cloudless.gr:
1. **Hook** (first line, ≤125 chars so it's above "See More")
2. **Value prop** (what problem you solve)
3. **Social proof or specificity**
4. **CTA** (explicit action)

Example:
```
Your Next.js deploy shouldn't break at 2 AM.

cloudless.gr builds battle-tested infra for teams that can't afford downtime.

→ 40+ deployments shipped with zero rollback incidents.

Book a free audit: cloudless.gr/contact
```

### Headline + description

- Headline: 27-40 chars, hook-forward
- Description: 27-30 chars, supports the headline
- Both appear below the image/video

### CTA button

Pick from: Learn More, Sign Up, Contact Us, Book Now, Get Quote, Apply Now, etc. Match to objective.

### Landing page

- Must match the ad promise — if ad says "free audit", landing page must have "free audit" prominently
- Load speed matters; Meta penalizes slow LPs
- Must have the Meta Pixel firing the relevant event (ViewContent, Lead, Purchase)

## 6. Launch checklist

Before clicking **Publish** on your first campaign:

- [ ] Campaign objective matches business goal
- [ ] Special ad category declared if relevant (Housing/Employment/Credit/Politics — EU also requires Social Issues declaration)
- [ ] Ad Set audience is either a Custom Audience or a sensible Saved Audience (not totally broad 18–65+ Greece)
- [ ] Exclusion: anyone who already converted (website visitors who fired Lead/Purchase in last 30d)
- [ ] Placements = Advantage+ (unless you have good reason otherwise)
- [ ] Daily budget ≥ €10 (below this, Meta can't learn)
- [ ] Optimization event = the event you actually track (Lead, Purchase, not just "Link Click")
- [ ] Pixel installed and verified firing correct event on landing page
- [ ] Ad creative passes Meta's policies (no "you" targeting in copy, no misleading claims, no before/after for health/beauty)
- [ ] Copy + headline no misspellings, clear CTA
- [ ] UTMs on landing URL for GA4 / Supermetrics tracking (e.g., `?utm_source=meta&utm_medium=paid&utm_campaign=leads-q2-2026`)
- [ ] Ad account balance / billing threshold high enough to avoid mid-campaign pauses

## 7. Ad review

After publish, ads enter **In Review** status. Typical timing:
- Most ads approve in 15 min – 24h
- Flagged ads can take 48–72h for secondary review
- Rejected ads: read the disapproval reason, edit, resubmit (counts as a new review cycle)

### Common rejection reasons

- "Personal attributes" — using "you" pronouns in a way that implies you know the viewer's circumstances ("Struggling with debt?")
- "Restricted categories" — financial services, gambling, supplements, CBD, weight loss, etc.
- "Misleading" — exaggerated claims without proof
- "Low quality landing page" — slow, popup-heavy, or thin content

Appeal via Ads Manager → the rejected ad → "Request Review". Be specific about what you changed.

## 8. Monitoring & the optimization loop

### What to check daily (first 2 weeks)

- Spend per ad set vs. budget
- CPM (cost per 1000 impressions) — sanity check that delivery is happening
- CTR (click-through rate) — >1% is decent, >2% is good for cold traffic
- CPA (cost per optimization event) — relative to your target

### What to check weekly

- Frequency (how many times the same person sees the ad) — below 3/week is fine; above 5 = audience fatigue
- Results breakdown by placement — if one placement drags down overall, switch to manual and exclude
- Results breakdown by demographic (age + gender) — re-allocate if a group dominates

### Learning phase

- Every new ad set starts in "Learning" until it gets ~50 optimization events in 7 days
- Don't edit during learning — every significant edit resets the phase
- If you haven't exited learning in 14 days, merge ad sets or raise budget

### When to kill an ad

- 3-7 days of underperformance at 2x your target CPA — kill
- Frequency >5 with declining CTR — kill (ad fatigue)
- High CTR but low conversions → audience quality issue, try a different audience
- Low CTR → creative issue, try a different ad

## 9. Attribution

Meta's attribution window default: **7-day click + 1-day view**. Changes dramatically affect reported results.

- Match your window to your business sales cycle (cloudless.gr = long sales cycle, use 7-day click + 1-day view or even extend)
- In Ads Manager column picker, add "Attribution setting" column to always see which window a result count is using
- Cross-reference with GA4 — Meta + GA4 will NEVER perfectly match because of view-through attribution differences, ITP, ad blockers

## 10. Reporting

Three options:

1. **Ads Manager Reports** — built-in, good for quick checks
   - URL: `https://business.facebook.com/adsmanager/reporting`
   - Scheduled email reports daily/weekly
2. **Windsor.ai** — pull Meta data via MCP into Claude or Notion
   - Requires the ad account to be inside a portfolio Windsor is connected to
   - Query via `get_data(connector="facebook", accounts=["<ad_account_id>"], ...)`
3. **Looker Studio** — polished dashboards for clients/stakeholders
   - Connect Windsor → Looker Studio destination
   - Or use Meta's native Looker Studio connector

For cloudless.gr, the MCP path is already wired — Windsor + Claude gives ad-hoc analysis without leaving Cowork.

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| No delivery / zero impressions | Audience too narrow, bid too low, scheduled for future | Widen audience, raise budget, check start date |
| Spending but no conversions | Pixel not firing, wrong event selected, broken landing page | Test Pixel via Helper extension, verify event in Events Manager |
| Rejected for "special ad category" | Category auto-detected based on copy/LP content | Declare category OR edit copy to remove trigger keywords |
| Ads manager shows "Account restricted" | Billing issue or policy strike | Check Account Quality dashboard |
| Results in Ads Manager don't match GA4 | Attribution window + ad blocker + browser privacy | Set up Conversions API (server-side) for better accuracy |
| High CPM vs. industry benchmark | Over-narrow audience, low quality score, high-competition window | Broaden audience, improve creative, shift schedule |
| Frequency climbing fast | Audience too small for budget | Lower budget OR expand audience |

## 12. Policy quick-reference

Full policies: `https://www.facebook.com/policies/ads/`

Most-hit gotchas for cloudless.gr's likely verticals:
- Can't use Meta's trademarks in ad text ("Facebook", "Instagram", "Meta") except factually
- Can't promise specific results ("Guaranteed 10x ROI")
- Can't use before/after imagery for anything body/health related
- Can't claim user attributes ("You're over 40 and...")
- Can't use low-resolution, deceptive, or shock imagery
- Landing page must have a visible privacy policy link (especially for Lead forms)

## 13. Quick launch workflow for the first cloudless.gr campaign

1. **Audience build (do this today)**
   - Custom Audience: cloudless.gr website visitors last 180d (seed for lookalike + retargeting)
   - Custom Audience: IG engagers last 90d
   - Lookalike Audience: 1% from website visitors 180d
2. **Campaign 1: Prospecting**
   - Objective: Leads
   - Ad Set A: Lookalike 1% of website visitors
   - Ad Set B: Saved Audience — Greece, age 25-55, interests "Web development, Next.js, Startups, Small business"
   - Budget: €15/day each ad set, CBO €30/day total
   - Placements: Advantage+
3. **Campaign 2: Retargeting**
   - Objective: Leads
   - Ad Set: Website visitors last 30d who DIDN'T convert
   - Budget: €10/day
   - Creative: testimonial + direct "Book a call" CTA
4. Let run 7 days. Review. Adjust.

Return to `ad-account.md` for Pixel setup if not yet done. Return to `page-and-ig.md` if Page/IG connection still incomplete.
