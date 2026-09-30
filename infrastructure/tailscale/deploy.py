#!/usr/bin/env python3
"""Deploy Tailscale Kubernetes Operator + fabric interconnect (free tier).

Port of deploy.sh.
Docs: docs/TAILSCALE-FABRIC.md
Official: https://tailscale.com/docs/kubernetes-operator/install-operator

Usage: TS_CLIENT_ID=... TS_CLIENT_SECRET=... python3 deploy.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NS = os.environ.get("TS_OPERATOR_NS", "tailscale")


def need(cmd: str) -> None:
    if not shutil.which(cmd):
        print(f"missing {cmd}", file=sys.stderr)
        sys.exit(1)


def run(*args: str) -> subprocess.CompletedProcess[str]:
    r = subprocess.run(list(args), capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print((r.stderr or r.stdout), file=sys.stderr)
        sys.exit(1)
    if r.stdout:
        print(r.stdout, end="")
    return r


need("kubectl")
need("helm")

CLIENT_ID = os.environ.get("TS_CLIENT_ID") or os.environ.get("TAILSCALE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("TS_CLIENT_SECRET") or os.environ.get("TAILSCALE_CLIENT_SECRET", "")
if not CLIENT_ID or not CLIENT_SECRET:
    print("Set TS_CLIENT_ID and TS_CLIENT_SECRET (OAuth client tagged tag:k8s-operator).")
    print("Create at: https://login.tailscale.com/admin/settings/oauth")
    print("Scopes: Devices Core write, Auth Keys write. Tags: tag:k8s-operator")
    sys.exit(2)

print("==> Helm repo")
run("helm", "repo", "add", "tailscale", "https://pkgs.tailscale.com/helmcharts")
run("helm", "repo", "update", "tailscale")

print(f"==> Install/upgrade operator (ns={NS})")
run(
    "helm",
    "upgrade",
    "--install",
    "tailscale-operator",
    "tailscale/tailscale-operator",
    "--namespace",
    NS,
    "--create-namespace",
    "--set-string",
    f"oauth.clientId={CLIENT_ID}",
    "--set-string",
    f"oauth.clientSecret={CLIENT_SECRET}",
    "--set",
    "operatorConfig.defaultTags={tag:k8s-operator}",
    "--set-string",
    "proxyConfig.defaultTags=tag:k8s",
    "--set-string",
    "apiServerProxyConfig.allowImpersonation=true",
    "--wait",
)

print("==> IngressClass (skip if Helm already created it)")
r = subprocess.run(
    ["kubectl", "get", "ingressclass", "tailscale"], capture_output=True, check=False
)
if r.returncode != 0:
    run("kubectl", "apply", "-f", str(ROOT / "infrastructure/tailscale/ingress-class.yaml"))
else:
    print("    IngressClass tailscale already exists — leaving controller field alone")

print("==> Connector/ProxyClass + ProxyGroups")
run("kubectl", "apply", "-f", str(ROOT / "infrastructure/tailscale/connector.yaml"))

print("==> ProxyGroups (ingress + kube-apiserver)")
run("kubectl", "apply", "-f", str(ROOT / "infrastructure/tailscale/proxygroup.yaml"))

print("==> Ingresses (Grafana / Loki / Meili → shared ProxyGroup)")
run("kubectl", "apply", "-f", str(ROOT / "infrastructure/tailscale/ingresses.yaml"))

print("==> RBAC for Tailscale kubeconfig (impersonated logins)")
run("kubectl", "apply", "-f", str(ROOT / "infrastructure/tailscale/rbac-kubeconfig.yaml"))

print("\n==> Status")
subprocess.run(["kubectl", "get", "connector,proxygroup,proxyclass", "-A"], check=False)
run("kubectl", "get", "pods", "-n", NS)

print("""
Next:
  1. Merge infrastructure/tailscale/acl-policy.example.json into Access controls
  2. Delete stale Machines (monitoring-proxies-*, old app proxies) in admin UI
  3. Approve subnet routes if autoApprovers not live yet
  4. kubectl wait connector k3s-cidrs --for=condition=ConnectorReady=true --timeout=5m
  5. kubectl wait proxygroup kube --for=condition=ProxyGroupReady=true --timeout=5m
  6. tailscale configure kubeconfig $(kubectl get proxygroup kube -o jsonpath='{.status.url}')
  7. Add k3s tls-san for Tailscale IP (see docs/TAILSCALE-FABRIC.md) if dialing :6443 directly""")
