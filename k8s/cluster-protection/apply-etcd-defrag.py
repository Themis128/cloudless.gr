#!/usr/bin/env python3
"""Apply the etcd-defrag CronJob to the cluster.

Port of apply-etcd-defrag.sh. Idempotent. Safe to re-run.

Usage:
  python3 k8s/cluster-protection/apply-etcd-defrag.py
"""

import os
import subprocess
import sys
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


print("==> Applying etcd-defrag CronJob")
ssh(
    "sudo kubectl --request-timeout=60s apply -f -",
    stdin=(MANIFEST_DIR / "etcd-defrag-cronjob.yaml").read_bytes(),
)

print("\n==> Verify:")
ssh("sudo kubectl -n monitoring get cronjob etcd-defrag")

print("\n==> Run a one-off now to validate:")
print(f"    ssh {REMOTE} 'sudo kubectl -n monitoring create job --from=cronjob/etcd-defrag etcd-defrag-manual-$(date +%s)'")
print(f"    ssh {REMOTE} 'sudo kubectl -n monitoring logs -l app=etcd-defrag --tail=40 -f'")
