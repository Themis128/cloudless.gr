# mail-outbound

Transactional funnel email via Cloudflare's `send_email` binding
(paid plan feature). Primary transport for the audit/nurture/LOA
funnel; SocialAuto's omv-ha/Resend SMTP path stays as fallback.

## Endpoints

| Method | Path      | Auth   | Body                                              |
|--------|-----------|--------|---------------------------------------------------|
| GET    | `/health` | —      | liveness                                          |
| POST   | `/send`   | Bearer | `{to, subject, text or html, from?, replyTo?, category}` |
| POST   | `/verify` | Bearer | — (sends self-test to `VERIFY_TO`)                |

`category` is allowlisted: `audit-confirm`, `nurture`, `quiet-lead`,
`loa-delivery`, `playbook`, `ops-alert`. Bulk marketing is out of
scope by design.

## Setup

```bash
cd workers/mail-outbound
wrangler secret put MAIL_OUTBOUND_TOKEN   # shared secret for callers
wrangler secret put DEFAULT_FROM          # optional, e.g. "Cloudless <no-reply@cloudless.gr>"
wrangler secret put VERIFY_TO             # optional verification inbox
pnpm deploy                               # or the repo's workers deploy workflow
```

Callers set `MAIL_OUTBOUND_URL` + `MAIL_OUTBOUND_TOKEN` and POST `/send`.
SocialAuto gates the CF transport behind `CF_EMAIL_ENABLED` with SMTP
fallback — see pipeline-assets-ops skill.
