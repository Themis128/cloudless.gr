#!/usr/bin/env bash
# install-mail-ingest.sh — HTTPS ingest endpoint on omv-ha for CF Email Worker.
# Requires: nginx, php-fpm, dovecot (already on omv-ha for Roundcube).
#
#   sudo MAIL_INGEST_SECRET=$(openssl rand -hex 32) bash install-mail-ingest.sh
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
[[ -n "${MAIL_INGEST_SECRET:-}" ]] || { echo "MAIL_INGEST_SECRET required"; exit 1; }

DOMAIN_HOST="${MAIL_INGEST_HOST:-mail-ingest.cloudless.gr}"
MAILBOX="${MAIL_INGEST_DEFAULT_TO:-tbaltzakis@cloudless.gr}"
WEBROOT=/var/www/mail-ingest
SECRET_FILE=/etc/cloudless/mail-ingest.secret
PHP_SOCK=""

for cand in /run/php/php8.4-fpm.sock /run/php/php8.3-fpm.sock /run/php/php8.2-fpm.sock; do
  if [[ -S "$cand" ]]; then PHP_SOCK=$cand; break; fi
done
# Prefer TCP like Roundcube if unix sock missing
PHP_FASTCGI="${PHP_SOCK:+unix:${PHP_SOCK}}"
PHP_FASTCGI="${PHP_FASTCGI:-127.0.0.1:9000}"

install -d -m 755 /etc/cloudless
printf '%s\n' "$MAIL_INGEST_SECRET" > "$SECRET_FILE"
chmod 640 "$SECRET_FILE"
chown root:www-data "$SECRET_FILE" 2>/dev/null || chown root:nginx "$SECRET_FILE" 2>/dev/null || true

install -d -m 755 "$WEBROOT"
cat > "$WEBROOT/ingest.php" <<'PHP'
<?php
declare(strict_types=1);

$secretFile = '/etc/cloudless/mail-ingest.secret';
$defaultTo = 'tbaltzakis@cloudless.gr';
$lda = '/usr/lib/dovecot/dovecot-lda';
header('Content-Type: text/plain; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo "method not allowed\n";
    exit;
}
$expected = is_readable($secretFile) ? trim((string)file_get_contents($secretFile)) : '';
$got = $_SERVER['HTTP_X_MAIL_INGEST_SECRET'] ?? '';
if ($expected === '' || !hash_equals($expected, $got)) {
    http_response_code(401);
    echo "unauthorized\n";
    exit;
}
// Original envelope To (kept for logging); always deliver into the single client mailbox.
$originalTo = strtolower(trim($_SERVER['HTTP_X_MAIL_TO'] ?? $defaultTo));
if (!preg_match('/^[a-z0-9._%+\-]+@cloudless\.gr$/', $originalTo)) {
    $originalTo = $defaultTo;
}
$to = $defaultTo;
$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo "empty body\n";
    exit;
}
if (!is_executable($lda)) {
    http_response_code(500);
    echo "dovecot-lda missing\n";
    exit;
}
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];
# www-data delivers as vmail via sudoers.d/mail-ingest — all @cloudless.gr → $defaultTo
$cmd = ['sudo', '-n', '-u', 'vmail', $lda, '-d', $to];
$proc = proc_open($cmd, $descriptors, $pipes, null, null);
if (!is_resource($proc)) {
    http_response_code(500);
    echo "proc_open failed\n";
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
    echo "lda exit $code\n$stderr\n$stdout\n";
    exit;
}

http_response_code(204);
PHP

chown -R www-data:www-data "$WEBROOT" 2>/dev/null || chown -R nginx:nginx "$WEBROOT" 2>/dev/null || true

cat > /etc/nginx/sites-available/${DOMAIN_HOST} <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_HOST};

    # Cloudflare Tunnel terminates TLS; this vhost is HTTP on LAN.
    client_max_body_size 30m;

    location = /ingest {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME ${WEBROOT}/ingest.php;
        fastcgi_param REQUEST_METHOD \$request_method;
        fastcgi_pass ${PHP_FASTCGI};
        # Pass custom headers
        fastcgi_param HTTP_X_MAIL_INGEST_SECRET \$http_x_mail_ingest_secret;
        fastcgi_param HTTP_X_MAIL_TO \$http_x_mail_to;
        fastcgi_param HTTP_X_MAIL_FROM \$http_x_mail_from;
    }

    location / {
        return 404;
    }
}
NGINX

ln -sfn "/etc/nginx/sites-available/${DOMAIN_HOST}" "/etc/nginx/sites-enabled/${DOMAIN_HOST}"
nginx -t
systemctl reload nginx

# www-data must deliver as vmail
echo 'www-data ALL=(vmail) NOPASSWD: /usr/lib/dovecot/dovecot-lda' > /etc/sudoers.d/mail-ingest
chmod 440 /etc/sudoers.d/mail-ingest
visudo -cf /etc/sudoers.d/mail-ingest >/dev/null

echo "[mail-ingest] installed"
echo "  endpoint: http://127.0.0.1/ingest  (Host: ${DOMAIN_HOST})"
echo "  secret:   ${SECRET_FILE}"
echo "  default:  ${MAILBOX}"
echo
echo "Add tunnel ingress (remotely managed):"
echo "  hostname ${DOMAIN_HOST} → http://192.168.1.130:80"
echo "  DNS CNAME ${DOMAIN_HOST} → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com (proxied)"
echo "Put the SAME secret in Worker: wrangler secret put MAIL_INGEST_SECRET"
