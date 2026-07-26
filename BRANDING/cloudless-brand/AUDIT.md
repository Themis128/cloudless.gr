# Live-site audit — cloudless.gr (June 18, 2026)

Fetched `https://www.cloudless.gr/` and reconciled every brand assumption.
Findings drive `brand.md` v3 and the corrected social templates.

## What's correct in v2 (carry over to v3)

- ✅ Dark gradient `#0a0a0f → #12121a → #1a1a2e` — matches the blog OG generator at `src/app/[locale]/blog/[slug]/opengraph-image.tsx`.
- ✅ Cyan accent `#00fff5` — confirmed inside the blog OG card (cyan dot prefix, headline tint).
- ✅ Monospace category label aesthetic — confirmed in the OG generator and the live "[ HOW IT WORKS ]" / "[ WHAT WE DO ]" / "[ FAQ ]" / "[ ABOUT ]" section dividers.
- ✅ Cyan fade stripe at the bottom of every card — confirmed.
- ✅ Bilingual content (EN/EL) — extended to **quadrilingual** in v3 (FR + DE also live).
- ✅ Email convention `tbaltzakis@cloudless.gr`.
- ✅ Founder identity Themistoklis Baltzakis.

## What's wrong in v2 (corrected in v3)

| v2 claim | v3 correction | Source |
|---|---|---|
| Primary tagline "Cloud · Serverless · FinOps" | **"Clear skies. Zero friction."** | Hero h1 |
| Voice "FinOps practitioner" | **Anti-enterprise, third-way pragmatist** | Hero subhead, FAQ tone |
| Theme color = `#0a0a0f` | **PWA `theme-color` = `#0a7785`** (teal); `#0a0a0f` is the *background* only | `<meta name="theme-color">` |
| Site is bilingual (EN/EL) | **Quadrilingual: EN/EL/FR/DE** | Locale switcher |
| Stat library: none | Verbatim from site: **99.9% uptime · 14 days first results · 30% bundle savings · 0 lock-in** | Hero metric tiles |
| Service pillars: unstructured | **Numbered set: `01 CLOUD`, `02 SERVERLESS`, `03 ANALYTICS`, `04 AI`** | "WHAT WE DO" section |
| Audience: "audit-buyers" | **2–20 person teams · €50K–€500K revenue · past MVP** | FAQ "Who is this for?" |
| Pricing: not specified | Individual **€800–€2,400**, bundle **€3,600/mo**, vs in-house **€20K+/mo** | FAQ "How much will this cost?" |
| Founder positioning: "FinOps consultant" | **"AWS Certified Cloud Architect, 8+ years building serverless infrastructure and growth systems"** + Credly verified | About section |
| Live brand element: none | **Real-time SLO dashboard widget** (p95 12ms, uptime 99.987%, error 0.04%) | Home page bottom |

## New finding (material to content)

The site footer carries this disclaimer:

> _"This website is a training and portfolio project built for educational purposes only. It is not a commercial service and does not accept clients."_

Material consequence: the 6 social posts I drafted for the Jun 24 – Jul 3 calendar include language like _"60 cost audits in", "we cut a client's bill 80%", "book a 30-minute audit"_. **Those claims contradict the disclaimer.**

Two paths to resolve:

1. **Operational mode** — remove the disclaimer; the drafts ship as-is. Recommended if the site will accept clients.
2. **Portfolio mode** — keep the disclaimer; rewrite each post to "based on hands-on experience" / "how I'd approach this" instead of "we did this for client X". Estimated rewrite effort: 10 minutes per post.

Both modes use the same v3 brand pack. Only the content tense changes.

## Live channels (footer + about section)

| Channel | URL / handle | Connected to Postiz? |
|---|---|---|
| LinkedIn company page | linkedin.com/company/cloudless-gr | ✅ |
| LinkedIn personal | (Themis personal) | ✅ |
| Facebook | (Cloudless.gr page) | ✅ |
| GitHub org | github.com/cloudless-gr | n/a (handled in repo READMEs) |
| Credly | credly.com/users/themistoklis-baltzakis | n/a (link in footer) |
| Email | tbaltzakis@cloudless.gr | n/a (mailto:) |

## Pages discovered (full sitemap from nav)

`/en`, `/en/services`, `/en/store`, `/en/blog`, `/en/contact`, `/en/privacy`, `/en/terms`, `/en/cookies`, `/en/refund`, `/en/accessibility`. Same set repeated under `/el/`, `/fr/`, `/de/`.

Brand pack applies uniformly across all locales. The **only** locale-specific asset is the hero tagline translation (§9 of `brand.md`).

— end —
