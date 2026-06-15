#!/usr/bin/env bash
# workmail-connectivity-test.sh — diagnose WorkMail connectivity from any
# workstation before blaming Outlook.
#
# Tests, in order:
#   1. DNS resolution for imap / smtp / autodiscover / ews hosts
#   2. TCP+TLS handshake to imap:993 and smtp:465 (raises STARTTLS=NO)
#   3. HTTPS reachability of the Autodiscover XML endpoint
#   4. (optional) Real IMAP LOGIN if --password is supplied
#
# Usage:
#   workmail-connectivity-test.sh --region <us-east-1|us-west-2|eu-west-1> \
#                                 --user <full-email> \
#                                 [--password <pw>]
#
# Designed to run on Linux, macOS, and Git-Bash on Windows. Requires
# `openssl` (for TLS probes) and `curl`. No AWS credentials needed —
# this only exercises the public mail endpoints.

set -euo pipefail

REGION=""
USER_EMAIL=""
PASSWORD=""
VERBOSE=0

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)   REGION="$2"; shift 2 ;;
    --user)     USER_EMAIL="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    -v|--verbose) VERBOSE=1; shift ;;
    -h|--help)  usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

[[ -z "$REGION"     ]] && { echo "ERR: --region required" >&2; exit 2; }
[[ -z "$USER_EMAIL" ]] && { echo "ERR: --user required" >&2; exit 2; }

case "$REGION" in
  us-east-1|us-west-2|eu-west-1) ;;
  *) echo "ERR: WorkMail is only available in us-east-1, us-west-2, eu-west-1" >&2; exit 2 ;;
esac

IMAP_HOST="imap.mail.${REGION}.awsapps.com"
SMTP_HOST="smtp.mail.${REGION}.awsapps.com"
AUTODISCOVER_HOST="autodiscover-service.mail.${REGION}.awsapps.com"
EWS_HOST="ews.mail.${REGION}.awsapps.com"
AUTODISCOVER_URL="https://${AUTODISCOVER_HOST}/autodiscover/autodiscover.xml"

PASS=0; FAIL=0
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
note() { printf "    %s\n" "$1"; }
section() { printf "\n\033[1m%s\033[0m\n" "$1"; }

require_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERR: missing tool: $1" >&2; exit 3; }
}
require_bin openssl
require_bin curl
require_bin getent || command -v dig >/dev/null 2>&1 || \
  echo "WARN: neither getent nor dig found — DNS step uses curl's resolver only" >&2

resolve() {
  local host=$1
  if command -v getent >/dev/null 2>&1; then
    getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u | head -5
  elif command -v dig >/dev/null 2>&1; then
    dig +short "$host" 2>/dev/null | head -5
  else
    # Fallback via curl --resolve probe — won't print IPs, only succeed/fail
    curl -fsS --max-time 3 --connect-to "${host}:443:${host}:443" "https://${host}" -o /dev/null \
      && echo "<resolved-by-curl>" || true
  fi
}

probe_tls() {
  # $1 host  $2 port  → return 0 on TLS handshake, fill $TLS_INFO
  local host=$1 port=$2
  local out
  out=$(echo "" | openssl s_client -connect "${host}:${port}" -servername "$host" \
    -showcerts -brief 2>&1 </dev/null || true)
  TLS_INFO=$(printf '%s\n' "$out" | grep -E 'Protocol|Cipher|Verification|subject=' | head -4 | tr '\n' '; ')
  printf '%s\n' "$out" | grep -q "Verification: OK\|Verification error"
}

section "WorkMail connectivity probe"
note "Region:         $REGION"
note "Email:          $USER_EMAIL"
note "IMAP host:      ${IMAP_HOST}:993"
note "SMTP host:      ${SMTP_HOST}:465"
note "Autodiscover:   $AUTODISCOVER_URL"
note "EWS:            https://${EWS_HOST}/EWS/Exchange.asmx"

section "1. DNS resolution"
for h in "$IMAP_HOST" "$SMTP_HOST" "$AUTODISCOVER_HOST" "$EWS_HOST"; do
  ips=$(resolve "$h" || true)
  if [[ -n "$ips" ]]; then
    ok "$h → $(echo "$ips" | tr '\n' ' ')"
  else
    bad "$h → NO A RECORD"
    note "DNS or split-horizon problem on this network. Check resolv.conf / VPN."
  fi
done

section "2. TLS handshake"
if probe_tls "$IMAP_HOST" 993; then
  ok "IMAPS ${IMAP_HOST}:993 — ${TLS_INFO}"
else
  bad "IMAPS ${IMAP_HOST}:993 — handshake failed"
  note "Likely outbound 993 blocked by firewall/VPN."
fi

if probe_tls "$SMTP_HOST" 465; then
  ok "SMTPS ${SMTP_HOST}:465 — ${TLS_INFO}"
else
  bad "SMTPS ${SMTP_HOST}:465 — handshake failed"
  note "Likely outbound 465 blocked. WorkMail does NOT support STARTTLS on 587."
fi

section "3. Autodiscover XML reachability"
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X POST \
  -H "Content-Type: text/xml; charset=utf-8" \
  --data '<?xml version="1.0" encoding="utf-8"?><Autodiscover/>' \
  "$AUTODISCOVER_URL" || echo "000")
case "$code" in
  401|403|600) ok "Autodiscover XML reachable (HTTP $code — auth challenge expected)"
               note "401/403 is correct: clients prove identity with Basic auth on the next round-trip." ;;
  200)         ok "Autodiscover XML reachable (HTTP 200 — unusual but valid)" ;;
  000)         bad "Autodiscover XML unreachable (no TCP/TLS)"
               note "Most common cause: outbound 443 blocked or DNS poisoning." ;;
  *)           bad "Autodiscover XML HTTP $code"
               note "Expected 401/403; got $code. Confirm region and that the URL begins with 'autodiscover-service.' not 'autodiscover.'." ;;
esac

section "4. IMAP LOGIN (optional)"
if [[ -z "$PASSWORD" ]]; then
  note "Skipped (pass --password '...' to test LOGIN). Use a one-shot env-var or stdin to avoid"
  note "writing the password into shell history."
else
  # Use a tmpfile so the password never appears on the command line in ps.
  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT
  cat >"$TMP" <<EOF
A001 LOGIN $USER_EMAIL $PASSWORD
A002 LOGOUT
EOF
  out=$(openssl s_client -connect "${IMAP_HOST}:993" -servername "$IMAP_HOST" \
        -ign_eof -quiet 2>/dev/null <"$TMP" || true)
  rm -f "$TMP"; trap - EXIT
  if printf '%s' "$out" | grep -q "A001 OK"; then
    ok "IMAP LOGIN succeeded for $USER_EMAIL"
  elif printf '%s' "$out" | grep -q "A001 NO"; then
    bad "IMAP LOGIN refused — credentials invalid OR IMAP disabled at org level"
    note "WorkMail admin → Organizations → <org> → Access control rules. Confirm IMAP is allowed."
  else
    bad "IMAP LOGIN inconclusive — no protocol response"
    [[ $VERBOSE -eq 1 ]] && printf '%s\n' "$out" | sed 's/^/      /'
  fi
fi

section "Summary"
printf "  Passed: %d\n  Failed: %d\n" "$PASS" "$FAIL"
[[ $FAIL -gt 0 ]] && exit 1 || exit 0
