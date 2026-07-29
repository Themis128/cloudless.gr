# Cloudless brand guidelines

_Version 3.0 · June 2026 · audited against the live cloudless.gr (EN/EL/FR/DE) and reconciled with public 2026 brand best practices (Hootsuite, Buffer, WCAG 2.1 AA, Evil Martians favicon spec)._

This is the **single source of truth** for everything that ships with the Cloudless name. The website, the blog OG cards, every LinkedIn / Facebook / IG / X / Bluesky post, the slide decks, the proposal PDFs, the invoices, the email signatures. If anything you're about to publish contradicts this doc, this doc wins.

**v3 corrects v2 from the live site:** primary tagline restored to **"Clear skies. Zero friction."**, theme color set to the actual PWA color **#0a7785**, locales expanded to **EN/EL/FR/DE**, the numbered 4-pillar service set reflected, the live-metrics widget added as a brand element, and the "training/portfolio project" status flagged.

---

## 0. Brand integrity note (READ FIRST)

The cloudless.gr footer currently states: _"This website is a training and portfolio project built for educational purposes only. It is not a commercial service and does not accept clients."_

That sentence materially affects any claim in marketing copy of the form _"we run client audits", "we cut your bill", "60 audits delivered"_, etc. Two paths exist — pick one and stay consistent:

- **(A) Operational mode**: remove the disclaimer; all marketing copy is fair game. **Recommended** if you intend the site to convert prospects.
- **(B) Portfolio mode**: keep the disclaimer; reframe every social post and case study as **"how I would do it"** / **"based on hands-on experience"** rather than _"we did this for a client"_. The 6-post content pack we drafted is fully usable in this mode after a 10-minute rewrite of the verb tense.

The rest of this doc works for either mode — it just flags both.

---

## 1. Name & taglines

**Cloudless** — one word, capital C, no space, no hyphen.

In writing, the suffix `less` may be tinted with the brand cyan to reinforce the wordmark, but it must remain legible (contrast ≥ 4.5:1).

| Slot | Text |
|---|---|
| **Primary hero tagline** | **"Clear skies. Zero friction."** |
| **Subhead (long)** | "Enterprise cloud? You can't afford it. DIY infrastructure? You shouldn't. We're the third way — serverless, data-driven growth, and scaling that actually fits a 2–20 person team." |
| **Subhead (short)** | "The third way. Serverless, data-driven, no enterprise BS." |
| **SEO title** | "Cloudless — Cloud Computing, Serverless & AI Marketing" |
| **SEO description** | "Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing." |
| **Footer signature** | "Cloud architecture, serverless, data analytics & AI marketing for startups and SMBs." |
| **Social signature line** | "— Cloudless · cloudless.gr" (or "— Themis · Cloudless · cloudless.gr" on the personal account) |
| **Voice card (1-liner)** | "Enterprise-grade cloud without the enterprise price or the enterprise BS." |

## 2. Color system

The palette is tight: one teal-dark anchor, three near-blacks, two cyans, three inks. CMYK + Pantone equivalents for print.

| Token | Hex | RGB | CMYK | Pantone (closest) | Where it's used |
|---|---|---|---|---|---|
| `--theme` | **`#0a7785`** | 10,119,133 | 92,30,40,30 | 7715 C | **PWA `theme-color`**, browser chrome on mobile, address bar tint |
| `--bg-0` | `#0a0a0f` | 10,10,15 | 70,67,52,82 | Black 6 C | Primary dark background, base of every gradient |
| `--bg-1` | `#12121a` | 18,18,26 | 67,64,46,71 | Black 7 C | Mid-stop of the gradient |
| `--bg-2` | `#1a1a2e` | 26,26,46 | 80,75,40,52 | 5395 C | Far end of the gradient |
| `--cyan` | `#00fff5` | 0,255,245 | 60,0,21,0 | 311 C | Visual accent, logo, links, category dots, glow rings |
| `--cyan-dim` | `#0ad4ff` | 10,212,255 | 65,5,0,0 | 306 C | Secondary cyan, gradient pair with `--cyan` |
| `--ink-100` | `#ffffff` | 255,255,255 | 0,0,0,0 | — | Primary text on dark |
| `--ink-60` | `rgba(255,255,255,.6)` | — | — | — | Secondary text on dark |
| `--ink-30` | `rgba(255,255,255,.3)` | — | — | — | Borders, dividers, subtle UI |
| `--link-light` | `#005c66` | 0,92,102 | 90,40,40,40 | 7715 C dk | **Accessible link/accent on white backgrounds** (8.1:1 on `#ffffff`) |

### 2.1 Why two cyans

`--theme` (#0a7785) is the **PWA / OS chrome** color — set in `<meta name="theme-color">`, used by mobile browsers and Add-to-Home-Screen. It's a desaturated teal that reads well at small sizes and against any background.

`--cyan` (#00fff5) is the **visual accent** — used inside the canvas (OG covers, social cards, dots, glow rings, link hovers). It's high-saturation, designed to pop on the dark gradient.

They're harmonious (both cyan family) but serve different functions. Don't substitute one for the other.

### 2.2 Gradient rule

Canonical brand gradient: `linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a2e 100%)`. Don't reverse the angle, don't shorten the stops, don't add intermediate colors.

### 2.3 Cyan glow + grid

One glow per surface, top-right or bottom-left:

```css
background: radial-gradient(closest-side, rgba(0,255,245,.18), rgba(0,255,245,0));
filter: blur(40px);
```

Grid overlay 60–72px at `rgba(0,255,245,.04–.05)`. Signals infrastructure / engineering without shouting.

### 2.4 WCAG contrast pairs (measured)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#ffffff` | `#0a0a0f` | **19.5:1** | AAA — any text size |
| `#00fff5` | `#0a0a0f` | **18.4:1** | AAA — any text size |
| `#0a7785` (theme) | `#ffffff` | **5.4:1** | AA for normal text, AAA for large |
| `#0a7785` | `#0a0a0f` | **3.6:1** | Large text only |
| `#005c66` | `#ffffff` | **8.1:1** | AAA for normal text |
| `rgba(255,255,255,.6)` | `#0a0a0f` | **7.0:1** | AAA for normal text |
| `#00b8b0` | `#ffffff` | **2.6:1** | ❌ FAILS — DEPRECATED in v3, use `#005c66` everywhere on light bg |

WCAG 2.1 AA is the floor on every public surface. AAA where possible.

## 3. Typography

| Role | Stack | Weight | Size | Tracking | Line-height |
|---|---|---|---|---|---|
| Display | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif` | 800 | 84–120px | `-2 to -3.5px` | 1.02–1.05 |
| H1 (blog) | same | 800 | 40–52px | `-1px` | 1.15 |
| H2 (blog) | same | 700 | 28–32px | `-0.5px` | 1.25 |
| **Body** | same | **400/500** | **≥16px (1rem)** | normal | **≥1.5** |
| Meta / category labels | `ui-monospace, "JetBrains Mono", "SF Mono", Consolas, monospace` | 500 | 14–22px | `0.22em`, **uppercase** | 1.2 |
| Stats display (the metrics widget) | mono | 700 | 28–48px | `-0.02em` | 1.0 |
| Inline code | same monospace | 500 | 0.95em | normal | 1.4 |

**No serif type.** Geometric sans + monospace, nothing else. Body minimum 16px / 1.5 line-height on cloudless.gr — no exceptions.

## 4. Logo system

Five SVG variants under `web/`, six raster exports under `print/`:

| File | Purpose |
|---|---|
| `web/cloudless-icon.svg` | Square mark with the negative-space cloud + slash. Favicon size up to ~256px. |
| `web/cloudless-wordmark-dark.svg` | Default lockup for website, social cards, banner. |
| `web/cloudless-wordmark-light.svg` | Lockup for white surfaces — invoices, proposals, print. Uses `#005c66` accent (NOT the deprecated `#00b8b0`). |
| `web/cloudless-wordmark-mono.svg` | `currentColor`-driven single-tone fallback. Stamps, watermarks, low-color print. |
| `web/cloudless-wordmark-ko.svg` | Knock-out all-white version for placement over photography / colored fills. |
| `print/cloudless-wordmark-{dark,light}-{256,512,1024}.png` | Raster exports at 1×/2×/3×. |
| `print/cloudless-icon-1024.png` | Icon raster at 1024px. |

### 4.1 Clear-space

Reserve **1× the height of the "C" in the wordmark** on all four sides. On the icon alone, reserve **0.25× the icon's height**.

### 4.2 Minimum size

| Asset | Web min | Print min |
|---|---|---|
| Icon | 16×16 px | 8mm |
| Wordmark | 120 px wide | 25mm wide |

### 4.3 Don'ts

- Don't stretch or skew.
- Don't put the wordmark on a busy photograph without a ≥40% black gradient overlay.
- Don't substitute `--theme` (#0a7785) for `--cyan` (#00fff5) inside the mark — they're different colors with different jobs.
- Don't replace the mark with "☁️" or "🌥".
- Don't rotate the mark.
- Don't add a drop shadow that isn't the spec-defined cyan glow.

## 5. Surface dimensions (all canonical sizes — 2026 social standards)

### 5.1 Web / OG

| Surface | Size | Notes |
|---|---|---|
| Open Graph (default) | **1200×630** | Used as the OG card and the Twitter/X large-image card. |
| Twitter/X variant | 1200×675 | Same render, slight crop. |

### 5.2 LinkedIn

| Surface | Size | Notes |
|---|---|---|
| Native feed image | **1200×1200** | Best engagement when no external link is in the post. |
| Link-share preview | **1200×627** | When the post has a URL. Mirror of OG. |
| Page banner | **1584×396** | One-time. Tagline + URL. |
| Profile photo | **400×400 min** | Icon only. |

### 5.3 Meta (Facebook + Instagram) — 2026 priority

| Surface | Size | Notes |
|---|---|---|
| **Portrait feed (DEFAULT)** | **1080×1350** | 4:5. Meta prioritises this over 1:1 in feed in 2026. |
| Square feed | 1080×1080 | Acceptable, lower reach than portrait. |
| Story / Reel | **1080×1920** | 9:16. Top 250px / bottom 310px reserved for UI. |
| FB cover | 820×312 desktop, 640×360 mobile | Re-crop from the 1584×396 LinkedIn banner. |

### 5.4 X / Twitter

| Surface | Size |
|---|---|
| In-stream image | 1600×900 |
| Header / banner | 1500×500 |
| Profile photo | 400×400 min |

### 5.5 Universal layout rule

Every public surface ends in the **cyan fade stripe** at the bottom — full cyan → transparent, 5–10px tall. It's the single most recognisable Cloudless tell. Don't omit it.

### 5.6 The "live metrics widget" element

The home page renders a real-time SLO panel:

- p95 latency: `12ms` (-18% / 24h)
- Uptime 30d: `99.987%` (SLO 99.9% — target met)
- Error rate: `0.04%` (-40% / week)

This **is** a brand element. When designing decks, social cards, or proposal covers, including a stylised mock of this widget (sparkline + 3-stat tiles + "data source: cloudwatch-prod") instantly reads as Cloudless. Don't overuse — once per deck, once every 4–5 social posts.

## 6. Voice & tone — corrected from the live copy

The site voice isn't "FinOps practitioner" (my v2 guess) — it's sharper. **Anti-enterprise, third-way, pragmatist.** Hard numbers, dry humor, zero buzzwords.

### 6.1 Site signature moves

- **"Clear skies. Zero friction."** — the hero. Always present, never paraphrased.
- **"The third way"** — positioning. Always used as the bridge between "enterprise" and "DIY."
- **"No enterprise BS"** / **"holding your code hostage"** — the rage hooks. Reserve for personal-account posts and high-conviction copy.
- **Founder framing**: "Themistoklis Baltzakis — AWS Certified Cloud Architect, 8+ years building serverless infrastructure and growth systems."
- **Numbered service pillars**: `01 CLOUD`, `02 SERVERLESS`, `03 ANALYTICS`, `04 AI` — always in that order, always with the 2-digit prefix.

### 6.2 Stat library (use verbatim)

These appear on cloudless.gr and should be reused for brand consistency:

- **99.9% uptime SLA**
- **14 days first results** (with the guarantee: "or we keep working until you see it")
- **30% bundle savings** (vs. individual services)
- **0 lock-in contracts** (month-to-month)
- **2–20 person teams · €50K–€500K revenue** (the ICP)
- **Pricing**: individual services **€800–€2,400**, full bundle **€3,600/mo**, vs. in-house headcount **€20K+/mo**

### 6.3 Do

- First-person POV from Themis on personal-account posts. "We at Cloudless" on company-page posts.
- Hard numbers. Specific service names (Aurora Serverless v2, Lambda SnapStart, Karpenter). Reader should recognise we've used them.
- Concrete CTAs: **"Book a Free Audit"**, **"Get the Playbook"**, **"DM me"**. Never "reach out."
- Short paragraphs. ≤3 lines on LinkedIn, ≤4 in blog body.
- The 1-liner cadence the site uses: _"Enterprise cloud? You can't afford it. DIY infrastructure? You shouldn't. We're the third way."_

### 6.4 Don't

- **"Cloud-native journey," "leverage synergies," "thought leadership,"** "digital transformation."
- Generic stock photos.
- Promise outcomes that conflict with the **portfolio-mode disclaimer** (see §0). If the disclaimer stays, every "we cut a client's bill" claim needs a tense rewrite ("how I'd cut a bill"). Pick a mode.
- Hashtag walls. 5 tags max. `#Cloudless` always last.

### 6.5 Branded hashtag sets

| Theme | Set |
|---|---|
| Default (any topic) | `#CloudCost #FinOps #AWS #Serverless #Cloudless` |
| Migration topic | `#CloudMigration #AWS #Architecture #Serverless #Cloudless` |
| Greek market | `#CloudGreece #FinOpsGreece #StartupGreece #AWS #Cloudless` |
| AI marketing topic | `#AIMarketing #SEO #GrowthEngineering #Cloud #Cloudless` |

## 7. AI-generated content disclosure

Whenever a piece of public content was substantively drafted by AI (Claude, Postiz Copilot, or any LLM), disclose at the bottom in italic gray:

> _Draft assistance: Claude (Anthropic). Reviewed and approved by the Cloudless team._

EU AI Act 2026 compliance requirement for content presented as factual analysis. Pure human-written posts need no marker.

## 8. Motion design

Default animation curve: **`cubic-bezier(0.22, 1, 0.36, 1)`** (smooth ease-out). Default duration: **200ms** micro / **350ms** transition / **600ms** page entrance.

- **No parallax on text** (vestibular hazard).
- **Respect `prefers-reduced-motion`** — disable all non-essential motion.
- **Cyan glow may pulse** at ≥2s duration and ≤30% max opacity delta.
- **The metrics widget sparkline** animates left-to-right on first paint. Reuse the same `cubic-bezier`.

## 9. Locales — full quadrilingual support

The site ships **EN / EL / FR / DE**. Brand assets must work in all four:

- **Logo**: language-agnostic — no change per locale.
- **Tagline**: each locale needs a native translation that preserves the punch. Suggested translations:

| Locale | Hero tagline | Subhead |
|---|---|---|
| **EN** | Clear skies. Zero friction. | The third way. Serverless, data-driven, no enterprise BS. |
| **EL** | Καθαρός ουρανός. Μηδέν εμπόδια. | Η τρίτη λύση. Serverless, βασισμένο στα δεδομένα, χωρίς εταιρικές μ@λακίες. |
| **FR** | Ciel dégagé. Zéro friction. | La troisième voie. Serverless, piloté par la donnée, sans BS d'entreprise. |
| **DE** | Klarer Himmel. Null Reibung. | Der dritte Weg. Serverless, datengetrieben, kein Unternehmens-BS. |

**Greek font fallback**: ensure the sans stack includes a glyph for U+03A9 (Ω) and U+1F00–U+1FFF range. `system-ui` covers it on every supported OS.

## 10. Blog page convention

- Primary keyword in **first 100 words**.
- H1 fits the OG card title slot (≤60 chars).
- `Category` Select: `FinOps`, `Serverless`, `Strategy`, `Case Studies`, `Architecture`.
- `Cover Image` either left empty (auto-OG kicks in — preferred) or pointing at `cloudless-brand/social-cards/<slug>.png`.
- `Status`: `In Review` while drafting → `Published`.
- Numbers in first two paragraphs. If none in 200 words, the post isn't on-brand.
- Alt text on every image.

## 11. Postiz post convention

- Branded hashtag set (§6.5).
- Signature line (§1).
- Link → `https://cloudless.gr/<locale>/blog/<slug>` or `/<locale>/contact` for CTA-only posts.
- Attached image — per-post social card from `social-cards/<slug>.png`.
- Alt text matching the headline.

## 12. Accessibility checklist (before publishing anything)

- [ ] All text contrast ≥ 4.5:1 (normal) or 3:1 (large).
- [ ] Body text ≥ 16px, line-height ≥ 1.5.
- [ ] Every image has `alt`. Decorative gets `alt=""` + `role="presentation"`.
- [ ] Visible focus rings (cyan, 2px, 2px offset).
- [ ] No information conveyed by color alone.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] `axe-core` Playwright suite green.
- [ ] All 4 locale variants render correctly with their native fonts.

## 13. Connected channels (Postiz on omv as of June 18, 2026)

| Channel | Postiz ID | Voice mode | Status |
|---|---|---|---|
| LinkedIn Page · cloudless.gr | `cmqaxib15000alz7gll7ex3qt` | company | ✅ connected |
| LinkedIn Personal · Themistoklis | `cmqaxhor20008lz7go1ghiomv` | practitioner | ✅ connected |
| Facebook · Cloudless.gr | `cmqaq5vmj0001lz7gflfmprd3` | company | ✅ connected |
| X / Twitter | — | — | ⛔ not connected |
| Instagram | — | — | ⛔ not connected |
| Threads | — | — | ⛔ not connected |
| Bluesky | — | — | ⛔ not connected |
| GitHub (cloudless-gr) | n/a | dev-ops | ✅ separate channel for repos/README |

## 14. File locations (canonical)

```
cloudless-brand/
├── brand.md                           # this doc (v3)
├── README.md                          # quick-ref index
├── web/                               # SVGs for web
│   ├── cloudless-icon.svg
│   ├── cloudless-wordmark-dark.svg
│   ├── cloudless-wordmark-light.svg
│   ├── cloudless-wordmark-mono.svg
│   └── cloudless-wordmark-ko.svg
├── print/                             # raster exports
│   ├── cloudless-wordmark-{dark,light}-{256,512,1024}.png
│   └── cloudless-icon-1024.png
├── favicon/                           # the modern 5-file kit
│   ├── favicon.svg                    # primary — prefers-color-scheme aware
│   ├── favicon.ico                    # legacy multi-size
│   ├── apple-touch-icon.png           # 180×180
│   ├── favicon-192.png
│   ├── favicon-512.png
│   ├── favicon-maskable-512.png
│   ├── site.webmanifest
│   ├── HEAD-SNIPPET.html              # paste into layout.tsx <head>
│   └── README.md
├── social/                            # HTML templates per surface
│   ├── preview-social-card-linkedin-1200x630.html
│   ├── preview-social-card-square-1080x1080.html
│   ├── preview-linkedin-banner-1584x396.html
│   ├── preview-linkedin-feed-1200x1200.html
│   ├── preview-portrait-1080x1350.html
│   ├── preview-story-1080x1920.html
│   ├── preview-x-header-1500x500.html
│   └── preview-x-instream-1600x900.html
└── social-cards/                      # per-post rendered PNGs (build on demand)
    └── <slug>.png
```

When v3 is blessed, the canonical home moves to `docs/brand/` inside the cloudless.gr repo and stays under version control.

## 15. Versioning

| Version | Date | What changed |
|---|---|---|
| v1.0 | 2026-06-17 | Initial pack from `opengraph-image.tsx` inference. |
| v2.0 | 2026-06-18 | Closed 2026 best-practice gaps (favicon kit, WCAG, CMYK, AI/motion sections, full social-size matrix). |
| **v3.0** | **2026-06-18** | **Reconciled against live cloudless.gr**: primary tagline restored to "Clear skies. Zero friction.", `--theme` token added (#0a7785), 4-locale support, numbered service pillars, stat library, live-metrics widget as brand element, portfolio-mode integrity note. |

Any change to color tokens, the gradient ratio, or the primary tagline is **breaking** — flag in the cloudless.gr CHANGELOG and archive previous version assets to `archive/v<n>/`.

— end —
