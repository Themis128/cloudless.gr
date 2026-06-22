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
# 2026-06-02: also addresses alerting #258 PrometheusKubernetesListWatchFailures
# (Prometheus SD LIST/WATCH to the kube-apiserver timing out, 62/5min). Same root
# cause — the heavy rule groups saturate Prometheus CPU and load the apiserver,
# starving its service-discovery watches; removing them clears the SD timeouts.
#
# 2026-06-02 (b): also strips the intrinsic overcommit alerts
# (KubeMemoryOvercommit / KubeCPUOvercommit) from the kubernetes-resources
# group. On this asymmetric 2-node cluster (omv 8GiB vs omv-ha ~1GiB) the HA
# branch of the overcommit expression is permanently true — losing omv means
# omv-ha can't hold the rescheduled requests — so the alert fires forever with
# no actionable fix. Stripping the two alerts (keeping the rest of the group)
# silences the noise via the kubectl/workflow path (the comprehensive
# k8s/cluster-protection/apply-prometheus-rule-tuning.sh does the same over SSH,
# which a cloud session can't use). Idempotent: re-stripping a missing alert
# is a no-op.
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

# ── Strip intrinsic overcommit alerts from the kubernetes-resources group ─────
# KubeMemoryOvercommit / KubeCPUOvercommit are permanently true on this
# asymmetric 2-node cluster (see header). Remove just those alerts; keep the
# rest of every group they live in. Discover the owning PrometheusRule(s) by
# alert presence so we don't hardcode the chart's object name.
STRIP_ALERTS=("KubeMemoryOvercommit" "KubeCPUOvercommit")
drop_json=$(printf '%s\n' "${STRIP_ALERTS[@]}" | jq -R . | jq -s .)
mapfile -t res_crs < <(kubectl -n "$PROM_NS" get prometheusrule -o json 2>/dev/null \
  | jq -r --argjson drop "$drop_json" \
    '.items[] | select(any((.spec.groups // [])[].rules[]?; (.alert // "") as $a | ($drop | index($a)))) | .metadata.name' \
  | sort -u)
if [ "${#res_crs[@]}" -eq 0 ]; then
  log "overcommit: no PrometheusRule contains ${STRIP_ALERTS[*]} (already stripped?)"
else
  for cr in "${res_crs[@]}"; do
    [ -z "$cr" ] && continue
    log "stripping ${STRIP_ALERTS[*]} from PrometheusRule '$cr'"
    if kubectl -n "$PROM_NS" get prometheusrule "$cr" -o json \
      | jq --argjson drop "$drop_json" \
        '{spec: {groups: (.spec.groups | map(.rules |= map(select((.alert // "") as $a | ($drop | index($a)) | not))))}}' \
      | kubectl -n "$PROM_NS" patch prometheusrule "$cr" --type=merge --patch-file=/dev/stdin; then
      log "  ✓ patched '$cr'"
    else
      log "  WARNING: patch of '$cr' failed"
    fi
  done
fi

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

# ── Bump Prometheus container memory limit (500Mi → 750Mi) to stop OOMKills ─
log "Patching Prometheus StatefulSet memory limit to 750Mi..."
PROM_STS=$(kubectl -n "$PROM_NS" get sts -l app.kubernetes.io/name=prometheus \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "${PROM_STS:-}" ]; then
  CURRENT_MEM=$(kubectl -n "$PROM_NS" get sts "$PROM_STS" \
    -o jsonpath='{.spec.template.spec.containers[?(@.name=="prometheus")].resources.limits.memory}' \
    2>/dev/null || true)
  log "  current limit: ${CURRENT_MEM:-unknown}"
  if [ "${CURRENT_MEM:-}" = "750Mi" ]; then
    log "  already 750Mi — skipping patch"
  else
    kubectl -n "$PROM_NS" patch sts "$PROM_STS" \
      --type=strategic \
      -p '{"spec":{"template":{"spec":{"containers":[{"name":"prometheus","resources":{"limits":{"memory":"750Mi"},"requests":{"memory":"512Mi"}}}]}}}}' \
      && log "  patched → 750Mi limit / 512Mi request" \
      || log "  WARNING: StatefulSet patch failed"
    kubectl -n "$PROM_NS" rollout status sts/"$PROM_STS" --timeout=3m 2>&1 | tail -5 || true
    NEW_MEM=$(kubectl -n "$PROM_NS" get sts "$PROM_STS" \
      -o jsonpath='{.spec.template.spec.containers[?(@.name=="prometheus")].resources.limits.memory}' \
      2>/dev/null || true)
    log "  confirmed new limit: ${NEW_MEM:-unknown}"
  fi
else
  log "  WARNING: no Prometheus StatefulSet found (label app.kubernetes.io/name=prometheus)"
fi
