#!/usr/bin/env python3
"""Populate the `cluster-alerts-kuma` Secret with real Uptime Kuma
push-monitor tokens (7 positional args, one per monitor), then
apply to the monitoring ns AND replicate into each backup-CronJob
namespace (appflowy, espocrm, n8n, postiz).

Usage:
  python3 scripts/populate-kuma-secrets.py <K3S_POD_HEALTH> \\
      <ETCD_SNAPSHOT_AGE> <CLOUDFLARED_DRIFT> <BACKUP_APPFLOWY> \\
      <BACKUP_ESPOCRM> <BACKUP_N8N> <BACKUP_POSTIZ>

Each arg is the token portion of a Kuma push URL:
  https://kuma.cloudless.gr/api/push/abc123XYZ → abc123XYZ

Monitor order: k3s-pod-health, etcd-snapshot-age, cloudflared-drift,
backup-appflowy, backup-espocrm, backup-n8n, backup-postiz."""

import subprocess
import sys

KEYS = ["KUMA_PUSH_K3S_POD_HEALTH", "KUMA_PUSH_ETCD_SNAPSHOT_AGE",
        "KUMA_PUSH_CLOUDFLARED_DRIFT", "KUMA_PUSH_BACKUP_APPFLOWY",
        "KUMA_PUSH_BACKUP_ESPOCRM", "KUMA_PUSH_BACKUP_N8N",
        "KUMA_PUSH_BACKUP_POSTIZ"]

if len(sys.argv) != 8:
    sys.exit(__doc__.strip() +
             f"\n\nERROR: expected 7 arguments, "
             f"got {len(sys.argv) - 1}")

tokens = dict(zip(KEYS, sys.argv[1:8]))


def apply_secret(ns: str) -> None:
    print(f"→ applying cluster-alerts-kuma in namespace={ns}")
    args = ["kubectl", "create", "secret", "generic",
            "cluster-alerts-kuma", f"--namespace={ns}"]
    for k, v in tokens.items():
        args.append(f"--from-literal={k}={v}")
    args += ["--dry-run=client", "-o", "yaml"]
    r = subprocess.run(args, capture_output=True, text=True)
    apply = subprocess.run(["kubectl", "apply", "-f", "-"],
                           input=r.stdout, text=True)
    if apply.returncode != 0:
        sys.exit(apply.returncode)


apply_secret("monitoring")

for ns in ("appflowy", "espocrm", "n8n", "postiz"):
    if subprocess.call(["kubectl", "get", "namespace", ns],
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL) == 0:
        apply_secret(ns)
    else:
        print(f"WARN: namespace {ns} does not exist yet — skipping "
              "(backup CronJob will fail until created)",
              file=sys.stderr)

print("""
✅ done. Verify with:
    kubectl get secret cluster-alerts-kuma -n monitoring -o jsonpath='{.data}' | base64 -d 2>/dev/null
    or wait ~15min for omv-disk-watchdog to fire and check Kuma UI.""")
