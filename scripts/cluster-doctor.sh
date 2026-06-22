#!/usr/bin/env bash
# triggered: 2026-06-03 session saJbZ — diagnose Pi 502 / runner offline cascade
#
# cluster-doctor.sh — comprehensive read-only diagnostics for the omv k3s cluster.
#
# Covers every service tier:
#   Tier 1 — Auth     : Cognito (managed AWS)
#   Tier 2 — App      : cloudless, ntfy, n8n
#   Tier 3 — Monitoring: Prometheus, Grafana, Alertmanager, Loki
#   Tier 4 — Analytics : Metabase, DuckDB API
#   Tier 5 — Infra    : Nodes, etcd-defrag, maintenance CronJobs
#   Tier 6 — External : Public HTTP surfaces, GitHub runners
#
# Emits Markdown to stdout. Every kubectl/curl call is best-effort (|| true)
# so the report always completes even when individual objects are missing.
#
# Usage:
#   bash scripts/cluster-doctor.sh
#
# Env overrides:
#   KC_NS, KC_DEPLOY, PROM_NS, ANALYTICS_NS, CLOUDLESS_NS, DISCOVERY

set -uo pipefail

PROM_NS="${PROM_NS:-monitoring}"
ANALYTICS_NS="${ANALYTICS_NS:-analytics}"
CLOUDLESS_NS="${CLOUDLESS_NS:-cloudless}"
DISCOVERY="${DISCOVERY:-https://auth.cloudless.gr/realms/master/.well-known/openid-configuration}"
GRAFANA_URL="${GRAFANA_URL:-https://grafana.cloudless.gr/api/health}"
LAMBDA_URL="${LAMBDA_URL:-https://cloudless.gr/api/health}"

k() { kubectl "$@" 2>&1 || true; }
section() { printf "\n## %s\n\n" "$*"; }
fence()  { printf '```\n'; cat; printf '```\n'; }
http_check() { curl -sS -m 8 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || echo 000; }
pod_states() {
  local ns="$1" selector="$2"
  kubectl -n "$ns" get pods -l "$selector" \
    -o jsonpath='{range .items[*]}{.metadata.name}{":\n"}{range .status.containerStatuses[*]}{"  "}{.name}{": restarts="}{.restartCount}{" ready="}{.ready}{" waiting="}{.state.waiting.reason}{" lastExit="}{.lastState.terminated.reason}{"(exit "}{.lastState.terminated.exitCode}{")\n"}{end}{end}' \
    2>&1 || true
}
deploy_limits() {
  local ns="$1" deploy="$2"
  kubectl -n "$ns" get deploy "$deploy" \
    -o jsonpath='{range .spec.template.spec.containers[*]}{.name}{"\n  limits="}{.resources.limits}{"\n  requests="}{.resources.requests}{"\n"}{end}' \
    2>/dev/null || true
}

printf "# Cluster snapshot — %s\n" "$(date -u '+%Y-%m-%d %H:%M:%SZ')"

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1 — AUTH
# ═══════════════════════════════════════════════════════════════════════════════

section "auth.cloudless.gr"
kc_http=$(http_check "$DISCOVERY")
printf "OIDC discovery: **HTTP %s** (200 = up)\n" "$kc_http"

section "cloudless app (k3s standby — ns ${CLOUDLESS_NS})"
k -n "$CLOUDLESS_NS" get deploy cloudless -o wide | fence
printf "Limits + image:\n"
kubectl -n "$CLOUDLESS_NS" get deploy cloudless \
  -o jsonpath='{range .spec.template.spec.containers[*]}{.name}{"\n  image="}{.image}{"\n  limits="}{.resources.limits}{"\n  requests="}{.resources.requests}{"\n"}{end}' \
  2>/dev/null | fence
printf "envFrom secrets: "
kubectl -n "$CLOUDLESS_NS" get deploy cloudless \
  -o jsonpath='{range .spec.template.spec.containers[*]}{range .envFrom[*]}{.secretRef.name}{" "}{end}{end}' \
  2>/dev/null
# AUTH_URL/AUTH_TRUST_HOST live in the cloudless-app-auth envFrom secret, not
# in the deployment's direct .env array — read from the secret as the source of truth.
_auth_url="$(kubectl -n "$CLOUDLESS_NS" get secret cloudless-app-auth \
  -o jsonpath='{.data.AUTH_URL}' 2>/dev/null | base64 -d 2>/dev/null || true)"
_auth_trust="$(kubectl -n "$CLOUDLESS_NS" get secret cloudless-app-auth \
  -o jsonpath='{.data.AUTH_TRUST_HOST}' 2>/dev/null | base64 -d 2>/dev/null || true)"
# Fall back to direct env check (in case the secret approach fails)
[ -z "$_auth_url" ] && _auth_url="$(kubectl -n "$CLOUDLESS_NS" get deploy cloudless \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AUTH_URL")].value}' 2>/dev/null)"
[ -z "$_auth_trust" ] && _auth_trust="$(kubectl -n "$CLOUDLESS_NS" get deploy cloudless \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AUTH_TRUST_HOST")].value}' 2>/dev/null)"
printf "\nAUTH_URL=%s  AUTH_TRUST_HOST=%s\n" "$_auth_url" "$_auth_trust"

section "cloudless app: pods"
k -n "$CLOUDLESS_NS" get pods -o wide | fence
printf "Container states:\n"
pod_states "$CLOUDLESS_NS" "app=cloudless" | fence

section "ntfy (push notifications)"
k -n ntfy get deploy -o wide 2>/dev/null | fence
printf "Container states:\n"
pod_states ntfy "app=ntfy" | fence
printf "Limits:\n"
deploy_limits ntfy ntfy 2>/dev/null | fence

section "n8n (workflow automation)"
k -n n8n get deploy -o wide 2>/dev/null | fence
printf "Container states:\n"
pod_states n8n "app=n8n" | fence

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 3 — MONITORING STACK
# ═══════════════════════════════════════════════════════════════════════════════

section "Prometheus: pods"
k -n "$PROM_NS" get pods -l app.kubernetes.io/name=prometheus -o wide | fence
printf "Container states:\n"
pod_states "$PROM_NS" "app.kubernetes.io/name=prometheus" | fence
printf "Prometheus memory limit: %s\n" \
  "$(kubectl -n "$PROM_NS" get sts -l app.kubernetes.io/name=prometheus \
    -o jsonpath='{.items[0].spec.template.spec.containers[?(@.name=="prometheus")].resources.limits.memory}' 2>&1)"

section "Prometheus: failing rules"
kubectl -n "$PROM_NS" run "promq-$$" --image=curlimages/curl:8.11.1 \
  --restart=Never --rm -i --quiet \
  --command -- curl -sS --max-time 12 \
  "http://prometheus-operated.${PROM_NS}.svc:9090/api/v1/rules" \
  2>/dev/null > /tmp/promrules.json || true
if [ -s /tmp/promrules.json ]; then
  jq -r '
    [ .data.groups[]
      | .name as $g | .rules[]
      | select((.health != "ok") or ((.lastError // "") != ""))
      | "[\($g)] \(.name)  health=\(.health)\n    lastError: \(.lastError // "")"
    ] as $bad
    | if ($bad|length)==0 then "all rules healthy (no eval failures right now)"
      else $bad[] end
  ' /tmp/promrules.json 2>&1 | fence
  printf "rule groups: %s, rules: %s\n" \
    "$(jq '.data.groups|length' /tmp/promrules.json 2>/dev/null)" \
    "$(jq '[.data.groups[].rules[]]|length' /tmp/promrules.json 2>/dev/null)"
else
  printf "_could not fetch /api/v1/rules_\n"
fi

section "Grafana"
k -n "$PROM_NS" get deploy -l "app.kubernetes.io/name=grafana" -o wide 2>/dev/null | fence
printf "Container states:\n"
kubectl -n "$PROM_NS" get pods -l "app.kubernetes.io/name=grafana" \
  -o jsonpath='{range .items[*]}{.metadata.name}{":\n"}{range .status.containerStatuses[*]}{"  "}{.name}{": restarts="}{.restartCount}{" ready="}{.ready}{" lastExit="}{.lastState.terminated.reason}{"\n"}{end}{end}' \
  2>&1 | fence
grafana_http=$(http_check "$GRAFANA_URL")
printf "grafana.cloudless.gr/api/health: **HTTP %s** (200 = up)\n" "$grafana_http"

section "Alertmanager"
k -n "$PROM_NS" get pods -l "app.kubernetes.io/name=alertmanager" -o wide | fence
printf "Container states:\n"
pod_states "$PROM_NS" "app.kubernetes.io/name=alertmanager" | fence

section "Loki"
k -n "$PROM_NS" get statefulsets loki -o wide 2>/dev/null | fence
printf "Container states:\n"
kubectl -n "$PROM_NS" get pods -l "app.kubernetes.io/name=loki" \
  -o jsonpath='{range .items[*]}{.metadata.name}{":\n"}{range .status.containerStatuses[*]}{"  "}{.name}{": restarts="}{.restartCount}{" ready="}{.ready}{" lastExit="}{.lastState.terminated.reason}{"\n"}{end}{end}' \
  2>&1 | fence

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 4 — ANALYTICS STACK
# ═══════════════════════════════════════════════════════════════════════════════

section "Metabase (analytics/metabase)"
k -n "$ANALYTICS_NS" get deploy metabase -o wide 2>/dev/null | fence
printf "Container states:\n"
pod_states "$ANALYTICS_NS" "app=metabase" | fence
printf "Limits:\n"
deploy_limits "$ANALYTICS_NS" metabase 2>/dev/null | fence

section "DuckDB API (analytics/duckdb-api)"
k -n "$ANALYTICS_NS" get deploy duckdb-api -o wide 2>/dev/null | fence
printf "Container states:\n"
pod_states "$ANALYTICS_NS" "app=duckdb-api" | fence
printf "Limits:\n"
deploy_limits "$ANALYTICS_NS" duckdb-api 2>/dev/null | fence

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 5 — INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════

section "Nodes"
k get nodes -o wide | fence
k top nodes | fence

section "Node conditions + allocated resources"
for n in $(kubectl get nodes -o name 2>/dev/null | sed 's#node/##'); do
  printf "### %s\n" "$n"
  kubectl describe node "$n" 2>/dev/null \
    | grep -iE "MemoryPressure|DiskPressure|PIDPressure|Allocated resources:|memory\s|cpu\s" \
    | head -15 | fence
done

section "Pods not Running/Completed (all namespaces)"
k get pods -A --field-selector=status.phase!=Running 2>/dev/null \
  | grep -vE "Completed|Succeeded" | fence

section "etcd-defrag: last 3 runs"
k -n "$PROM_NS" get jobs -l app=etcd-defrag \
  --sort-by=.metadata.creationTimestamp 2>/dev/null | tail -4 | fence
printf "Last defrag log (tail 10):\n"
k -n "$PROM_NS" logs -l app=etcd-defrag --tail=10 2>/dev/null | fence

section "Maintenance CronJobs (recent failures)"
k -n maintenance get cronjobs 2>/dev/null | fence
k -n maintenance get jobs --sort-by=.metadata.creationTimestamp 2>/dev/null \
  | tail -10 | fence
printf "Recent failed jobs:\n"
kubectl -n maintenance get jobs \
  -o jsonpath='{range .items[?(@.status.failed>0)]}{.metadata.name}{" failed="}{.status.failed}{" start="}{.status.startTime}{"\n"}{end}' \
  2>/dev/null | fence

section "Cluster-alerts CronJob (Slack error notifier)"
k -n "$PROM_NS" get cronjob cluster-alerts 2>/dev/null | fence
k -n "$PROM_NS" get jobs -l app=cluster-alerts \
  --sort-by=.metadata.creationTimestamp 2>/dev/null | tail -4 | fence

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 6 — EXTERNAL / OBSERVABILITY
# ═══════════════════════════════════════════════════════════════════════════════

section "Public HTTP surfaces"
for entry in \
  "Lambda /api/health|${LAMBDA_URL}" \
  "Lambda /api/auth/session|https://cloudless.gr/api/auth/session" \  "Grafana|${GRAFANA_URL}"
do
  IFS='|' read -r label url <<< "$entry"
  code=$(http_check "$url")
  icon="✓"; [ "$code" != "200" ] && icon="✗"
  printf "%s  %-35s HTTP %s\n" "$icon" "$label" "$code"
done

section "Identity & write permissions (can CI kubeconfig recover services?)"
printf "whoami: %s\n" "$(kubectl auth whoami 2>&1 | tr '\n' ' ')"
for ns in "$KC_NS" "$PROM_NS" "$ANALYTICS_NS" ntfy n8n; do
  printf "  %-12s patch deployments: %s\n" "$ns" \
    "$(kubectl auth can-i patch deployments -n "$ns" 2>&1)"
done

section "GitHub Actions runners"
if command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ]; then
  gh api repos/Themis128/cloudless.gr/actions/runners --jq \
    '.runners[] | "  \(if .status=="online" then "✓" else "✗" end)  \(.name)  \(.status)  \(if .busy then "busy" else "idle" end)  labels=\([.labels[].name] | join(","))"' \
    2>/dev/null || printf "  (gh auth or token missing)\n"
else
  printf "  (GH_TOKEN not set — skipping runner check)\n"
fi

section "pi-origin.cloudless.gr — full response headers"
printf "GET https://pi-origin.cloudless.gr/api/health (showing all response headers):\n"
curl -sI --max-time 10 https://pi-origin.cloudless.gr/api/health 2>/dev/null | fence \
  || printf "  (curl failed or timed out)\n"
printf "content-security-policy specifically: "
csp_val=$(curl -sI --max-time 10 https://pi-origin.cloudless.gr/api/health 2>/dev/null \
  | grep -i '^content-security-policy:' | head -1)
[ -n "$csp_val" ] && printf "**PRESENT** — %s\n" "$csp_val" || printf "**MISSING**\n"

section "Traefik middlewares (all namespaces)"
k get middlewares.traefik.io --all-namespaces -o yaml 2>/dev/null | fence

section "Traefik IngressRoutes (namespace: ${CLOUDLESS_NS})"
k -n "$CLOUDLESS_NS" get ingressroutes.traefik.io -o yaml 2>/dev/null | fence

printf "\n_End of snapshot._\n"

# re-trigger-doctor-20260602g-csp-probe
