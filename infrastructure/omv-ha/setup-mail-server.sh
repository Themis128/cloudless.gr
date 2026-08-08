#!/usr/bin/env bash
#
# setup-mail-server.sh — self-hosted mailbox + outbound relay on omv-ha.
#
# Architecture (see docs/MAIL-SERVER-SETUP.md): omv-ha is behind Starlink CGNAT
# with port 25 blocked, so there is NO direct-send/receive mail. This script
# builds the working design:
#   - dovecot  : virtual Maildir mailbox + IMAP + LMTP (self-hosted inbox)
#   - postfix  : relay-ONLY via smtp.resend.com:587 + local LMTP delivery
# Inbound (Cloudflare Email Routing -> Worker -> dovecot) and Roundcube/TLS are
# configured separately.
#
# Secrets are read from the ENVIRONMENT — never hard-coded:
#   RESEND_API_KEY            (required) — Resend send key; cloudless.gr must be
#                                          a verified Resend domain
#   MAIL_TBALTZAKIS_PASSWORD  (optional) — mailbox password; generated if unset
#
# Usage:  sudo RESEND_API_KEY=re_… MAIL_TBALTZAKIS_PASSWORD=… bash setup-mail-server.sh
#
set -euo pipefail

DOMAIN="cloudless.gr"
USER_LOCAL="tbaltzakis"
MAILBOX="${USER_LOCAL}@${DOMAIN}"
RELAY="[smtp.resend.com]:587"

log() { printf '[mail-setup] %s\n' "$*"; }
die() { printf '[mail-setup] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
[[ -n "${RESEND_API_KEY:-}" ]] || die "RESEND_API_KEY not set in the environment"
MAILPW="${MAIL_TBALTZAKIS_PASSWORD:-$(openssl rand -base64 15 | tr -d '/+=' | head -c 18)}"

log "Installing packages (postfix + lmdb + dovecot)…"
export DEBIAN_FRONTEND=noninteractive
echo "postfix postfix/main_mailer_type string Internet Site" | debconf-set-selections
echo "postfix postfix/mailname string ${DOMAIN}" | debconf-set-selections
apt-get update -qq
apt-get install -y -qq \
  postfix postfix-pcre postfix-lmdb \
  dovecot-core dovecot-imapd dovecot-lmtpd \
  libsasl2-modules ca-certificates

log "Creating vmail user + Maildir root…"
getent group vmail >/dev/null || groupadd -g 5000 vmail
getent passwd vmail >/dev/null || useradd -r -u 5000 -g vmail -d /var/mail/vhosts -s /usr/sbin/nologin vmail
mkdir -p "/var/mail/vhosts/${DOMAIN}"
chown -R vmail:vmail /var/mail/vhosts

log "Writing dovecot mailbox (${MAILBOX})…"
HASH=$(doveadm pw -s SHA512-CRYPT -p "$MAILPW")
printf '%s:%s::::::\n' "$MAILBOX" "$HASH" > /etc/dovecot/users
chmod 640 /etc/dovecot/users
chown root:dovecot /etc/dovecot/users 2>/dev/null || true

cat > /etc/dovecot/local.conf <<'DOVECOT'
# Self-hosted mail — virtual mailbox (cloudless.gr).
protocols = imap lmtp

mail_driver = maildir
mail_path = /var/mail/vhosts/%{user | domain}/%{user | username}
mail_uid = vmail
mail_gid = vmail
first_valid_uid = 5000
last_valid_uid = 5000
first_valid_gid = 5000

auth_mechanisms = plain login

passdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}
userdb passwd-file {
  passwd_file_path = /etc/dovecot/users
  fields {
    uid = 5000
    gid = 5000
    home = /var/mail/vhosts/%{user | domain}/%{user | username}
  }
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
DOVECOT
doveconf -n >/dev/null || die "dovecot config invalid"
systemctl enable --now dovecot >/dev/null 2>&1 || true
systemctl restart dovecot

log "Configuring postfix relay via Resend…"
printf '%s resend:%s\n' "$RELAY" "$RESEND_API_KEY" > /etc/postfix/sasl_passwd
chmod 600 /etc/postfix/sasl_passwd
postmap lmdb:/etc/postfix/sasl_passwd
postconf -e \
  "myhostname = mail.${DOMAIN}" \
  "myorigin = ${DOMAIN}" \
  "mydestination = localhost" \
  "mynetworks = 127.0.0.0/8 [::1]/128" \
  "inet_interfaces = loopback-only" \
  "relayhost = ${RELAY}" \
  "smtp_sasl_auth_enable = yes" \
  "smtp_sasl_password_maps = lmdb:/etc/postfix/sasl_passwd" \
  "smtp_sasl_security_options = noanonymous" \
  "smtp_sasl_mechanism_filter = plain, login" \
  "smtp_tls_security_level = encrypt" \
  "virtual_mailbox_domains = ${DOMAIN}" \
  "virtual_transport = lmtp:unix:private/dovecot-lmtp"
systemctl enable --now postfix >/dev/null 2>&1 || true
systemctl restart postfix

log "Verifying mailbox auth…"
doveadm auth test "$MAILBOX" "$MAILPW" | grep -q "auth succeeded" \
  && log "  mailbox auth OK" || die "mailbox auth FAILED"

log "Done. Mailbox: ${MAILBOX}"
[[ -n "${MAIL_TBALTZAKIS_PASSWORD:-}" ]] || log "  GENERATED PASSWORD (save it): ${MAILPW}"
log "Next: Roundcube webmail + Cloudflare Tunnel (webmail.${DOMAIN}) + inbound Email Routing."
log "Send test: printf 'Subject: t\\nFrom: ${MAILBOX}\\nTo: you@x.com\\n\\nhi' | sendmail -f ${MAILBOX} you@x.com"
