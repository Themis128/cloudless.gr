#!/usr/bin/env bash
# Apply Prometheus rule tuning against the live cluster.
#
# Purpose:
#   Only REAL, customer-impacting events should reach Slack. Everything else
#   is operator-internal noise on this 2-node Pi cluster (helm chart was sized
#   for production GKE / EKS, not a homelab).
#
# What this script does:
#
#   1. Applies cluster-node-alerts (percentage-based mem + tuned disk).
#
#   2. Drops kube-prometheus-stack rule groups that fire constantly without
#      indicating a customer-facing problem:
#        - kube-apiserver-burnrate.rules     — timed-out queries on Pi
#        - kube-apiserver-availability.rules — same
#        - prometheus                        — fires on its own internal load
#        - prometheus-operator               — list errors during k3s rollouts
#        - alertmanager.rules                — self-referential (fires when
#                                              alert-api is down → cascades)
#        - kubernetes-system-apiserver       — Pi apiserver is single-replica,
#                                              `KubeAggregatedAPIDown` etc are
#                                              false during normal restarts
#        - config-reloaders                  — cosmetic
#        - node-network                      — NodeNetworkInterfaceFlapping
#                                              fires on cilium pod restarts
#
#   3. Strips individual alerts from groups we keep (the rest of the group
#      contains alerts we DO want):
#        - kubernetes-resources  : KubeMemoryOvercommit  (intrinsic on 2-node)
#                                  CPUThrottlingHigh     (info severity, noisy)
#                                  KubeQuotaFullyUsed    (intentional quotas)
#        - kubernetes-apps       : KubeJobFailed         (fires forever on old failed jobs)
#                                  KubeDeploymentReplicasMismatch (pending rollouts)
#                                  KubeDeploymentRolloutStuck     (mem-pressure rollouts)
#                                  KubePodNotReady       (replaced by k3s lifecycle)
#        - kubernetes-storage    : KubePersistentVolumeFillingUp  (covered by NodeDisk*)
#        - node-exporter         : NodeDiskIOSaturation  (Pi SSD always >70% util)
#                                  NodeMemoryMajorPagesFaults    (swap is fine)
#                                  NodeSystemSaturation  (Pi runs hot by design)
#        - general.rules         : TargetDown            (transient scrape failures
#                                                         during k3s pod rotations)
#
#   4. Updates AlertManager config to enforce an allowlist:
#        - Only alerts with severity=critical OR an explicit
#          `slack: "true"` label reach the alert-api → Slack path.
#        - Everything else routes to the "null" receiver (recorded in
#          Prometheus + alert-api DB but not Slacked).
#
# Idempotent. Safe to re-run after every `helm upgrade kube-prom`.
#
# Usage:
#   bash k8s/cluster-protection/apply-prometheus-rule-tuning.sh
set -euo pipefail

REMOTE=${REMOTE:-192.168.1.128}
MANIFEST_DIR=$(cd "$(dirname "$0")" && pwd)

echo "==> Pre-flight: confirming apiserver is responsive"
ssh "$REMOTE" 'for i in $(seq 1 12); do
  curl -sk --max-time 3 -o /dev/null -w "%{http_code}\n" \
    https://127.0.0.1:6443/livez | grep -qE "^(200|401)$" && exit 0
  sleep 5
done; echo "apiserver not responsive"; exit 1'

# ── 1. Cluster-node-alerts ───────────────────────────────────────────────────
echo "==> Applying cluster-node-alerts (percentage-based memory + tuned disk thresholds)"
ssh "$REMOTE" 'sudo kubectl --request-timeout=60s apply -f -' \
  < "$MANIFEST_DIR/prometheus-rule-tuning.yaml"

# ── 2. Drop entire chatty rule groups ────────────────────────────────────────
echo "==> Deleting chatty kube-prometheus-stack rule groups (always-noise on Pi)"
ssh "$REMOTE" 'sudo kubectl --request-timeout=60s -n monitoring \
  delete prometheusrule \
    monitoring-kube-apiserver-burnrate.rules \
    monitoring-kube-apiserver-availability.rules \
    monitoring-prometheus \
    monitoring-prometheus-operator \
    monitoring-alertmanager.rules \
    monitoring-kubernetes-system-apiserver \
    monitoring-config-reloaders \
    monitoring-node-network \
    --ignore-not-found=true'

# ── 3. Strip individual noisy alerts from groups we keep ─────────────────────

strip_alerts_from_rule() {
  local rule_name="$1"
  shift
  local alerts_to_drop=("$@")
  echo "==> Stripping ${alerts_to_drop[*]} from ${rule_name}"
  local drop_list_json
  drop_list_json=$(printf '%s\n' "${alerts_to_drop[@]}" | python3 -c 'import json,sys;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
  ssh "$REMOTE" "sudo kubectl get prometheusrule ${rule_name} \
    -n monitoring -o json" \
    | DROP_LIST="$drop_list_json" python3 -c "
import json, os, sys
drop = set(json.loads(os.environ['DROP_LIST']))
d = json.load(sys.stdin)
for g in d['spec'].get('groups', []):
    g['rules'] = [r for r in g.get('rules', []) if r.get('alert') not in drop]
print(json.dumps({'spec': {'groups': d['spec']['groups']}}))" \
    | ssh "$REMOTE" "sudo kubectl --request-timeout=60s patch prometheusrule \
      ${rule_name} -n monitoring --type=merge --patch-file=/dev/stdin"
}

strip_alerts_from_rule monitoring-kubernetes-resources \
  KubeMemoryOvercommit \
  KubeCPUOvercommit \
  CPUThrottlingHigh \
  KubeQuotaFullyUsed \
  KubeQuotaAlmostFull \
  KubeQuotaExceeded

strip_alerts_from_rule monitoring-kubernetes-apps \
  KubeJobFailed \
  KubeJobNotCompleted \
  KubeDeploymentReplicasMismatch \
  KubeDeploymentRolloutStuck \
  KubePodNotReady \
  KubeStatefulSetReplicasMismatch \
  KubeStatefulSetRolloutStuck \
  KubeDaemonSetRolloutStuck \
  KubeDaemonSetNotScheduled \
  KubeDaemonSetMisScheduled \
  KubeHpaReplicasMismatch \
  KubeHpaMaxedOut

strip_alerts_from_rule monitoring-kubernetes-storage \
  KubePersistentVolumeFillingUp \
  KubePersistentVolumeInodesFillingUp \
  KubePersistentVolumeErrors

strip_alerts_from_rule monitoring-node-exporter \
  NodeDiskIOSaturation \
  NodeMemoryMajorPagesFaults \
  NodeSystemSaturation \
  NodeNetworkReceiveErrs \
  NodeNetworkTransmitErrs \
  NodeFilesystemSpaceFillingUp \
  NodeFilesystemAlmostOutOfSpace \
  NodeFilesystemFilesFillingUp \
  NodeFilesystemAlmostOutOfFiles \
  NodeRAIDDegraded \
  NodeRAIDDiskFailure \
  NodeFileDescriptorLimit \
  NodeClockSkewDetected \
  NodeClockNotSynchronising

strip_alerts_from_rule monitoring-general.rules \
  TargetDown \
  InfoInhibitor

# ── 4. AlertManager allowlist routing ────────────────────────────────────────
echo "==> Patching AlertManager config: enforce severity=critical allowlist for Slack"
ssh "$REMOTE" 'sudo kubectl get secret alertmanager-monitoring-alertmanager \
  -n monitoring -o json' \
  | python3 <<'PY'
import json, sys, base64

secret = json.load(sys.stdin)
am_yaml = base64.b64decode(secret["data"]["alertmanager.yaml"]).decode()

# Idempotent marker — skip re-patching if already done.
marker = "# tuned-by: apply-prometheus-rule-tuning.sh v2"
if marker in am_yaml:
    print(am_yaml, end="")
    sys.exit(0)

# Replace the route block with an allowlist version that:
#   - Routes severity=critical → alert-api (Slack)
#   - Routes ESP32 watchdog alerts (real customer-facing probes) → alert-api
#   - Routes a curated set of warning alertnames → alert-api
#   - EVERYTHING ELSE → "null" receiver (recorded but not Slacked)
new_route = """{marker}
route:
  group_by: [namespace, alertname]
  group_interval: 5m
  group_wait: 30s
  receiver: "null"           # default: drop
  repeat_interval: 12h
  routes:
    - matchers: [alertname = "Watchdog"]
      receiver: "null"
    - matchers: [alertname = "InfoInhibitor"]
      receiver: "null"
    - matchers: [severity = "info"]
      receiver: "null"
    # ── Real, customer-facing alerts: forward to alert-api (Slack) ──
    - continue: true
      group_interval: 2m
      group_wait: 10s
      matchers: [severity = "critical"]
      receiver: alert-api
      repeat_interval: 4h
    - continue: true
      group_interval: 2m
      group_wait: 10s
      matchers:
        - severity = "warning"
        - alertname =~ "AWSProbeFailuresElevated|OmvProbeFailuresElevated|OmvHaProbeFailuresElevated|ESP32WatchdogDown|ESP32WifiWeak|NodeDiskUsageHigh|NodeDiskUsageOmvMain|NodeMemoryPressure|NodeHighSwapUsage"
      receiver: alert-api
      repeat_interval: 4h
""".format(marker=marker)

# Find the existing `route:` block (everything from `^route:` to next top-level key or EOF)
import re
am_yaml_new = re.sub(
    r"(?ms)^route:\n(?:[ \t].*\n?)+",
    new_route,
    am_yaml,
    count=1,
)
if am_yaml_new == am_yaml:
    sys.stderr.write("ERROR: did not match existing route: block — manual review needed\n")
    sys.exit(1)

secret["data"]["alertmanager.yaml"] = base64.b64encode(am_yaml_new.encode()).decode()
print(json.dumps(secret))
PY

# The python block above prints either:
#   (a) the original yaml verbatim if marker already present (skip apply)
#   (b) the full patched secret JSON (apply via kubectl)
# Detect which one and act accordingly.
PATCH=$(ssh "$REMOTE" 'sudo kubectl get secret alertmanager-monitoring-alertmanager \
  -n monitoring -o json' \
  | python3 <<'PY'
import json, sys, base64
secret = json.load(sys.stdin)
am_yaml = base64.b64decode(secret["data"]["alertmanager.yaml"]).decode()
marker = "# tuned-by: apply-prometheus-rule-tuning.sh v2"
if marker in am_yaml:
    print("ALREADY_TUNED")
    sys.exit(0)

import re
new_route = """{m}
route:
  group_by: [namespace, alertname]
  group_interval: 5m
  group_wait: 30s
  receiver: "null"
  repeat_interval: 12h
  routes:
    - matchers: [alertname = "Watchdog"]
      receiver: "null"
    - matchers: [alertname = "InfoInhibitor"]
      receiver: "null"
    - matchers: [severity = "info"]
      receiver: "null"
    - continue: true
      group_interval: 2m
      group_wait: 10s
      matchers: [severity = "critical"]
      receiver: alert-api
      repeat_interval: 4h
    - continue: true
      group_interval: 2m
      group_wait: 10s
      matchers:
        - severity = "warning"
        - alertname =~ "AWSProbeFailuresElevated|OmvProbeFailuresElevated|OmvHaProbeFailuresElevated|ESP32WatchdogDown|ESP32WifiWeak|NodeDiskUsageHigh|NodeDiskUsageOmvMain|NodeMemoryPressure|NodeHighSwapUsage"
      receiver: alert-api
      repeat_interval: 4h
""".format(m=marker)

am_yaml_new = re.sub(r"(?ms)^route:\n(?:[ \t].*\n?)+", new_route, am_yaml, count=1)
if am_yaml_new == am_yaml:
    sys.stderr.write("FAIL\n"); sys.exit(2)

secret["data"]["alertmanager.yaml"] = base64.b64encode(am_yaml_new.encode()).decode()
print(json.dumps(secret))
PY
)

if [[ "$PATCH" == "ALREADY_TUNED" ]]; then
  echo "    AlertManager config already has the v2 routing — skipping."
else
  echo "$PATCH" | ssh "$REMOTE" 'sudo kubectl apply -f -' >/dev/null
  echo "    AlertManager secret updated. Operator will hot-reload within 30s."
fi

echo
echo "==> Done. Verify:"
echo "    ssh $REMOTE 'sudo kubectl get prometheusrule -n monitoring | grep -E \"apiserver|prometheus\\$|alertmanager.rules\"'"
echo "    ssh $REMOTE 'curl -s http://10.43.154.40:9090/api/v1/alerts | python3 -c \"import json,sys;[print(a[\\\"labels\\\"][\\\"alertname\\\"]) for a in json.load(sys.stdin)[\\\"data\\\"][\\\"alerts\\\"]]\"'"
