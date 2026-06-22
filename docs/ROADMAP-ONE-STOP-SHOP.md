# Roadmap: cloudless.gr as a One-Stop Agency Platform

Goal: run the whole client lifecycle inside cloudless.gr — capture and convert
leads, plan and publish social media campaigns across all major platforms, and
deliver the client-facing promise (portal, reports, approvals, payments).

Strategy: **mix build/buy per feature**. Build natively where the repo already
has the pattern (ad insights, PDF reports, Stripe, SES); integrate where a
service does the heavy lifting better (ActiveCampaign automations, Postiz for
social publishing).

---

## Current state (verified against the codebase, 2026-06-12)

| Area | Already built | Key files |
|------|---------------|-----------|
| Lead capture | Contact form → EspoCRM contact + ticket, newsletter/subscribe | `src/app/api/contact`, `src/lib/hubspot.ts` |
| CRM | Companies, tickets, pipeline views, EspoCRM dashboard | `/admin/crm/*`, `/admin/pipeline`, `/admin/hubspot` |
| Email marketing | SES transactional + suppression, ActiveCampaign client, campaigns page | `src/lib/email.ts`, `src/lib/ses-suppression.ts`, `src/lib/activecampaign.ts`, `/admin/email/campaigns` |
| Ad campaign insights | Google, LinkedIn, TikTok, X (read-only insights) | `src/lib/campaigns/{google-ads,linkedin,tiktok,x-ads}.ts` |
| Attribution plumbing | Meta Pixel + Conversions API, GSC | `src/lib/meta-capi.ts`, `src/lib/meta-pixel.ts`, `src/lib/gsc.ts` |
| Content planning | Notion-backed content calendar (social/email/blog/ad items, platforms incl. meta) | `src/lib/content-calendar.ts`, `/admin/calendar` |
| AI content | Workers AI generator, AI assistant, voice brief | `/admin/ai-generator`, `/admin/ai-assistant`, `/admin/voice-brief` |
| Client portal | Token-based portal with project timeline, enroll/approval flow | `src/app/portal/[token]`, `/admin/client-portals`, `src/lib/pending-clients.ts` |
| Reporting | Analytics report PDFs, unified analytics, KPI dashboard | `src/lib/analytics-report-pdf.ts`, `/admin/analytics/unified`, `/admin/kpi` |
| Payments | Stripe store + checkout + subscriptions | `src/lib/stripe.ts`, `/store`, `/admin/subscriptions`, `/admin/orders` |
| Notifications | Slack notify, admin notifications | `src/lib/slack-notify.ts`, `/admin/notifications` |

### Gaps

1. **No Meta/Instagram anywhere in campaigns** — `src/lib/campaigns/` has no
   Meta module despite the calendar listing `meta` as a platform.
2. **No publishing** — the calendar plans posts but nothing posts them.
3. **No lead scoring or automated follow-up** — leads land in EspoCRM and stop.
4. **No campaign→lead→revenue attribution** — insights, CRM, and Stripe data
   are never joined.
5. **Portal has a timeline but no deliverables, approvals, scheduled client
   reports, or project-linked invoicing.**

---

## Phase 1 — Lead engine (mostly wiring, highest ROI)

Make every lead captured, scored, routed, and followed up automatically.

1. **Unified lead inbox** (`/admin/leads`): one view joining EspoCRM contacts,
   contact-form tickets, newsletter signups, and portal enrollments
   (`pending-clients.ts`). *Build* — thin UI over existing libs.
2. **Lead source attribution**: persist UTM params + landing page on the
   contact form and pass them to EspoCRM properties and Meta CAPI events
   (plumbing exists in `meta-capi.ts`). *Build.*
3. **Lead scoring**: simple rules engine (source, service interest, company
   size, engagement) writing a score property to EspoCRM. *Build* — avoids
   EspoCRM Pro-tier licensing.
4. **Automated follow-up sequences**: trigger ActiveCampaign automations from
   lead events (new lead, no-reply-3-days, proposal-sent). *Integrate* —
   `activecampaign.ts` already authenticates; build the trigger calls, let
   ActiveCampaign own the sequences.
5. **Instant alerts**: new-lead Slack notification with score and source via
   `slack-notify.ts`. *Build* — one function call.

## Phase 2 — Social publishing, all platforms

Close the biggest gap: actually publish to Meta, Instagram, LinkedIn, X,
TikTok from the calendar.

1. **Deploy Postiz on the k3s cluster** (open-source social scheduler,
   28+ channels incl. Meta, Instagram, LinkedIn, X, TikTok, YouTube; has a
   public API). *Integrate/self-host* — one Helm/manifest deploy on the
   existing Pi cluster, no per-seat SaaS fees, full data ownership.
2. **Wire the content calendar to Postiz**: `social_post` calendar items get a
   "Publish/Schedule" action that calls the Postiz API; status syncs back
   (scheduled → published → failed). *Build the bridge, integrate the engine.*
3. **AI → calendar → publish flow**: extend `/admin/ai-generator` with
   "Add to calendar" so generated copy lands as a draft calendar item ready to
   schedule. *Build.*
4. **Meta Ads insights module**: add `src/lib/campaigns/meta-ads.ts` (Graph
   API Marketing Insights) + `/admin/campaigns/meta` page, mirroring the
   existing Google/LinkedIn/TikTok/X pattern. *Build native* — the pattern is
   established and read-only insights need no app review beyond standard
   Marketing API access.
5. **Organic performance pull-back**: nightly cron (`src/app/api/cron`)
   pulling post metrics from Postiz into the calendar items for reporting.

## Phase 3 — Client portal: complete the front-end promise

1. **Deliverables**: file/link deliverables attached to portal projects with
   status (draft → in review → approved), stored in Notion
   (`notion-projects.ts` pattern) or S3. *Build.*
2. **Client approvals**: approve/request-changes buttons in the portal, with
   Slack + email notifications to you. *Build.*
3. **Scheduled client reports**: monthly per-client PDF (campaign performance
   + project status) generated by `analytics-report-pdf.ts`, emailed via SES
   on a cron. *Build* — both halves exist, join them.
4. **Project-linked billing**: Stripe invoices/checkout links attached to
   portal projects; payment status visible to the client. *Integrate Stripe
   invoicing* — `stripe.ts` exists, add invoice creation + webhook handling
   (webhooks route exists).

## Phase 4 — Unify: the one-stop dashboard

1. **ROI view**: extend `/admin/analytics/unified` to join ad spend
   (campaign insights) → leads (EspoCRM, with Phase-1 attribution) → revenue
   (Stripe) per channel and per client.
2. **Client health score** on `/admin/kpi`: project status + payment status +
   engagement, with alerts for at-risk clients.
3. **Weekly owner digest**: Slack/email summary (new leads, published posts,
   pending approvals, overdue invoices) via cron.

---

## Suggested order & sizing

| Phase | Effort (rough) | Depends on |
|-------|----------------|------------|
| 1 Lead engine | 3–5 dev days | nothing — wiring existing libs |
| 2 Social publishing | 5–8 dev days + Postiz deploy + platform app credentials | Meta/TikTok/LinkedIn/X developer apps connected to Postiz |
| 3 Client portal | 5–7 dev days | Stripe invoicing enabled |
| 4 Unified dashboard | 3–4 dev days | Phases 1–3 data |

External prerequisites (human actions): Meta developer app with
`pages_manage_posts`/Instagram Graph access for Postiz, TikTok/LinkedIn/X app
credentials, ActiveCampaign automation IDs, Stripe invoicing enabled.

Each phase ships independently and adds standalone value; stop or reorder at
any phase boundary.
