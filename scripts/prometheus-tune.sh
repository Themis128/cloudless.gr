#!/usr/bin/env bash
#
# prometheus-tune.sh — stop PrometheusRuleFailures on the small omv cluster.
#
# Root cause (cluster-doctor, issue #382): the kube-prometheus-stack apiserver
# SLO recording rules (group kube-apiserver-burnrate.rules, e.g.
# apiserver_request:burnrate3d) run multi-day rate() over high-cardinality
# apiserver_request_total series. On a Pi (1 CPU / 500Mi Prometheus) they exceed
# the rule evaluation timeout → "expanding series: context deadline exceeded" →
# prometheus_rule_evaluation_failures_total increments → PrometheusRuleFailures.
#
# These SLO/burnrate/availability rules are for large-scale apiserver SLO
# dashboards that this homelab does not use (the monitoring stack is being
# slimmed to cluster-health-only — see prometheus-slim.yaml). Disabling them
# stops the failures AND lightens Prometheus CPU/memory.
#
# This deletes the PrometheusRule objects that contain the heavy groups. It is
# idempotent (missing = already done) and reversible: a `helm upgrade` of the
# kube-prometheus-stack recreates them, so the durable fix is the Helm values
# (defaultRules.rules.kubeApiserverBurnrate/Availability/Slos: false) — applied
# wherever that release is managed.
#
# Requires a kubectl context with delete on prometheusrules in the monitoring
# namespace (the prometheus-tune.yml workflow supplies one via KUBECONFIG_B64).
#
# Usage: bash scripts/prometheus-tune.sh

set -uo pipefail

PROM_NS="${PROM_NS:-monitoring}"
HEAVY_GROUPS=(
  "kube-apiserver-burnrate.rules"
  "kube-apiserver-availability.rules"
  "kube-apiserver-slos"
)

log() { printf '[prom-tune] %s\n' "$*"; }
command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found"; exit 1; }

log "whoami: $(kubectl auth whoami 2>&1 | tr '\n' ' ')"

deleted=0
for grp in "${HEAVY_GROUPS[@]}"; do
  # Find every PrometheusRule whose spec contains this heavy group.
  mapfile -t crs < <(kubectl -n "$PROM_NS" get prometheusrule -o json 2>/dev/null \
    | jq -r --arg g "$grp" '.items[] | select((.spec.groups // [])[].name == $g) | .metadata.name' \
    | sort -u)
  if [ "${#crs[@]}" -eq 0 ]; then
    log "group '$grp': no PrometheusRule found (already disabled?)"
    continue
  fi
  for cr in "${crs[@]}"; do
    [ -z "$cr" ] && continue
    log "deleting PrometheusRule '$cr' (contains heavy group '$grp')"
    kubectl -n "$PROM_NS" delete prometheusrule "$cr" --ignore-not-found && deleted=$((deleted+1))
  done
done
log "deleted $deleted PrometheusRule object(s)."

# Give Prometheus a moment to reload rules, then report remaining failures.
sleep 20
log "Remaining rules with health != ok:"
kubectl -n "$PROM_NS" run "promq-$$" --image=curlimages/curl:8.11.1 --restart=Never --rm -i --quiet \
  --command -- curl -sS --max-time 12 "http://prometheus-operated.${PROM_NS}.svc:9090/api/v1/rules" 2>/dev/null \
  > /tmp/promrules.json || true
if [ -s /tmp/promrules.json ]; then
  jq -r '
    [ .data.groups[] | .name as $g | .rules[]
      | select((.health != "ok") or ((.lastError // "") != ""))
      | "[\($g)] \(.name): \(.lastError // "")" ] as $bad
    | if ($bad|length)==0 then "  ✓ all rules healthy" else $bad[] end
  ' /tmp/promrules.json 2>&1
else
  log "  (could not re-fetch /api/v1/rules)"
fi
