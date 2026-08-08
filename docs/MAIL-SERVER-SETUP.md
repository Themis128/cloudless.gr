# Self-Hosted Mail Server — cloudless.gr (on omv-ha)

**Status (2026-08-08):** ✅ **fully live** — outbound (postfix → Resend), mailbox
(dovecot IMAP), and webmail (Roundcube at `https://webmail.cloudless.gr` via
the Cloudflare tunnel) all working. Inbound is via Cloudflare Email Routing →
forward to `themis.baltzakis@gmail.com` (Gmail as the reader). An admin
dashboard **Webmail** tab under Infrastructure opens the Roundcube UI.
Host: **omv-ha** (Pi 4, dedicated mail host after it was removed from k3s —
see the topology note in `CLAUDE.md`).

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

The working design routes *around* both constraints:

| Piece            | How                                                                 | Self-hosted? |
| ---------------- | ------------------------------------------------------------------- | ------------ |
| Mailbox + IMAP   | **dovecot** on omv-ha (Maildir virtual user)                        | ✅           |
| Webmail UI       | **Roundcube** on omv-ha, HTTPS via **Cloudflare Tunnel**            | ✅           |
| Outbound send    | **postfix** relays via `smtp.resend.com:587` (Resend)               | relay        |
| Inbound receive  | **Cloudflare Email Routing** (CF runs the MX) → Email **Worker** → tunnel → dovecot LMTP | ✅ |

No port 25, no inbound reachability required — mail flows over :587 (out) and
Cloudflare (in).

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

| Type | Name                        | Value                                            |
| ---- | --------------------------- | ------------------------------------------------ |
| TXT  | `resend._domainkey`         | `p=…` (Resend DKIM public key)                   |
| MX   | `send`                      | `feedback-smtp.eu-west-1.amazonses.com` (prio 10)|
| TXT  | `send`                      | `v=spf1 include:amazonses.com ~all`              |

Inbound (Cloudflare Email Routing — pending): enabling Email Routing sets the
root `MX` to Cloudflare's mail servers automatically. A `DMARC` TXT
(`_dmarc` → `v=DMARC1; p=none; rua=mailto:…`) should be added once both
directions are live.

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

## Inbound (Cloudflare Email Routing)

Cloudflare Email Routing is **enabled** on `cloudless.gr` with:
- `tbaltzakis@cloudless.gr` → forward to `themis.baltzakis@gmail.com`
- catch-all → forward to `themis.baltzakis@gmail.com`

So all mail *to* `@cloudless.gr` reaches Gmail. This deliberately does NOT
land in the dovecot mailbox — building a CF Email Worker → tunnel → LMTP
bridge would just duplicate mail into Roundcube for zero benefit (you'd
read the same message twice). If you want inbound in Roundcube specifically,
change/add a rule to run a Worker that POSTs to a small receiver on omv-ha.

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

`RESEND_API_KEY` is set in the k8s Secret `cloudless-secrets` (namespace
`cloudless`), so the cloudless.gr app sends transactional email via Resend
using the same relay. See `src/lib/email-resend.ts`.

## Reproduce / recover

`infrastructure/omv-ha/setup-mail-server.sh` installs and configures the
dovecot + postfix relay stack idempotently (reads `RESEND_API_KEY` and the
mailbox password from the environment; never hard-codes secrets). Roundcube
+ nginx + php-fpm are apt packages and can be reinstalled by running the
script's package list and re-applying the vhost / `config.inc.php` snippets
above.
