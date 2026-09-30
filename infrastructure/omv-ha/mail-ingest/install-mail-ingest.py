#!/usr/bin/env python3
"""install-mail-ingest.py — HTTPS ingest endpoint on omv-ha for CF Email Worker.

Port of install-mail-ingest.sh.
Requires: nginx, php-fpm, dovecot (already on omv-ha for Roundcube).

  sudo MAIL_INGEST_SECRET=$(openssl rand -hex 32) python3 install-mail-ingest.py
"""

import os
import subprocess
import sys
from pathlib import Path

if os.geteuid() != 0:
    print("run as root", file=sys.stderr)
    sys.exit(1)
MAIL_INGEST_SECRET = os.environ.get("MAIL_INGEST_SECRET", "")
if not MAIL_INGEST_SECRET:
    print("MAIL_INGEST_SECRET required", file=sys.stderr)
    sys.exit(1)

DOMAIN_HOST = os.environ.get("MAIL_INGEST_HOST", "mail-ingest.cloudless.gr")
MAILBOX = os.environ.get("MAIL_INGEST_DEFAULT_TO", "tbaltzakis@cloudless.gr")
WEBROOT = Path("/var/www/mail-ingest")
SECRET_FILE = Path("/etc/cloudless/mail-ingest.secret")

PHP_SOCK = ""
for cand in ("/run/php/php8.4-fpm.sock", "/run/php/php8.3-fpm.sock", "/run/php/php8.2-fpm.sock"):
    if Path(cand).is_socket():
        PHP_SOCK = cand
        break
# Prefer TCP like Roundcube if unix sock missing
PHP_FASTCGI = f"unix:{PHP_SOCK}" if PHP_SOCK else "127.0.0.1:9000"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=check)


subprocess.run(["install", "-d", "-m", "755", "/etc/cloudless"], check=True)
SECRET_FILE.write_text(MAIL_INGEST_SECRET + "\n")
SECRET_FILE.chmod(0o640)
for grp in ("www-data", "nginx"):
    if run("chown", f"root:{grp}", str(SECRET_FILE), check=False).returncode == 0:
        break

# Per-address mailbox allowlist: one local part per line. www-data cannot
# traverse /var/mail/vhosts (vmail:vmail 2770), so mailbox existence is
# declared here instead of probed on the filesystem.
MAILBOX_LIST = Path("/etc/cloudless/mail-ingest-mailboxes")
if not MAILBOX_LIST.is_file():
    MAILBOX_LIST.write_text("tbaltzakis\npolar\nespocrm\n")
MAILBOX_LIST.chmod(0o644)

WEBROOT.mkdir(parents=True, exist_ok=True)
# PHP payload — runs under php-fpm, not Python.
(WEBROOT / "ingest.php").write_text('''<?php
declare(strict_types=1);
/**
 * Deliver @cloudless.gr inbound messages. Per-address mailbox when the
 * local part is listed in /etc/cloudless/mail-ingest-mailboxes (one local
 * part per line, e.g. espocrm for CRM cases); otherwise the default mailbox.
 */
$secretFile = '/etc/cloudless/mail-ingest.secret';
$mailbox = 'tbaltzakis@cloudless.gr';
$mailboxList = '/etc/cloudless/mail-ingest-mailboxes';
$lda = '/usr/lib/dovecot/dovecot-lda';
header('Content-Type: text/plain; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo "method not allowed\\n";
    exit;
}
$expected = is_readable($secretFile) ? trim((string)file_get_contents($secretFile)) : '';
$got = $_SERVER['HTTP_X_MAIL_INGEST_SECRET'] ?? '';
if ($expected === '' || !hash_equals($expected, $got)) {
    http_response_code(401);
    echo "unauthorized\\n";
    exit;
}
$originalTo = strtolower(trim($_SERVER['HTTP_X_MAIL_TO'] ?? $mailbox));
if (!preg_match('/^[a-z0-9._%+\\-]+@cloudless\\.gr$/', $originalTo)) {
    $originalTo = $mailbox;
}
$localPart = substr($originalTo, 0, (int)strpos($originalTo, '@'));
$allowed = is_readable($mailboxList)
    ? array_filter(array_map('trim', explode("\\n", (string)file_get_contents($mailboxList))))
    : [];
$deliverTo = in_array($localPart, $allowed, true) ? $originalTo : $mailbox;
$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo "empty body\\n";
    exit;
}
if (!is_executable($lda)) {
    http_response_code(500);
    echo "dovecot-lda missing\\n";
    exit;
}
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$cmd = ['sudo', '-n', '-u', 'vmail', $lda, '-d', $deliverTo];
$proc = proc_open($cmd, $descriptors, $pipes, null, null);
if (!is_resource($proc)) {
    http_response_code(500);
    echo "proc_open failed\\n";
    exit;
}
fwrite($pipes[0], $raw);
fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$code = proc_close($proc);
if ($code !== 0) {
    http_response_code(502);
    echo "lda exit $code (orig=$originalTo)\\n$stderr\\n$stdout\\n";
    exit;
}
http_response_code(204);
''')

for grp in ("www-data", "nginx"):
    if run("chown", "-R", f"{grp}:{grp}", str(WEBROOT), check=False).returncode == 0:
        break

nginx_conf = Path(f"/etc/nginx/sites-available/{DOMAIN_HOST}")
nginx_conf.write_text(f"""\
server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN_HOST};

    # Cloudflare Tunnel terminates TLS; this vhost is HTTP on LAN.
    client_max_body_size 30m;

    location = /ingest {{
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME {WEBROOT}/ingest.php;
        fastcgi_param REQUEST_METHOD $request_method;
        fastcgi_pass {PHP_FASTCGI};
        # Pass custom headers
        fastcgi_param HTTP_X_MAIL_INGEST_SECRET $http_x_mail_ingest_secret;
        fastcgi_param HTTP_X_MAIL_TO $http_x_mail_to;
        fastcgi_param HTTP_X_MAIL_FROM $http_x_mail_from;
    }}

    location / {{
        return 404;
    }}
}}
""")

enabled = Path(f"/etc/nginx/sites-enabled/{DOMAIN_HOST}")
if enabled.exists() or enabled.is_symlink():
    enabled.unlink()
enabled.symlink_to(nginx_conf)
run("nginx", "-t")
run("systemctl", "reload", "nginx")

# www-data must deliver as vmail
sudoers = Path("/etc/sudoers.d/mail-ingest")
sudoers.write_text("www-data ALL=(vmail) NOPASSWD: /usr/lib/dovecot/dovecot-lda\n")
sudoers.chmod(0o440)
run("visudo", "-cf", str(sudoers))

print("[mail-ingest] installed")
print(f"  endpoint: http://127.0.0.1/ingest  (Host: {DOMAIN_HOST})")
print(f"  secret:   {SECRET_FILE}")
print(f"  default:  {MAILBOX}")
print()
print("Add tunnel ingress (remotely managed):")
print(f"  hostname {DOMAIN_HOST} → http://192.168.1.130:80")
print(f"  DNS CNAME {DOMAIN_HOST} → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com (proxied)")
print("Put the SAME secret in Worker: wrangler secret put MAIL_INGEST_SECRET")
