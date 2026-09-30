#!/usr/bin/env python3
"""Apply Prometheus rule tuning against the live cluster.

Port of apply-prometheus-rule-tuning.sh.

Purpose:
  Only REAL, customer-impacting events should reach Slack. Everything else
  is operator-internal noise on this 2-node Pi cluster (helm chart was sized
  for production GKE / EKS, not a homelab).

What this script does:

  1. Applies cluster-node-alerts (percentage-based mem + tuned disk).

  2. Drops kube-prometheus-stack rule groups that fire constantly without
     indicating a customer-facing problem.

  3. Strips individual alerts from groups we keep.

  4. Updates AlertManager config to enforce an allowlist:
       - Only alerts with severity=critical OR an explicit
         `slack: "true"` label reach the alert-api → Slack path.
       - Everything else routes to the "null" receiver (recorded in
         Prometheus + alert-api DB but not Slacked).

Idempotent. Safe to re-run after every `helm upgrade kube-prom`.

Usage:
  python3 k8s/cluster-protection/apply-prometheus-rule-tuning.py
"""

import base64
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

REMOTE = os.environ.get("REMOTE", "192.168.1.128")
MANIFEST_DIR = Path(__file__).resolve().parent
MARKER = "# tuned-by: apply-prometheus-rule-tuning.sh v2"

CHATTY_RULE_GROUPS = [
    "monitoring-kube-apiserver-burnrate.rules",
    "monitoring-kube-apiserver-availability.rules",
    "monitoring-prometheus",
    "monitoring-prometheus-operator",
    "monitoring-alertmanager.rules",
    "monitoring-kubernetes-system-apiserver",
    "monitoring-config-reloaders",
    "monitoring-node-network",
]

ALERTS_TO_STRIP = {
    "monitoring-kubernetes-resources": [
        "KubeMemoryOvercommit",
        "KubeCPUOvercommit",
        "CPUThrottlingHigh",
        "KubeQuotaFullyUsed",
        "KubeQuotaAlmostFull",
        "KubeQuotaExceeded",
    ],
    "monitoring-kubernetes-apps": [
        "KubeJobFailed",
        "KubeJobNotCompleted",
        "KubeDeploymentReplicasMismatch",
        "KubeDeploymentRolloutStuck",
        "KubePodNotReady",
        "KubeStatefulSetReplicasMismatch",
        "KubeStatefulSetRolloutStuck",
        "KubeDaemonSetRolloutStuck",
        "KubeDaemonSetNotScheduled",
        "KubeDaemonSetMisScheduled",
        "KubeHpaReplicasMismatch",
        "KubeHpaMaxedOut",
    ],
    "monitoring-kubernetes-storage": [
        "KubePersistentVolumeFillingUp",
        "KubePersistentVolumeInodesFillingUp",
        "KubePersistentVolumeErrors",
    ],
    "monitoring-node-exporter": [
        "NodeDiskIOSaturation",
        "NodeMemoryMajorPagesFaults",
        "NodeSystemSaturation",
        "NodeNetworkReceiveErrs",
        "NodeNetworkTransmitErrs",
        "NodeFilesystemSpaceFillingUp",
        "NodeFilesystemAlmostOutOfSpace",
        "NodeFilesystemFilesFillingUp",
        "NodeFilesystemAlmostOutOfFiles",
        "NodeRAIDDegraded",
        "NodeRAIDDiskFailure",
        "NodeFileDescriptorLimit",
        "NodeClockSkewDetected",
        "NodeClockNotSynchronising",
    ],
    "monitoring-general.rules": [
        "TargetDown",
        "InfoInhibitor",
    ],
}

NEW_ROUTE = f"""{MARKER}
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
"""


def ssh(remote_cmd: str, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["ssh", REMOTE, remote_cmd],
        input=stdin,
        capture_output=True,
        check=False,
    )


def ssh_kubectl(*args: str, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    quoted = " ".join(args)
    return ssh(f"sudo kubectl --request-timeout=60s {quoted}", stdin=stdin)


print("==> Pre-flight: confirming apiserver is responsive")
responsive = False
for _ in range(12):
    r = ssh("curl -sk --max-time 3 -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez")
    code = r.stdout.decode().strip()
    if code in ("200", "401"):
        responsive = True
        break
    time.sleep(5)
if not responsive:
    print("apiserver not responsive", file=sys.stderr)
    sys.exit(1)

# ── 1. Cluster-node-alerts ───────────────────────────────────────────────────
print("==> Applying cluster-node-alerts (percentage-based memory + tuned disk thresholds)")
manifest = (MANIFEST_DIR / "prometheus-rule-tuning.yaml").read_bytes()
r = ssh_kubectl("apply -f -", stdin=manifest)
print(r.stdout.decode().rstrip())
if r.returncode != 0:
    print(r.stderr.decode(), file=sys.stderr)
    sys.exit(1)

# ── 2. Drop entire chatty rule groups ────────────────────────────────────────
print("==> Deleting chatty kube-prometheus-stack rule groups (always-noise on Pi)")
r = ssh_kubectl(
    "-n monitoring delete prometheusrule",
    *CHATTY_RULE_GROUPS,
    "--ignore-not-found=true",
)
print(r.stdout.decode().rstrip())

# ── 3. Strip individual noisy alerts from groups we keep ─────────────────────
for rule_name, drop in ALERTS_TO_STRIP.items():
    print(f"==> Stripping {' '.join(drop)} from {rule_name}")
    r = ssh(f"sudo kubectl get prometheusrule {rule_name} -n monitoring -o json")
    if r.returncode != 0 or not r.stdout.strip():
        print(f"    (rule {rule_name} not found — skip)")
        continue
    try:
        rule = json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"    (could not parse {rule_name} — skip)")
        continue
    drop_set = set(drop)
    for group in rule.get("spec", {}).get("groups", []):
        group["rules"] = [
            item for item in group.get("rules", []) if item.get("alert") not in drop_set
        ]
    patch = json.dumps({"spec": {"groups": rule["spec"]["groups"]}}).encode()
    r = ssh_kubectl(
        f"patch prometheusrule {rule_name} -n monitoring --type=merge --patch-file=/dev/stdin",
        stdin=patch,
    )
    if r.returncode != 0:
        print(r.stderr.decode(), file=sys.stderr)
        sys.exit(1)

# ── 4. AlertManager allowlist routing ────────────────────────────────────────
print("==> Patching AlertManager config: enforce severity=critical allowlist for Slack")
r = ssh("sudo kubectl get secret alertmanager-monitoring-alertmanager -n monitoring -o json")
if r.returncode != 0:
    print(r.stderr.decode(), file=sys.stderr)
    sys.exit(1)
secret = json.loads(r.stdout)
am_yaml = base64.b64decode(secret["data"]["alertmanager.yaml"]).decode()

if MARKER in am_yaml:
    print("    AlertManager config already has the v2 routing — skipping.")
else:
    am_yaml_new = re.sub(r"(?ms)^route:\n(?:[ \t].*\n?)+", NEW_ROUTE, am_yaml, count=1)
    if am_yaml_new == am_yaml:
        print("ERROR: did not match existing route: block — manual review needed", file=sys.stderr)
        sys.exit(1)
    secret["data"]["alertmanager.yaml"] = base64.b64encode(am_yaml_new.encode()).decode()
    r = ssh_kubectl("apply -f -", stdin=json.dumps(secret).encode())
    if r.returncode != 0:
        print(r.stderr.decode(), file=sys.stderr)
        sys.exit(1)
    print("    AlertManager secret updated. Operator will hot-reload within 30s.")

print()
print("==> Done. Verify:")
print(
    f"    ssh {REMOTE} 'sudo kubectl get prometheusrule -n monitoring | grep -E \"apiserver|prometheus$|alertmanager.rules\"'"
)
print(f"    ssh {REMOTE} 'curl -s http://10.43.154.40:9090/api/v1/alerts'")
