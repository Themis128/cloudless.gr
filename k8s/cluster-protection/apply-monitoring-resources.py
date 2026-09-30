#!/usr/bin/env python3
"""Apply monitoring-resources.yaml against the live cluster.

Port of apply-monitoring-resources.sh.

This is a thin wrapper around `kubectl apply` that adds the safety
rails appropriate for editing live workloads on a host that has
historically been overloaded.

Usage:
  python3 k8s/cluster-protection/apply-monitoring-resources.py

Assumes you can `ssh 192.168.1.128` and that the remote user has
`sudo k3s kubectl` available (or kubectl + KUBECONFIG configured).
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

print("==> Applying LimitRanges + ResourceQuotas")
ssh("kubectl --request-timeout=60s apply -f -", stdin=(MANIFEST_DIR / "limit-ranges.yaml").read_bytes())

print("==> Applying monitoring resource limits")
ssh("kubectl --request-timeout=60s apply -f -", stdin=(MANIFEST_DIR / "monitoring-resources.yaml").read_bytes())

print("==> Rolling out monitoring workloads to pick up new limits")
ssh(
    "kubectl --request-timeout=60s -n monitoring rollout restart "
    "statefulset/loki "
    "deployment/kube-prom-grafana "
    "deployment/monitoring-operator "
    "deployment/kube-prom-kube-state-metrics"
)

# Prometheus + Alertmanager are managed by the operator — it will
# reconcile the resource changes into the underlying StatefulSets
# within ~30s without us touching them.

print("==> Done. Verify with:")
print(f"    ssh {REMOTE} 'kubectl -n monitoring get pods'")
print(f"    ssh {REMOTE} 'kubectl -n monitoring describe quota monitoring-quota'")
