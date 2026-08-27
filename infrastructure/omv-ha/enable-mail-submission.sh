#!/usr/bin/env bash
# enable-mail-submission.sh — postfix submission :587 + IMAPS for Tailscale/LAN clients.
# Run on omv-ha as root. Does NOT expose classic SMTP :25 to the public internet
# (Starlink CGNAT); submission is auth-only on :587.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }

DOMAIN=cloudless.gr
CERT_DIR=/etc/ssl/cloudless-mail
# Tailscale CGNAT + LAN
MYNETWORKS='127.0.0.0/8 [::1]/128 100.64.0.0/10 192.168.1.0/24'

postconf -e \
  "inet_interfaces = all" \
  "mynetworks = ${MYNETWORKS}" \
  "smtpd_sasl_type = dovecot" \
  "smtpd_sasl_path = private/auth" \
  "smtpd_sasl_auth_enable = yes" \
  "smtpd_tls_security_level = may" \
  "smtp_tls_security_level = encrypt" \
  "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination" \
  "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"

if ! grep -qE '^submission[[:space:]]' /etc/postfix/master.cf; then
  cat >> /etc/postfix/master.cf <<'MASTER'

# cloudless.gr — authenticated submission for mail clients (Tailscale/LAN)
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
MASTER
fi

if [[ ! -f ${CERT_DIR}/mail.crt ]]; then
  install -d -m 755 "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "${CERT_DIR}/mail.key" -out "${CERT_DIR}/mail.crt" \
    -subj "/CN=mail.${DOMAIN}/O=cloudless.gr" \
    -addext "subjectAltName=DNS:mail.${DOMAIN},DNS:omv-ha,DNS:omv-ha.tail4ecae1.ts.net,IP:100.95.117.84,IP:192.168.1.130"
  chmod 640 "${CERT_DIR}/mail.key"
  chown root:dovecot "${CERT_DIR}/mail.key" 2>/dev/null || true
fi

# Dovecot 2.4 uses ssl_server_* names; fall back to legacy if needed after doveconf test.
cat > /etc/dovecot/conf.d/99-cloudless-ssl.conf <<SSL
ssl = required
ssl_server_cert_file = ${CERT_DIR}/mail.crt
ssl_server_key_file = ${CERT_DIR}/mail.key
SSL

if ! doveconf -n >/dev/null 2>&1; then
  cat > /etc/dovecot/conf.d/99-cloudless-ssl.conf <<SSL
ssl = required
ssl_cert = <${CERT_DIR}/mail.crt
ssl_key = <${CERT_DIR}/mail.key
SSL
fi

postconf -e \
  "smtpd_tls_cert_file = ${CERT_DIR}/mail.crt" \
  "smtpd_tls_key_file = ${CERT_DIR}/mail.key"

systemctl restart dovecot
systemctl restart postfix

if command -v ufw >/dev/null 2>&1; then
  ufw allow from 100.64.0.0/10 to any port 993 proto tcp comment 'IMAPS tailscale' || true
  ufw allow from 100.64.0.0/10 to any port 587 proto tcp comment 'SMTP submission tailscale' || true
  ufw allow from 192.168.1.0/24 to any port 993 proto tcp comment 'IMAPS lan' || true
  ufw allow from 192.168.1.0/24 to any port 587 proto tcp comment 'SMTP submission lan' || true
fi

echo "[mail-submission] enabled"
echo "  IMAPS:  omv-ha / 100.95.117.84 :993  (SSL/TLS, accept self-signed)"
echo "  SMTP:   omv-ha / 100.95.117.84 :587  (STARTTLS, auth required)"
echo "  User:   tbaltzakis@cloudless.gr"
echo "  Pass:   MAIL_TBALTZAKIS_PASSWORD (operator .env.local)"
ss -ltn | grep -E ':993|:587|:25' || true
