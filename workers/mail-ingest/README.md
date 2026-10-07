# Free inbound bridge: CF Email Routing → Worker `mail-ingest` → omv-ha dovecot

## Flow

```
Internet → Cloudflare MX (Email Routing)
  → Worker mail-ingest (email() handler)
  → POST https://webmail.cloudless.gr/ingest
  → PHP → dovecot-lda → Maildir
```

Outbound (clients / Roundcube) stays: postfix → Resend `:587` (Resend free tier).

## Spam layer (replaces rspamd — too heavy for the 1 GB Pi)

The Worker scores every inbound message before ingest:

| Signal | Score |
|---|---|
| `Received-SPF: fail` | +5 |
| `Received-SPF: softfail` | +3, `neutral`/`none` +1 |
| `Authentication-Results` `dkim=fail` | +2, `dmarc=fail` +3 |
| Missing/malformed `From` | +2 |
| `Reply-To` domain ≠ `From` domain | +1 |
| Missing `Message-ID` | +1 |
| Sending IP on DNSBL (SpamCop, DroneBL via DoH) | +4 |
| `From` domain has no MX/A record | +2 |
| Subject spam terms (crypto/lottery/urgent-verify) | +2 |
| `SPAM_BLOCK_SENDERS` match | +10 |

- `score >= SPAM_REJECT_AT` (default 9) → SMTP-time `setReject`, never ingested.
- `score >= SPAM_TAG_AT` (default 4) → `X-Spam-Flag: YES` is prepended to the
  raw message; the default Sieve (`infrastructure/omv-ha/mail-ingest/default.sieve`)
  files it into `Junk`.
- All DNS lookups go through `cloudflare-dns.com` DNS-over-HTTPS with a 2.5s
  timeout — every failure path contributes 0 (fail-open, never blocks mail).

`MAIL_INGEST_URL` uses the **webmail** hostname because the shared tunnel is
remotely managed and the usual API token cannot PUT new ingress hostnames.
`mail-ingest.cloudless.gr` DNS + nginx vhost exist for when Tunnel:Edit is available.

## Deploy Worker

```bash
cd workers/mail-ingest
# Use THIS directory's wrangler.jsonc (repo-root wrangler is a different Worker)
# Generate a long secret; put the SAME value on omv-ha (see install-mail-ingest.py)
openssl rand -hex 32
npx wrangler secret put MAIL_INGEST_SECRET --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

Email Routing rule (API or Dashboard): `tbaltzakis@cloudless.gr` → Worker `mail-ingest`.

Keep `FALLBACK_FORWARD` (Gmail) until soak is done; then clear the var and redeploy.

## Install ingest on omv-ha

```bash
scp -r infrastructure/omv-ha/mail-ingest omv-ha-lan:/tmp/
ssh omv-ha-lan 'sudo MAIL_INGEST_SECRET=… python3 /tmp/mail-ingest/install-mail-ingest.py'
```

Adds nginx vhost + PHP endpoint + tunnel checklist for `mail-ingest.cloudless.gr`.

## Client (Tailscale)

See `docs/MAIL-SERVER-SETUP.md` after submission/IMAPS enablement.
