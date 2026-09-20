# Email infrastructure — cloudless.gr

Canonical map of mailbox, transactional, and marketing email. Verified
2026-08-14 against the repo. Self-hosted runbook details:
[`MAIL-SERVER-SETUP.md`](./MAIL-SERVER-SETUP.md).

## Three systems (do not conflate)

| System              | Purpose                           | Path                                          |
| ------------------- | --------------------------------- | --------------------------------------------- |
| Self-hosted mailbox | Human IMAP + Roundcube compose    | omv-ha dovecot + postfix → Resend `:587`      |
| App transactional   | API-driven mail from Next on Pi   | `@/lib/email` → CF Email REST → Resend        |
| EspoCRM             | Cases + CRM mail                  | omv-ha IMAPS `:993` fetch + postfix `:587`    |
| ActiveCampaign      | Marketing campaigns / automations | AC API; contact form `enrollLeadInAutomation` |

Slack (`slack-notify.ts`) is a parallel ops channel, not a mail transport.

## Self-hosted mail (omv-ha)

- Host: **omv-ha** (Pi 4, out of k3s). Starlink CGNAT — no public IP; port 25 blocked.
- Mailbox: `tbaltzakis@cloudless.gr` · Webmail: https://webmail.cloudless.gr
- Tunnel: `e977a490-58c5-4fdb-9155-86832e3e636a` → `192.168.1.130:80`
- **Inbound (LIVE 2026-08-26, per-recipient routing 2026-09-20):**
  Cloudflare Email Routing → Worker `mail-ingest`
  → `POST https://webmail.cloudless.gr/ingest` → dovecot-lda → Maildir.
  `X-Mail-To` recipient → matching mailbox when listed in
  `/etc/cloudless/mail-ingest-mailboxes` (`tbaltzakis@`, `polar@`,
  `espocrm@`); unknown recipients land in `tbaltzakis@cloudless.gr`.
  `FALLBACK_FORWARD` → Gmail only on ingest failure.
- **Access bypass (2026-09-20):** `webmail.cloudless.gr` sits behind Cloudflare
  Access; a path-scoped Access app `webmail.cloudless.gr/ingest` (bypass
  policy) lets the Worker POST through. `/ingest` still enforces its own
  `X-Mail-Ingest-Secret` check — Access bypass does not weaken it.
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

From address: `noreply@cloudless.gr`. Config keys `EMAIL_FROM`/`EMAIL_TO` are
canonical; `SES_FROM_EMAIL`/`SES_TO_EMAIL` remain as populated aliases for
existing D1 rows/readers.

API routes import **`@/lib/email`**, not `email-sender.ts` (Workers-only helper).

## EspoCRM mail (2026-09-20)

Inbound and outbound both run on the omv-ha stack — the old SES→Lambda case
bridge and `scripts/espocrm-smtp-bootstrap.sh` (AWS SSM) are retired.

- **Mailbox:** `espocrm@cloudless.gr` — dedicated dovecot account
  (`/var/mail/vhosts/cloudless.gr/espocrm`), password in
  `/etc/cloudless/espocrm-mailbox.pw` on omv-ha.
- **Inbound → Case:** Group Email Account in EspoCRM (`InboundEmail` entity)
  polls IMAPS `192.168.1.130:993` every 2 min via `CheckInboundEmails`;
  `createCase` auto-creates Cases from fetched mail.
- **Outbound:** same entity carries `smtp*` — postfix `192.168.1.130:587`
  STARTTLS + SASL LOGIN → dovecot local delivery / Resend relay.
- **TLS:** omv-ha's self-signed `mail.cloudless.gr` cert is trusted via
  `secret/omv-ha-mail-ca` mounted at `/etc/ssl/omv-ha/mail.crt` +
  `configmap/php-ini-omvha-mail` (`openssl.cafile`). Peer verification stays ON.
- **Scheduler:** `espocrm-daemon` sidecar (`php daemon.php` as www-data) in
  `infrastructure/espocrm/k8s/espocrm.yaml` — required, scheduled jobs
  (IMAP fetch, workflows) never run without it.
- **Passwords:** EspoCRM encrypts `password`/`smtpPassword` with its `crypt`
  service — always write via ORM + `crypt->encrypt()`, never plaintext/API.

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

## Verification (2026-09-20)

| Check                                           | Result                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| CF Email Routing → worker → `/ingest` → dovecot | HTTP 204, mail in per-recipient Maildir                    |
| `espocrm@cloudless.gr` routing                  | Delivered to `espocrm` Maildir (allowlist)                 |
| EspoCRM IMAP fetch `192.168.1.130:993`          | `connectedAt` set; 2 test mails → 2 auto Cases             |
| EspoCRM SMTP `192.168.1.130:587`                | `SENT ok`; postfix `sasl_username=espocrm@`, `status=sent` |
| TLS peer verification                           | `openssl.cafile` trust; verify ON                          |
| App transactional (Resend API)                  | Live send ok (`id` returned)                               |

Baseline (2026-08-14): `email.test.ts` 20/20, `admin-email-api` +
`client-report-email` + `auth-resend-verification-api` 26/26, D1
`email_suppression` present, `https://webmail.cloudless.gr/` reachable.

Do **not** confuse omv-ha postfix relay (human compose) with `@/lib/email`
(API transactional).
