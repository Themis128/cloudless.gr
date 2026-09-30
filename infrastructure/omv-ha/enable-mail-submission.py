#!/usr/bin/env python3
"""enable-mail-submission.py — postfix submission :587 + IMAPS for Tailscale/LAN clients.

Port of enable-mail-submission.sh.
Run on omv-ha as root. Does NOT expose classic SMTP :25 to the public internet
(Starlink CGNAT); submission is auth-only on :587.

Usage: sudo python3 enable-mail-submission.py
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

if os.geteuid() != 0:
    print("run as root", file=sys.stderr)
    sys.exit(1)

DOMAIN = "cloudless.gr"
CERT_DIR = Path("/etc/ssl/cloudless-mail")
# Tailscale CGNAT + LAN
MYNETWORKS = "127.0.0.0/8 [::1]/128 100.64.0.0/10 192.168.1.0/24"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=check)


run(
    "postconf",
    "-e",
    "inet_interfaces = all",
    f"mynetworks = {MYNETWORKS}",
    "smtpd_sasl_type = dovecot",
    "smtpd_sasl_path = private/auth",
    "smtpd_sasl_auth_enable = yes",
    "smtpd_tls_security_level = may",
    "smtp_tls_security_level = encrypt",
    "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination",
    "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination",
)

master_cf = Path("/etc/postfix/master.cf")
if master_cf.is_file() and not re.search(r"^submission\s", master_cf.read_text(), re.MULTILINE):
    with master_cf.open("a") as fh:
        fh.write("""\

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
""")

if not (CERT_DIR / "mail.crt").is_file():
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    CERT_DIR.chmod(0o755)
    run(
        "openssl",
        "req",
        "-x509",
        "-nodes",
        "-newkey",
        "rsa:2048",
        "-days",
        "825",
        "-keyout",
        str(CERT_DIR / "mail.key"),
        "-out",
        str(CERT_DIR / "mail.crt"),
        "-subj",
        f"/CN=mail.{DOMAIN}/O=cloudless.gr",
        "-addext",
        f"subjectAltName=DNS:mail.{DOMAIN},DNS:omv-ha,"
        f"DNS:omv-ha.tail4ecae1.ts.net,IP:100.95.117.84,IP:192.168.1.130",
    )
    (CERT_DIR / "mail.key").chmod(0o640)
    run("chown", "root:dovecot", str(CERT_DIR / "mail.key"), check=False)

# Dovecot 2.4 uses ssl_server_* names; fall back to legacy if needed after doveconf test.
ssl_conf = Path("/etc/dovecot/conf.d/99-cloudless-ssl.conf")
ssl_conf.write_text(f"""\
ssl = required
ssl_server_cert_file = {CERT_DIR}/mail.crt
ssl_server_key_file = {CERT_DIR}/mail.key
""")

if run("doveconf", "-n", check=False).returncode != 0:
    ssl_conf.write_text(f"""\
ssl = required
ssl_cert = <{CERT_DIR}/mail.crt
ssl_key = <{CERT_DIR}/mail.key
""")

run(
    "postconf",
    "-e",
    f"smtpd_tls_cert_file = {CERT_DIR}/mail.crt",
    f"smtpd_tls_key_file = {CERT_DIR}/mail.key",
)

run("systemctl", "restart", "dovecot")
run("systemctl", "restart", "postfix")

if shutil.which("ufw"):
    for rule in (
        ("100.64.0.0/10", "993", "IMAPS tailscale"),
        ("100.64.0.0/10", "587", "SMTP submission tailscale"),
        ("192.168.1.0/24", "993", "IMAPS lan"),
        ("192.168.1.0/24", "587", "SMTP submission lan"),
    ):
        run(
            "ufw",
            "allow",
            "from",
            rule[0],
            "to",
            "any",
            "port",
            rule[1],
            "proto",
            "tcp",
            "comment",
            rule[2],
            check=False,
        )

print("[mail-submission] enabled")
print("  IMAPS:  omv-ha / 100.95.117.84 :993  (SSL/TLS, accept self-signed)")
print("  SMTP:   omv-ha / 100.95.117.84 :587  (STARTTLS, auth required)")
print("  User:   tbaltzakis@cloudless.gr")
print("  Pass:   MAIL_TBALTZAKIS_PASSWORD (operator .env.local)")
r = run("ss", "-ltn", check=False)
for line in (r.stdout or "").splitlines():
    if re.search(r":993|:587|:25", line):
        print(line)
