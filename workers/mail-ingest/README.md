# Free inbound bridge: CF Email Routing → Worker `mail-ingest` → omv-ha dovecot

## Flow

```
Internet → Cloudflare MX (Email Routing)
  → Worker mail-ingest (email() handler)
  → POST https://webmail.cloudless.gr/ingest
  → PHP → dovecot-lda → Maildir
```

Outbound (clients / Roundcube) stays: postfix → Resend `:587` (Resend free tier).

`MAIL_INGEST_URL` uses the **webmail** hostname because the shared tunnel is
remotely managed and the usual API token cannot PUT new ingress hostnames.
`mail-ingest.cloudless.gr` DNS + nginx vhost exist for when Tunnel:Edit is available.

## Deploy Worker

```bash
cd workers/mail-ingest
# Use THIS directory's wrangler.jsonc (repo-root wrangler is a different Worker)
# Generate a long secret; put the SAME value on omv-ha (see install-mail-ingest.sh)
openssl rand -hex 32
npx wrangler secret put MAIL_INGEST_SECRET --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

Email Routing rule (API or Dashboard): `tbaltzakis@cloudless.gr` → Worker `mail-ingest`.

Keep `FALLBACK_FORWARD` (Gmail) until soak is done; then clear the var and redeploy.

## Install ingest on omv-ha

```bash
scp -r infrastructure/omv-ha/mail-ingest omv-ha-lan:/tmp/
ssh omv-ha-lan 'sudo MAIL_INGEST_SECRET=… bash /tmp/mail-ingest/install-mail-ingest.sh'
```

Adds nginx vhost + PHP endpoint + tunnel checklist for `mail-ingest.cloudless.gr`.

## Client (Tailscale)

See `docs/MAIL-SERVER-SETUP.md` after submission/IMAPS enablement.
