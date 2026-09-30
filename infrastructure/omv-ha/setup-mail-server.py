#!/usr/bin/env python3
"""setup-mail-server.py — self-hosted mailbox + outbound relay on omv-ha.

Port of setup-mail-server.sh.

Architecture (see docs/MAIL-SERVER-SETUP.md): omv-ha is behind Starlink CGNAT
with port 25 blocked, so there is NO direct-send/receive mail. This script
builds the working design:
  - dovecot  : virtual Maildir mailbox + IMAP + LMTP (self-hosted inbox)
  - postfix  : relay-ONLY via smtp.resend.com:587 + local LMTP delivery
Inbound (Cloudflare Email Routing -> Worker -> dovecot) and Roundcube/TLS are
configured separately.

Secrets are read from the ENVIRONMENT — never hard-coded:
  RESEND_API_KEY            (required) — Resend send key; cloudless.gr must be
                                         a verified Resend domain
  MAIL_TBALTZAKIS_PASSWORD  (optional) — mailbox password; generated if unset

Usage:  sudo RESEND_API_KEY=re_… MAIL_TBALTZAKIS_PASSWORD=… python3 setup-mail-server.py
"""

import os
import secrets
import subprocess
import sys
from pathlib import Path

DOMAIN = "cloudless.gr"
USER_LOCAL = "tbaltzakis"
MAILBOX = f"{USER_LOCAL}@{DOMAIN}"
RELAY = "[smtp.resend.com]:587"


def log(msg: str) -> None:
    print(f"[mail-setup] {msg}")


def die(msg: str) -> None:
    print(f"[mail-setup] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def run(
    *args: str, check: bool = True, env: dict | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=check, env=env)


if os.geteuid() != 0:
    die("run as root (sudo)")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
if not RESEND_API_KEY:
    die("RESEND_API_KEY not set in the environment")
MAILPW = os.environ.get("MAIL_TBALTZAKIS_PASSWORD") or secrets.token_urlsafe(15)[:18].replace(
    "/", ""
)

log("Installing packages (postfix + lmdb + dovecot)…")
env = {**os.environ, "DEBIAN_FRONTEND": "noninteractive"}
subprocess.run(
    ["debconf-set-selections"],
    input=f"""\
postfix postfix/main_mailer_type string Internet Site
postfix postfix/mailname string {DOMAIN}
""",
    text=True,
    check=True,
)
run("apt-get", "update", "-qq", env=env)
run(
    "apt-get",
    "install",
    "-y",
    "-qq",
    "postfix",
    "postfix-pcre",
    "postfix-lmdb",
    "dovecot-core",
    "dovecot-imapd",
    "dovecot-lmtpd",
    "libsasl2-modules",
    "ca-certificates",
    env=env,
)

log("Creating vmail user + Maildir root…")
if run("getent", "group", "vmail", check=False).returncode != 0:
    run("groupadd", "-g", "5000", "vmail")
if run("getent", "passwd", "vmail", check=False).returncode != 0:
    run(
        "useradd",
        "-r",
        "-u",
        "5000",
        "-g",
        "vmail",
        "-d",
        "/var/mail/vhosts",
        "-s",
        "/usr/sbin/nologin",
        "vmail",
    )
Path(f"/var/mail/vhosts/{DOMAIN}").mkdir(parents=True, exist_ok=True)
run("chown", "-R", "vmail:vmail", "/var/mail/vhosts")

log(f"Writing dovecot mailbox ({MAILBOX})…")
r = run("doveadm", "pw", "-s", "SHA512-CRYPT", "-p", MAILPW)
HASH = r.stdout.strip()
users = Path("/etc/dovecot/users")
users.write_text(f"{MAILBOX}:{HASH}::::::\n")
users.chmod(0o640)
run("chown", "root:dovecot", str(users), check=False)

Path("/etc/dovecot/local.conf").write_text("""\
# Self-hosted mail — virtual mailbox (cloudless.gr).
protocols = imap lmtp

mail_driver = maildir
mail_path = /var/mail/vhosts/%{user | domain}/%{user | username}
# Without this, Debian Dovecot defaults INBOX to /var/mail/%u and Roundcube
# fails with "Failed to autocreate mailbox: Permission denied".
mail_inbox_path = /var/mail/vhosts/%{user | domain}/%{user | username}
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
""")
if run("doveconf", "-n", check=False).returncode != 0:
    die("dovecot config invalid")
run("systemctl", "enable", "--now", "dovecot", check=False)
run("systemctl", "restart", "dovecot")

log("Configuring postfix relay via Resend…")
sasl = Path("/etc/postfix/sasl_passwd")
sasl.write_text(f"{RELAY} resend:{RESEND_API_KEY}\n")
sasl.chmod(0o600)
run("postmap", "lmdb:/etc/postfix/sasl_passwd")
run(
    "postconf",
    "-e",
    f"myhostname = mail.{DOMAIN}",
    f"myorigin = {DOMAIN}",
    "mydestination = localhost",
    "mynetworks = 127.0.0.0/8 [::1]/128",
    "inet_interfaces = loopback-only",
    f"relayhost = {RELAY}",
    "smtp_sasl_auth_enable = yes",
    "smtp_sasl_password_maps = lmdb:/etc/postfix/sasl_passwd",
    "smtp_sasl_security_options = noanonymous",
    "smtp_sasl_mechanism_filter = plain, login",
    "smtp_tls_security_level = encrypt",
    f"virtual_mailbox_domains = {DOMAIN}",
    "virtual_transport = lmtp:unix:private/dovecot-lmtp",
)
run("systemctl", "enable", "--now", "postfix", check=False)
run("systemctl", "restart", "postfix")

log("Verifying mailbox auth…")
r = run("doveadm", "auth", "test", MAILBOX, MAILPW)
if "auth succeeded" in (r.stdout or ""):
    log("  mailbox auth OK")
else:
    die("mailbox auth FAILED")

log(f"Done. Mailbox: {MAILBOX}")
if "MAIL_TBALTZAKIS_PASSWORD" not in os.environ:
    log(f"  GENERATED PASSWORD (save it): {MAILPW}")
log(f"Next: Roundcube webmail + Cloudflare Tunnel (webmail.{DOMAIN}) + inbound Email Routing.")
log(
    f"Send test: printf 'Subject: t\\nFrom: {MAILBOX}\\nTo: you@x.com\\n\\nhi' | sendmail -f {MAILBOX} you@x.com"
)
