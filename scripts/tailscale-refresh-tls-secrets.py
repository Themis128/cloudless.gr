#!/usr/bin/env python3
"""After enabling HTTPS Certificates in the Tailscale admin DNS UI,
delete empty operator-managed TLS Secrets so Serve / kube-apiserver can
re-provision PEMs.

Env: TS_NAMESPACE (default tailscale), TAILSCALE_TAILNET."""

import os
import shutil
import subprocess
import sys

NS = os.environ.get("TS_NAMESPACE", "tailscale")
TAILNET = os.environ.get("TAILSCALE_TAILNET", "tail4ecae1.ts.net")
HOSTS = ["grafana", "kube", "meilisearch", "loki"]

if not shutil.which("kubectl"):
    print("kubectl required", file=sys.stderr)
    sys.exit(1)

print(f"== Checking TLS Secrets in {NS} ==")
empty = []
for h in HOSTS:
    name = f"{h}.{TAILNET}"
    r = subprocess.run(["kubectl", "get", "secret", name, "-n", NS],
                       capture_output=True)
    if r.returncode != 0:
        print(f"  skip missing {name}")
        continue
    r = subprocess.run(
        ["kubectl", "get", "secret", name, "-n", NS, "-o",
         r"jsonpath={.data.tls\.crt}"],
        capture_output=True, text=True)
    length = len(r.stdout)
    if length < 20:
        print(f"  EMPTY {name} (tls.crt b64 len={length})")
        empty.append(name)
    else:
        print(f"  ok    {name} (tls.crt b64 len={length})")

if not empty:
    print("No empty TLS Secrets to delete.")
    sys.exit(0)

print(f"== Deleting empty Secrets: {' '.join(empty)} ==")
subprocess.run(["kubectl", "delete", "secret", "-n", NS, *empty])
print(f"Done. Watch: kubectl get proxygroup,ingress -A; "
      f"kubectl get secret -n {NS}")
