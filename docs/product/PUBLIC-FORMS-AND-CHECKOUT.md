# Public forms, email, Slack, and checkout

Operator source of truth for visitor-facing lead/purchase flows on
`https://cloudless.gr` (Pi path via Worker `cloudless2`).

## Addressing

| Role | Env | Default |
|---|---|---|
| From (visitor + team mail) | `SES_FROM_EMAIL` | `noreply@cloudless.gr` |
| Team inbox | `SES_TO_EMAIL` | `tbaltzakis@cloudless.gr` |

Transport (in order): Cloudflare Email Sending API → Resend (`RESEND_API_KEY`).
Resend uses the same `SES_FROM_EMAIL` from-address (not `orders@`).

Slack outbound: `SLACK_BOT_TOKEN` and/or `SLACK_WEBHOOK_URL`, default channel
`SLACK_DEFAULT_CHANNEL`.

## Forms → notify matrix

| Surface | API | Email | Slack |
|---|---|---|---|
| Contact | `POST /api/contact` | Team + visitor ack | `#notifications` (contact form) |
| Newsletter subscribe | `POST /api/subscribe` | Team + welcome | `#subscribers` |
| Unsubscribe | `POST/GET /api/unsubscribe` | Team + confirm | — |
| Calendar book | `POST /api/calendar/book` | — | `#bookings` (503 if Google unbound) |
| Agent book | `POST /api/agent/book` | Visitor confirmation | `#bookings` |
| Chat first message | `POST /api/chat` | `notifyTeam` | chat notify |
| Portal enroll | `POST /api/portal/enroll` | → `tbaltzakis@cloudless.gr` | SlackClient |
| Store cart checkout | `POST /api/checkout` | via Stripe webhook on paid | `#orders` on paid |
| Campaign paid CTA | `GET /api/checkout?campaign&tier` | via Stripe webhook | `#orders` on paid |
| Campaign fit-call | `GET /api/checkout?…&tier=fit-call` | via contact form | contact Slack |

## Stripe secrets (Pi `cloudless-secrets`)

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Webhook endpoint (configure in Stripe Dashboard → Developers → Webhooks):

`https://cloudless.gr/api/webhooks/stripe`

Events: `checkout.session.completed`, `invoice.payment_failed`,
`invoice.payment_succeeded`, subscription lifecycle as implemented in
`src/app/api/webhooks/stripe/route.ts`.

Success URLs:

- Store: `/{locale}/store/success?session_id={CHECKOUT_SESSION_ID}`
- Campaign: `/{locale}/campaigns/{slug}/thanks?tier=&order={CHECKOUT_SESSION_ID}`

See also [`docs/integrations/STRIPE.md`](../integrations/STRIPE.md).

## Public CTAs / locale redirects

Internal links use `@/i18n/navigation` (`Link`, `useRouter`) with **locale-stripped**
paths (`/contact`, `/store`, …). Never prefix `/en/` in those helpers — the
middleware adds the locale (`localePrefix: "always"`).

Campaign buy buttons hit `/api/checkout?campaign=&tier=` (API GET, not i18n Link).

## Playwright

- Config: `playwright.config.mts` (projects: `setup`, `chromium`, `admin`, `mobile-chrome`)
- Public run: `pnpm e2e:run:public`
- Store / checkout journey: `e2e/journey-store-checkout.spec.ts`
- Homepage CTAs: `e2e/ui/pages/homepage.spec.ts`
- Contact: `e2e/journey-contact-lead.spec.ts`, `e2e/contact.spec.ts`

503 on calendar/integrations APIs means “not configured”, not a broken route.
