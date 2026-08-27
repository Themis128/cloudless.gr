# Email infrastructure — cloudless.gr

Canonical map of mailbox, transactional, and marketing email. Verified
2026-08-14 against the repo. Self-hosted runbook details:
[`MAIL-SERVER-SETUP.md`](./MAIL-SERVER-SETUP.md).

## Three systems (do not conflate)

| System              | Purpose                           | Path                                          |
| ------------------- | --------------------------------- | --------------------------------------------- |
| Self-hosted mailbox | Human IMAP + Roundcube compose    | omv-ha dovecot + postfix → Resend `:587`      |
| App transactional   | API-driven mail from Next on Pi   | `@/lib/email` → CF Email REST → Resend        |
| ActiveCampaign      | Marketing campaigns / automations | AC API; contact form `enrollLeadInAutomation` |

Slack (`slack-notify.ts`) is a parallel ops channel, not a mail transport.
EspoCRM has its own SMTP bootstrap still pointed at **AWS SES**
(`scripts/espocrm-smtp-bootstrap.sh`) — separate from the Next app path.

## Self-hosted mail (omv-ha)

- Host: **omv-ha** (Pi 4, out of k3s). Starlink CGNAT — no public IP; port 25 blocked.
- Mailbox: `tbaltzakis@cloudless.gr` · Webmail: https://webmail.cloudless.gr
- Tunnel: `e977a490-58c5-4fdb-9155-86832e3e636a` → `192.168.1.130:80`
- **Inbound (LIVE 2026-08-26):** Cloudflare Email Routing → Worker `mail-ingest`
  → `POST https://webmail.cloudless.gr/ingest` → dovecot-lda → Maildir.
  `tbaltzakis@` + catch-all → Worker; all addresses land in
  `tbaltzakis@cloudless.gr` Maildir. `FALLBACK_FORWARD` → Gmail only on ingest failure.
- Clients: IMAPS `:993` + submission `:587` on omv-ha (Tailscale / LAN);
  Roundcube at https://webmail.cloudless.gr.
- Installer: `infrastructure/omv-ha/setup-mail-server.sh` +
  `infrastructure/omv-ha/mail-ingest/` + `workers/mail-ingest/`.
- Admin nav: Infrastructure → Webmail.
- DMARC: `_dmarc.cloudless.gr` live (`p=none`, RUA → `dmarc@` → catch-all → Gmail).
- SPF: single TXT `v=spf1 include:_spf.mx.cloudflare.net include:_spf.resend.com ~all`
  (duplicate `v=spf1 mx ~all` removed 2026-08-26 — was locking Email Routing).

Superseded: `infrastructure/snappymail/`, omv `/srv/mailcow` (quarantined).

## App transactional (`src/lib/email.ts`)

Dispatch order:

1. Workers + `EMAIL` binding (`wrangler.jsonc` `send_email`)
2. Cloudflare Email Sending REST (`email-cloudflare.ts`) when account + token set
3. Resend SDK (`email-resend.ts`) when `RESEND_API_KEY` set
4. Else throw

Before send: D1 `email_suppression` via `ses-suppression-d1.ts` (Pi resolves
AUTH_DB through `getAuthDbFromEnv()`).

From address: `noreply@cloudless.gr` (Resend may use `SES_FROM_EMAIL` env —
legacy name only). `notifyTeam()` uses `SES_TO_EMAIL` (default
`tbaltzakis@cloudless.gr`).

API routes import **`@/lib/email`**, not `email-sender.ts` (Workers-only helper).

Facade helpers: welcome, order confirmation, payment failure, activation,
password reset, contact acknowledgment, booking confirmation, unsubscribe
confirmation, plus raw `sendEmail`.

Supporting: `render-email.ts` (React Email), `client-report-email.ts`
(`buildReportHtml` for monthly portal cron).

## Marketing (ActiveCampaign)

- Admin APIs under `/api/admin/email/{campaigns,lists,automations,contacts,stats}`
- `/api/contact` fire-and-forget `enrollLeadInAutomation` when
  `ACTIVECAMPAIGN_LEAD_AUTOMATION_ID` is set (silent no-op otherwise)

## DNS / ops scripts

Active theme: `configure-email-routing.sh`, `setup-email-routing.mjs`,
`cloudflare-email-setup.sh`, `setup-email-deliverability.sh`,
`setup-email-dns.sh`, `disable-cloudflare-email-obfuscation.sh`.

Legacy SES (retired for the Next app): `provision-ses-smtp.sh`,
`ses-iam-grant.sh`, archived workflows under `.github/workflows.archived/`.
See `docs/aws/EMAIL-SES.md`.

## Tests

`__tests__/email.test.ts`, `client-report-email.test.ts`,
`ses-suppression.test.ts`, `auth-resend-verification-api.test.ts`,
`admin-email-api.test.ts`.

## Verification (2026-08-14)

| Check | Result |
| --- | --- |
| `pnpm exec vitest run __tests__/email.test.ts __tests__/ses-suppression.test.ts` | 20/20 pass (includes skip-when-suppressed) |
| `admin-email-api` + `client-report-email` + `auth-resend-verification-api` | 26/26 pass |
| Remote D1 `email_suppression` table on `user-auth-db` | Present (`SELECT` ok; 0 rows at probe time) |
| `https://webmail.cloudless.gr/` | HTTPS reachable (Roundcube) |
| Doc consistency | Inbound = Worker→dovecot (+ Gmail catch-all/fallback); App = CF REST → Resend |

Do **not** confuse omv-ha postfix relay (human compose) with `@/lib/email`
(API transactional).
