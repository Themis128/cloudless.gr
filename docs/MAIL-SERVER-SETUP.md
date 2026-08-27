# Self-Hosted Mail Server — cloudless.gr (on omv-ha)

**Status (2026-08-26):** ✅ **fully live** — outbound (postfix → Resend), mailbox
(dovecot IMAP/IMAPS + submission :587), webmail (Roundcube at
`https://webmail.cloudless.gr`), and **inbound** via Cloudflare Email Routing →
Worker `mail-ingest` → HTTPS ingest → dovecot Maildir. Catch-all / Worker
fallback still mirrors to Gmail. An admin **Webmail** tab under Infrastructure
opens Roundcube. Host: **omv-ha** (dedicated mail host; out of k3s — see
topology note in `CLAUDE.md`).

## ⚠️ Why this is NOT a "direct" mail server (read first)

The network is **Starlink**, which means:

- **CGNAT** — no public inbound IP. You cannot receive a connection on any port
  from the internet (no port-forwarding possible). This is why the whole cluster
  is exposed via **Cloudflare Tunnel** (outbound-only), not port-forwarding.
- **Port 25 is blocked** (outbound to `*:25` times out; `:587` is open).

So a classic `postfix → direct MX` server **cannot send or receive a single
message here**. Any doc that says "install postfix as Internet Site, add an MX to
your public IP, proxy mail through Cloudflare's orange cloud" is **wrong for this
environment** — Cloudflare's proxy only carries HTTP, and there is no reachable
public IP anyway.

The working design routes _around_ both constraints:

| Piece           | How                                                                 | Self-hosted? |
| --------------- | ------------------------------------------------------------------- | ------------ |
| Mailbox + IMAP  | **dovecot** on omv-ha (Maildir; IMAPS 993 + submission 587)         | ✅           |
| Webmail UI      | **Roundcube** on omv-ha, HTTPS via **Cloudflare Tunnel**            | ✅           |
| Outbound send   | **postfix** relays via `smtp.resend.com:587` (Resend)               | relay        |
| Inbound receive | **CF Email Routing** → Worker `mail-ingest` → ingest → dovecot      | ✅ (free CF) |

No port 25, no inbound reachability required — outbound uses :587 (Resend);
inbound uses Cloudflare MX + Email Worker. Roundcube compose still goes through
local postfix → Resend. Clients on Tailscale use IMAPS/SMTP on omv-ha.

## Components & credentials

- Mailbox: `tbaltzakis@cloudless.gr`. Password in the operator's `.env.local`
  as `MAIL_TBALTZAKIS_PASSWORD` (dovecot passwd-file `/etc/dovecot/users`,
  SHA512-CRYPT).
- Outbound relay: Resend. API key in `.env.local` as `RESEND_API_KEY` (send-only
  is fine). `cloudless.gr` is a **verified Resend domain**.
- DNS token: `.env.local` `CLOUDFLARE_API_TOKEN` (zone `cloudless.gr` =
  `7025298073d6a5c645a6ad9add0cbf0e`).

## DNS records (in Cloudflare, added via API)

Resend sender verification (added 2026-08-08):

| Type | Name                | Value                                             |
| ---- | ------------------- | ------------------------------------------------- |
| TXT  | `resend._domainkey` | `p=…` (Resend DKIM public key)                    |
| MX   | `send`              | `feedback-smtp.eu-west-1.amazonses.com` (prio 10) |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`               |

Inbound (Cloudflare Email Routing — **live**): root `MX` → Cloudflare;
`tbaltzakis@` → Worker `mail-ingest` → dovecot; catch-all → Gmail. SPF is a
single TXT including Cloudflare + Resend. DMARC live (`p=none`).

## omv-ha config (what's on the box)

- **dovecot 2.4.1** — `/etc/dovecot/local.conf`: virtual mailbox
  (`mail_driver=maildir`, `mail_path=/var/mail/vhosts/%{user|domain}/%{user|username}`,
  uid/gid `vmail`=5000), `passdb`/`userdb` = `passwd-file` (`/etc/dovecot/users`),
  `service lmtp` + `service auth` unix listeners under
  `/var/spool/postfix/private/` for postfix. Listens IMAP 143 / IMAPS 993.
- **postfix 3.10** — relay-only + local virtual delivery. Key `main.cf`:
  - `inet_interfaces = loopback-only` (CGNAT host — no external SMTP exposure)
  - `myhostname = mail.cloudless.gr`, `myorigin = cloudless.gr`,
    `mydestination = localhost`, `mynetworks = 127.0.0.0/8 [::1]/128`
  - `relayhost = [smtp.resend.com]:587`, `smtp_sasl_auth_enable = yes`,
    `smtp_sasl_password_maps = lmdb:/etc/postfix/sasl_passwd`,
    `smtp_sasl_security_options = noanonymous`, `smtp_tls_security_level = encrypt`
  - `virtual_mailbox_domains = cloudless.gr`,
    `virtual_transport = lmtp:unix:private/dovecot-lmtp`
  - `/etc/postfix/sasl_passwd`: `[smtp.resend.com]:587 resend:<RESEND_API_KEY>`
    (then `postmap lmdb:/etc/postfix/sasl_passwd`). **Requires the
    `postfix-lmdb` package** — without it you get
    `unsupported dictionary type: lmdb` → `local data error talking to
smtp.resend.com`.

## Verify

```bash
# mailbox auth
sudo doveadm auth test tbaltzakis@cloudless.gr '<password>'
# outbound relay (should log status=sent (250 …))
printf 'Subject: relay test\nFrom: tbaltzakis@cloudless.gr\nTo: you@example.com\n\nhi' \
  | sudo sendmail -f tbaltzakis@cloudless.gr you@example.com
sudo journalctl -t postfix/smtp -n 5 | grep status=
```

## Roundcube webmail (LIVE)

Installed on omv-ha alongside postfix/dovecot: **nginx + php-fpm 8.4 +
Roundcube** (sqlite backend) at `https://webmail.cloudless.gr`. The nginx
vhost proxies to php-fpm over `127.0.0.1:9000` (TCP, not the unix socket —
see gotcha below); Roundcube points at IMAP `localhost:143` and submit
`localhost:25` (postfix handles the relay to Resend for actual delivery).

**Gotcha — stale k3s nftables:** after uninstalling the k3s agent from
omv-ha the leftover `KUBE-FIREWALL`/`KUBE-ROUTER-INPUT`/`KUBE-NODEPORTS`
nftables chains were still loaded and silently DROPPED loopback TCP —
`cgi-fcgi` over the unix socket worked, but nginx→php-fpm and `curl :80`
hung with no error logged. Fix: **reboot omv-ha once** (k3s is uninstalled,
so those chains don't come back). Do not try to hand-edit nft rules;
a reboot leaves a clean ruleset (tailscale + system only).

## Cloudflare Tunnel ingress (LIVE)

`webmail.cloudless.gr` → `192.168.1.130:80` in the shared tunnel
(`e977a490-58c5-4fdb-9155-86832e3e636a`). **Important**: the tunnel is
**remotely-managed** — cloudflared on the host ignores its local `config.yml`
for ingress. Add/edit hostnames via the API (`.../cfd_tunnel/<uuid>/configurations`
PUT) or Cloudflare Zero Trust dashboard, not by editing files on-box.

DNS: `webmail.cloudless.gr` CNAME → `<tunnel-uuid>.cfargotunnel.com`
(proxied). Added via API on 2026-08-08.

## Inbound (Cloudflare Email Routing → Worker → dovecot) — LIVE

Free Cloudflare path (no CF Email Sending product required):

```
Internet → CF MX (Email Routing)
  → Worker mail-ingest (workers/mail-ingest)
  → POST https://webmail.cloudless.gr/ingest  (+ X-Mail-Ingest-Secret)
  → PHP → dovecot-lda (as vmail) → Maildir
```

- Rule `tbaltzakis@cloudless.gr` → **Send to Worker** `mail-ingest`
- Catch-all → **Send to Worker** `mail-ingest` (every `@cloudless.gr` address)
- Ingest always delivers into mailbox `tbaltzakis@cloudless.gr` (single client inbox)
- Worker var `FALLBACK_FORWARD` = Gmail **only if ingest fails**
- Ingest also exists as nginx `server_name mail-ingest.cloudless.gr`; DNS CNAME
  is present, but the tunnel is **remotely managed** and the cluster
  `CLOUDFLARE_API_TOKEN` lacks **Tunnel:Edit**, so public traffic uses the
  webmail hostname path until that permission is added and the remote ingress
  gains `mail-ingest.cloudless.gr` → `http://192.168.1.130:80`.

Deploy notes: `workers/mail-ingest/README.md`.
Host install: `infrastructure/omv-ha/mail-ingest/install-mail-ingest.sh`.
Submission/IMAPS: `infrastructure/omv-ha/enable-mail-submission.sh`.

### Mail client (Tailscale)

| | |
| --- | --- |
| IMAP | `omv-ha` / `100.95.117.84`, port **993**, SSL (accept self-signed) |
| SMTP | same host, port **587**, STARTTLS + auth |
| User | `tbaltzakis@cloudless.gr` |
| Password | mailbox password (`MAIL_TBALTZAKIS_PASSWORD`) |
| Webmail | https://webmail.cloudless.gr |

## DMARC status

`_dmarc.cloudless.gr` = `v=DMARC1; p=none; rua=mailto:dmarc@cloudless.gr;
pct=100; adkim=s; aspf=s`. `p=none` is the correct starting policy for a
fresh sender. RUA aggregate reports flow to `dmarc@cloudless.gr` → via the
catch-all → Gmail. **Escalation path:** after ~2 weeks of clean RUA reports
(no legitimate mail failing DKIM/SPF), move to `p=quarantine`; after another
2 weeks clean, `p=reject`.

## Admin dashboard integration

A **Webmail** link is added to the admin dashboard's Infrastructure group
(`src/app/[locale]/admin/AdminLayoutClient.tsx`, PR #1538). External link,
opens Roundcube in a new tab. Access is gated only by Roundcube's own login
(not Cloudflare Access) since it's the entry point to the mailbox.

## App sync

Transactional mail from the Next app uses `src/lib/email.ts`: Cloudflare Email
Sending REST when `CLOUDFLARE_ACCOUNT_ID` + email API token are set, otherwise
Resend (`RESEND_API_KEY` in the k8s Secret `cloudless-secrets`). Both send as
`noreply@cloudless.gr`. The omv-ha postfix relay is only for Roundcube human
compose — not the app API path. See `docs/EMAIL-INFRASTRUCTURE.md`.

## Reproduce / recover

`infrastructure/omv-ha/setup-mail-server.sh` installs and configures the
dovecot + postfix relay stack idempotently (reads `RESEND_API_KEY` and the
mailbox password from the environment; never hard-codes secrets). Roundcube

- nginx + php-fpm are apt packages and can be reinstalled by running the
  script's package list and re-applying the vhost / `config.inc.php` snippets
  above.
