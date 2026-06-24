#!/usr/bin/env bash
set -euo pipefail

node="${1:-omv}"

ok=0
fail=0
warn=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn+1))
}

echo "== DDNS update auth check =="
echo "Node: $node"
echo

if [[ -x infrastructure/omv/ddns-update-auth.sh ]]; then
  pass "tracked DDNS script exists"
else
  missing "tracked DDNS script missing: infrastructure/omv/ddns-update-auth.sh"
fi

if [[ -f infrastructure/omv/ddns-update-auth.env.example ]]; then
  pass "tracked DDNS env example exists"
else
  warning "tracked DDNS env example missing: infrastructure/omv/ddns-update-auth.env.example"
fi

if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'test -x /usr/local/bin/ddns-update-auth.sh'; then
  pass "$node has executable /usr/local/bin/ddns-update-auth.sh"
else
  missing "$node missing executable /usr/local/bin/ddns-update-auth.sh"
fi

if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'test -f /etc/cloudless/ddns-update-auth.env'; then
  pass "$node has /etc/cloudless/ddns-update-auth.env"

  if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'grep -q "^DDNS_ENABLED=true" /etc/cloudless/ddns-update-auth.env'; then
    pass "$node DDNS is enabled"
  else
    warning "$node DDNS is installed but disabled; this is OK while auth.cloudless.gr is legacy/inactive"
  fi
else
  warning "$node missing /etc/cloudless/ddns-update-auth.env; script should still exit quietly if implemented that way"
fi

if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'crontab -l 2>/dev/null | grep -q "/usr/local/bin/ddns-update-auth.sh"'; then
  pass "$node crontab references ddns-update-auth.sh"
else
  missing "$node crontab does not reference ddns-update-auth.sh"
fi

if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'crontab -l 2>/dev/null | grep "/usr/local/bin/ddns-update-auth.sh" | grep -q "ddns-update-auth.log"'; then
  pass "$node DDNS cron output is redirected to log"
else
  warning "$node DDNS cron output may still generate mail if the script writes output"
fi

if ssh -o BatchMode=yes -o ConnectTimeout=8 "$node" 'sudo /usr/local/bin/ddns-update-auth.sh >/tmp/ddns-check.out 2>&1; code=$?; cat /tmp/ddns-check.out; exit $code'; then
  pass "$node DDNS script exits successfully"
else
  missing "$node DDNS script failed"
fi

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
