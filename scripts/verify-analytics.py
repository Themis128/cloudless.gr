#!/usr/bin/env python3
"""Verification script for analytics stack deployment — run after
each phase of the ANALYTICS-IMPLEMENTATION-STRATEGY.md."""

import re
import subprocess
import sys
from pathlib import Path

print("=== Analytics Stack Verification ===\n")


def kube(*args: str) -> str:
    r = subprocess.run(["kubectl", *args], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""


print("🔍 Checking AppFlowy deployment...")
if not kube("get", "namespace", "appflowy"):
    sys.exit("❌ Namespace appflowy not found")
pods = kube("get", "pods", "-n", "appflowy")
if not re.search(
    r"(postgres|redis|gotrue|appflowy-cloud|"
    r"appflowy-web|admin-frontend|nginx|worker)",
    pods,
):
    print("❌ Some AppFlowy pods missing")
else:
    print("✅ AppFlowy pods present")

print("🔍 Checking n8n deployment...")
if not kube("get", "namespace", "n8n"):
    sys.exit("❌ Namespace n8n not found")
if not re.search(r"n8n", kube("get", "pods", "-n", "n8n")):
    print("❌ n8n pods missing")
else:
    print("✅ n8n pods present")

print("🔍 Checking EspoCRM deployment...")
if not kube("get", "namespace", "espocrm"):
    print("❌ Namespace espocrm not found (will be created in Phase 3)")
print("ℹ️  EspoCRM: Phase 3 target")

print("🔍 Checking analytics stack...")
print("ℹ️  DuckDB/Metabase: Phase 4 target")

print("\n📊 Current Resource Usage:")
top = kube("top", "nodes")
print(top if top else "⚠️  Metrics server not available (run kubectl top nodes manually)")

print("\n💾 Storage Allocation:")
for ns, pvc, label in (
    ("appflowy", "appflowy-minio", "AppFlowy MinIO"),
    ("appflowy", "appflowy-postgres", "AppFlowy Postgres"),
):
    out = kube("get", "pvc", "-n", ns, pvc)
    size = out.splitlines()[1].split()[3] if len(out.splitlines()) > 1 else "pending"
    print(f"  {label}: {size}")

print("\n🔗 Cloudflare Bindings Check:")
cfg = Path("wrangler-cloudflare-free.json")
text = cfg.read_text() if cfg.is_file() else ""
print(
    f"  wrangler whoami should show account: "
    f"{'✅' if 'fb7dc7b69b662480cd5961a4d1913c78' in text else '❓'}"
)
print(
    f"  Analytics binding: {'✅ Configured' if '"binding": "ANALYTICS"' in text else '❌ Missing'}"
)
print(f"  D1 binding: {'✅ Configured' if '"binding": "AUTH_DB"' in text else '❌ Missing'}")
n_buckets = len(re.findall(r'"binding": ".*_BUCKET"', text))
print(f"  R2 buckets: {n_buckets} configured")

print("\n=== Verification Complete ===")
