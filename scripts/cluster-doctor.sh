#!/usr/bin/env bash
# Read-only cluster diagnostics posted as a Markdown snapshot to issue #382.
#
# Runs on ubuntu-latest under cluster-doctor.yml with:
#   - tailscale (joined the tailnet)
#   - kubectl (KUBECONFIG_B64 decoded to ~/.kube/config)
#
# The workflow captures stdout via `tee snapshot.md`, so every line here
# lands in the issue comment. Never touches cluster state.

set -uo pipefail

kbin=$(command -v kubectl || true)
if [[ -z "$kbin" ]]; then
  echo "# Cluster snapshot"
  echo ""
  echo "_kubectl is not on PATH — doctor cannot run._"
  exit 0
fi

k() { "$kbin" "$@" 2>&1; }

now_utc=$(date -u '+%Y-%m-%d %H:%M:%SZ')
git_sha="${GITHUB_SHA:-}"
if [[ -z "$git_sha" && -d .git ]]; then
  git_sha=$(git rev-parse HEAD 2>/dev/null || echo "")
fi
short_sha="${git_sha:0:12}"

echo "# Cluster snapshot — ${now_utc}"
echo ""
echo "**Expected app SHA (main HEAD):** \`${short_sha:-unknown}\`"
echo ""

# ── Reachability ──────────────────────────────────────────────────────
if ! k get --raw=/healthz --request-timeout=5s >/dev/null; then
  echo "## ❌ kubectl cannot reach the k3s API"
  echo ""
  echo '```'
  k cluster-info dump --request-timeout=5s 2>&1 | head -20
  echo '```'
  echo ""
  echo "_Aborting further probes; the API server is unreachable._"
  exit 0
fi
echo "✅ k3s API reachable (\`$(k config current-context)\`)"
echo ""

# ── Nodes ─────────────────────────────────────────────────────────────
echo "## Nodes"
echo ""
echo '```'
k get nodes -o wide
echo '```'
echo ""
echo '```'
k top nodes 2>/dev/null || echo "(metrics-server unavailable)"
echo '```'
echo ""

# ── Per-node conditions on omv ────────────────────────────────────────
for node in omv omv-ha; do
  echo "### ${node} — conditions & allocation"
  echo '```'
  k describe node "$node" 2>/dev/null | awk '/^Conditions:/,/^Addresses:/' | head -30
  echo "---"
  k describe node "$node" 2>/dev/null | awk '/^Allocated resources:/,/^Events:/' | head -30
  echo '```'
  echo ""
done

# ── Pods on the omv node specifically ─────────────────────────────────
echo "## All pods on node \`omv\`"
echo ""
echo '```'
k get pods -A -o wide --field-selector=spec.nodeName=omv
echo '```'
echo ""

# ── Problem pods (all namespaces) ─────────────────────────────────────
echo "## Pods not Running/Completed (all namespaces)"
echo ""
echo '```'
bad=$(k get pods -A --no-headers 2>/dev/null | awk '$4 != "Running" && $4 != "Completed" && $4 != "" {print}')
if [[ -z "$bad" ]]; then
  echo "(none — every pod is Running or Completed)"
else
  printf '%s\n' "$bad"
fi
echo '```'
echo ""

# ── Pods with recent restarts ─────────────────────────────────────────
echo "## Pods with restarts > 0 (last 24h)"
echo ""
echo '```'
k get pods -A --no-headers 2>/dev/null \
  | awk 'int($5) > 0 { printf "%-25s %-45s ready=%-5s status=%-15s restarts=%s\n", $1, $2, $3, $4, $5 }' \
  | sort -k5 -n -r | head -20
echo '```'
echo ""

# ── cloudless-app Deployment (the site) ───────────────────────────────
echo "## cloudless-app — deployment"
echo ""
echo '```'
k -n cloudless get deploy cloudless-app -o wide 2>/dev/null || echo "(deployment not found)"
echo '```'
echo ""

echo "### cloudless-app — pods on omv"
echo '```'
k -n cloudless get pods -l app=cloudless-app -o wide 2>/dev/null || echo "(no pods)"
echo '```'
echo ""

echo "### cloudless-app — container image & env sync"
pod=$(k -n cloudless get pod -l app=cloudless-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [[ -n "$pod" ]]; then
  echo '```'
  echo "Pod name        : $pod"
  echo -n "Node            : "; k -n cloudless get pod "$pod" -o jsonpath='{.spec.nodeName}'; echo
  echo -n "Container image : "; k -n cloudless get pod "$pod" -o jsonpath='{.spec.containers[0].image}'; echo
  echo -n "Restart count   : "; k -n cloudless get pod "$pod" -o jsonpath='{.status.containerStatuses[0].restartCount}'; echo
  echo -n "Ready           : "; k -n cloudless get pod "$pod" -o jsonpath='{.status.containerStatuses[0].ready}'; echo
  echo -n "Started at      : "; k -n cloudless get pod "$pod" -o jsonpath='{.status.startTime}'; echo
  echo ""
  echo "APP_VERSION env on live pod:"
  k -n cloudless exec "$pod" -- printenv APP_VERSION 2>/dev/null | sed 's/^/  /' || echo "  (exec failed)"
  echo ""
  echo "APP_VERSION env from spec (last applied by deploy-pi.yml):"
  k -n cloudless get deploy cloudless-app -o jsonpath='{.spec.template.spec.containers[0].env}' 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'  {e[\"name\"]}={e.get(\"value\",\"\")}') for e in d if e['name'] in ('APP_VERSION','NEXT_PUBLIC_APP_VERSION','NEXT_PUBLIC_AUTH_PROVIDER','SSM_DISABLED')]" 2>/dev/null || echo "  (env parse failed)"
  echo '```'
else
  echo "_No cloudless-app pod found — deployment likely absent or renamed._"
fi
echo ""

# ── Sync verdict: is the live app on main HEAD? ───────────────────────
echo "## App sync verdict"
echo ""
live_version=""
for url in http://192.168.1.128:30300/api/health http://192.168.1.130:30300/api/health https://pi-origin.cloudless.gr/api/health; do
  body=$(curl -sS --max-time 6 "$url" 2>/dev/null || true)
  parsed=$(printf '%s' "$body" | python3 -c "import sys,json;
try: print(json.load(sys.stdin).get('version',''))
except Exception: pass" 2>/dev/null || true)
  if [[ -n "$parsed" ]]; then
    live_version="$parsed"
    echo "- Reached \`$url\` — reported version \`${live_version:0:12}\`"
    break
  fi
  echo "- \`$url\` → no version (body: \`${body:0:80}\`)"
done

echo ""
if [[ -n "$live_version" && -n "$short_sha" ]]; then
  if [[ "$live_version" == "$git_sha" || "$live_version" == "$short_sha"* || "$git_sha" == "$live_version"* ]]; then
    echo "✅ **Live app is in sync with main.** \`${live_version:0:12}\` == \`${short_sha}\`"
  else
    echo "⚠️ **Drift detected.** Live app version \`${live_version:0:12}\` ≠ main HEAD \`${short_sha}\`."
    echo ""
    echo "Deploy-pi likely stalled or never ran for the newer SHA. Check:"
    echo "  - Runs of \`deploy-pi.yml\` (needs \`[self-hosted, omv, build]\` runner online)"
    echo "  - Whether the recent commits touched paths on deploy-pi's push filter"
  fi
elif [[ -z "$live_version" ]]; then
  echo "❌ Could not reach any \`/api/health\` endpoint — cannot compare app SHA."
else
  echo "_Skipped verdict (git_sha unknown)._"
fi
echo ""

# ── Recent Warning events (last 30 min) ───────────────────────────────
echo "## Recent Warning events (all namespaces, last 20)"
echo ""
echo '```'
k get events -A --field-selector=type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -20
echo '```'
echo ""

# ── cloudless namespace event tail ────────────────────────────────────
echo "## cloudless namespace — event tail"
echo ""
echo '```'
k get events -n cloudless --sort-by=.lastTimestamp 2>/dev/null | tail -15
echo '```'
echo ""

echo "_End of snapshot._"
