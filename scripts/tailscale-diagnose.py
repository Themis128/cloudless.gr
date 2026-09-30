#!/usr/bin/env python3
"""Tailscale Diagnose and Recovery Script — k3s cluster diagnostics.
Run on the Pi nodes or anywhere kubectl reaches the cluster."""

import base64
import shutil
import subprocess
import urllib.request

print("🔍 Tailscale Diagnostics Script")
print("=================================\n")

has_kubectl = shutil.which("kubectl") is not None
print("Running in kubernetes mode" if has_kubectl
      else "Running in direct Pi mode")
print()


def kubectl(*args: str) -> str:
    if not has_kubectl:
        return "(kubectl unavailable)"
    r = subprocess.run(["kubectl", *args], capture_output=True,
                       text=True, timeout=30)
    return (r.stdout + r.stderr).strip()


print("=== 1. Check Tailscale Operator Status ===")
print(kubectl("get", "pods", "-n", "tailscale-operator", "-o", "wide")
      if has_kubectl else "Run on Pi to check operator status")

print("\n=== 2. Check ProxyGroup Status ===")
print(kubectl("get", "ProxyGroup", "-n", "tailscale-operator", "-o",
              "yaml") or "ProxyGroup CRD not found")

print("\n=== 3. Check Tailscale Ingress Status ===")
ingress = kubectl("get", "ingress", "-A", "-o", "wide")
lines = [ln for ln in ingress.splitlines()
         if "tailscale" in ln or "ts.cloudless" in ln or "NAME" in ln]
print("\n".join(lines) if lines else "No Tailscale ingresses found")

print("\n=== 4. Check Tailscale Logs ===")
print(kubectl("logs", "-n", "tailscale-operator", "-l",
              "app.kubernetes.io/name=tailscale-operator",
              "--tail=50") or "Could not get operator logs")

print("\n=== 5. Check Tailscale Node Connectivity ===")
ts_ips = kubectl("get", "pods", "-n", "tailscale-operator", "-o",
                 "jsonpath={.items[*].status.podIPs[*].ip}").strip()
print(f"Tailscale pod IPs: {ts_ips}" if ts_ips
      else "No Tailscale IPs found")

print("\n=== 6. Verify Tailscale Auth Status ===")
b64 = kubectl("get", "secret", "tailscale-operator-secrets", "-n",
              "tailscale-operator", "-o",
              "jsonpath={.data.TS_CLIENT_ID}").strip()
if b64:
    try:
        print(base64.b64decode(b64).decode())
    except Exception:
        print("TS_CLIENT_ID not decodable")
else:
    print("TS_CLIENT_ID not found in secret")

print("\n=== 7. Check Tailscale Node Reachability ===")
print("Testing connectivity to known Tailscale nodes...")
try:
    code = urllib.request.urlopen(
        "https://grafana.ts.cloudless.gr/api/health",
        timeout=10).status
    print(f" - grafana.ts.cloudless.gr reachable (HTTP {code})")
except Exception:
    print(" - grafana.ts.cloudless.gr not reachable")

print("\n=== 8. Check Tailscale Funnel Status ===")
print(kubectl("get", "tailscaleFunnel", "-A")
      or "Tailscale Funnel CRD not found or no resources")

print("\n=== 9. Route Advertisement Check ===")
print("Subnet router routes (check admin panel to confirm approval):")
print(kubectl("get", "ProxyGroup", "k3s-subnet-router", "-n",
              "tailscale-operator", "-o",
              "jsonpath={.status.routes}") or "No routes advertised")

print("""
=== 10. Troubleshooting Commands ===
Run these manually if issues found:

# Restart Tailscale operator:
kubectl rollout restart deployment -n tailscale-operator

# Check Tailscale operator logs:
kubectl logs -n tailscale-operator -l k8s-app=tailscale-operator -f

# Check proxy logs:
kubectl logs -n tailscale-operator -l tailscale=proxy -f

# Force reconcile ProxyGroup:
kubectl delete pod -n tailscale-operator -l tailscale=proxy

# Check Tailscale control plane connectivity:
kubectl exec -n tailscale-operator deploy/tailscale-operator -- wget -qO- http://localhost:8080/healthz


=== Diagnostic Complete ===

If nodes are offline in Tailscale admin:
  1. Check node power status (omv should be at 192.168.1.128)
  2. Verify Tailscale service is running on the node
  3. Check firewall rules for port 41641 (Tailscale)
  4. Approve route advertisements in Tailscale admin console""")
