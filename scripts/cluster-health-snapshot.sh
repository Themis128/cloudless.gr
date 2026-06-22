#!/usr/bin/env bash
# Comprehensive cluster health check — Lambda, k3s, Grafana,
# GitHub runners, SSH paths. Run before deciding "is it me or is it broken?"
#
# Usage: bash scripts/cluster-health-snapshot.sh

set -uo pipefail   # no -e: continue past individual check failures

print_check() {
  local label="$1" expected="$2" actual="$3"
  local icon="✗"
  [[ "$actual" == "$expected" ]] && icon="✓"
  printf "  %s  %-40s expected=%-6s got=%s\n" "$icon" "$label" "$expected" "$actual"
}

echo "═══════════════════════════════════════════════════════════════"
echo "  CLOUDLESS.GR HEALTH SNAPSHOT — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "═══════════════════════════════════════════════════════════════"

# ── Public surfaces ──────────────────────────────────────────────────────────
echo ""
echo "▸ Public surfaces"
for entry in \
  "Lambda /api/health|https://cloudless.gr/api/health|200" \
  "Lambda /api/auth/session|https://cloudless.gr/api/auth/session|200" \  "Grafana|https://grafana.cloudless.gr/api/health|200"
do
  IFS='|' read -r label url expected <<< "$entry"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  print_check "$label" "$expected" "$code"
done

# ── Pi cluster (direct) ──────────────────────────────────────────────────────
echo ""
echo "▸ Pi cluster (LAN)"
code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: cloudless.gr" "https://192.168.1.128/api/health" 2>/dev/null)
print_check "k3s ingress (192.168.1.128)" "200" "$code"

for ip in 192.168.1.128 192.168.1.130; do
  if nc -z -w3 $ip 22 2>/dev/null; then
    print_check "SSH ${ip}:22" "open" "open"
  else
    print_check "SSH ${ip}:22" "open" "refused"
  fi
done

# ── GitHub runners ───────────────────────────────────────────────────────────
echo ""
echo "▸ GitHub Actions runners"
if command -v gh >/dev/null 2>&1; then
  gh api repos/Themis128/cloudless.gr/actions/runners 2>/dev/null \
    | python3 -c "
import sys, json
try:
    runners = json.load(sys.stdin).get('runners', [])
    for r in runners:
        icon = '✓' if r.get('status') == 'online' else '✗'
        busy = 'busy' if r.get('busy') else 'idle'
        print(f'  {icon}  {r.get(\"name\"):<15} ({r.get(\"status\")}, {busy})')
except Exception as e:
    print(f'  ⚠  parse error: {e}')
" 2>/dev/null || echo "  ⚠  gh API failed"
else
  echo "  ⚠  gh CLI not installed"
fi

# ── Recent workflow status ───────────────────────────────────────────────────
echo ""
echo "▸ Recent workflows (last unique 8)"
if command -v gh >/dev/null 2>&1; then
  gh run list --repo Themis128/cloudless.gr --limit 15 --json workflowName,conclusion,status 2>/dev/null \
    | python3 -c "
import sys,json
runs = json.load(sys.stdin)
seen = {}
for r in runs:
    wf = r['workflowName']
    if wf not in seen: seen[wf] = r
for wf,r in list(sorted(seen.items()))[:8]:
    s = r.get('conclusion') or r.get('status') or '?'
    icon = '✓' if s=='success' else ('…' if s in ('in_progress','queued') else ('⏭' if s in ('skipped','cancelled') else '✗'))
    print(f'  {icon}  {wf}: {s}')
" 2>/dev/null
fi

# ── Cert expiry ──────────────────────────────────────────────────────────────
echo ""
echo "▸ TLS cert expiry"
for host in cloudless.gr auth.cloudless.gr grafana.cloudless.gr; do
  expiry=$(echo | openssl s_client -servername $host -connect $host:443 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -n "$expiry" ]]; then
    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    icon="✓"
    [[ $days_left -lt 14 ]] && icon="⚠"
    [[ $days_left -lt 3 ]] && icon="✗"
    printf "  %s  %-40s %d days left (%s)\n" "$icon" "$host" "$days_left" "$expiry"
  else
    printf "  ✗  %-40s failed to check\n" "$host"
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
