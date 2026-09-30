#!/usr/bin/env python3
"""Apply all cluster protection manifests against the live cluster.

Port of apply-all-guardrails.sh.

Usage:
  python3 k8s/cluster-protection/apply-all-guardrails.py

Assumes you can `ssh 192.168.1.128` and that the remote user has
`sudo k3s kubectl` available.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

REMOTE = os.environ.get("REMOTE", "192.168.1.128")
MANIFEST_DIR = Path(__file__).resolve().parent


def ssh(remote_cmd: str, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    r = subprocess.run(["ssh", REMOTE, remote_cmd], input=stdin, capture_output=True, check=False)
    if r.returncode != 0:
        print(r.stderr.decode(), file=sys.stderr)
        sys.exit(1)
    if r.stdout:
        print(r.stdout.decode(), end="")
    return r


def apply_manifest(name: str) -> None:
    ssh("kubectl --request-timeout=60s apply -f -", stdin=(MANIFEST_DIR / name).read_bytes())


print("==> Pre-flight: confirming apiserver is responsive")
responsive = False
for _ in range(12):
    r = subprocess.run(
        [
            "ssh",
            REMOTE,
            "curl -sk --max-time 3 -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez",
        ],
        capture_output=True,
        check=False,
    )
    if r.stdout.decode().strip() in ("200", "401"):
        responsive = True
        break
    time.sleep(5)
if not responsive:
    print("apiserver not responsive", file=sys.stderr)
    sys.exit(1)

print("==> Applying LimitRanges + ResourceQuotas (monitoring, cloudless)")
apply_manifest("limit-ranges.yaml")

print("==> Applying Analytics guardrails")
apply_manifest("analytics-guardrails.yaml")

print("==> Applying Generic guardrails (oncall, n8n, home-assistant)")
apply_manifest("generic-guardrails.yaml")

print("==> Applying explicit monitoring resource limits")
apply_manifest("monitoring-resources.yaml")

print("==> Patching duckdb-api resources")
ssh(
    "kubectl --request-timeout=60s patch deployment duckdb-api -n analytics --patch-file /dev/stdin",
    stdin=(MANIFEST_DIR / "duckdb-api-resources.yaml").read_bytes(),
)

print("==> Rolling out affected workloads to pick up new limits")
ssh("""\
  kubectl -n monitoring rollout restart \
    statefulset/loki \
    deployment/kube-prom-grafana \
    deployment/monitoring-operator \
    deployment/kube-prom-kube-state-metrics

  kubectl -n analytics rollout restart deployment/duckdb-api

  kubectl -n cloudless rollout restart deployment/cloudless
""")

print("==> Done. Verify with:")
print(f"    ssh {REMOTE} 'kubectl get quota -A'")
