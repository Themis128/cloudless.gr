#!/usr/bin/env python3
"""Replace Grafana dashboards with the slim cluster-health set.

Port of apply.sh.

1. Inventory all current dashboards
2. Delete only those whose panels reference metrics that disappeared
   after `prometheus-slim.yaml` was applied (i.e. non-cluster-health
   metrics that no longer scrape)
3. Import the 3 new dashboards in this directory

Requires:
  GRAFANA_URL (default http://grafana.cloudless.gr)
  GRAFANA_API_TOKEN (from the k8s grafana-admin secret — AWS SSM retired)

Idempotent — re-running this updates dashboards in place via uid.

Usage: python3 k8s/grafana-dashboards/apply.py
"""

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

os.chdir(Path(__file__).resolve().parent)

GRAFANA_URL = os.environ.get("GRAFANA_URL", "http://grafana.cloudless.gr")
GRAFANA_API_TOKEN = os.environ.get("GRAFANA_API_TOKEN", "")

if not GRAFANA_API_TOKEN:
    print("❌ GRAFANA_API_TOKEN not set.")
    print(f"   Create one at {GRAFANA_URL}/org/apikeys (role: Editor or Admin)")
    print("   then export GRAFANA_API_TOKEN=<token>")
    print("   Or pull from k3s: kubectl -n monitoring get secret kube-prom-grafana -o jsonpath='{.data.admin-password}' | base64 -d")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {GRAFANA_API_TOKEN}",
    "Content-Type": "application/json",
}


def api(method: str, path: str, body: bytes | None = None) -> str:
    req = urllib.request.Request(
        f"{GRAFANA_URL}{path}", data=body, headers=HEADERS, method=method
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def api_json(method: str, path: str, payload: object | None = None) -> object:
    body = json.dumps(payload).encode() if payload is not None else None
    return json.loads(api(method, path, body))


# Datasource lookup
ds = api_json("GET", "/api/datasources/name/Prometheus")
DS_UID = ds.get("uid") if isinstance(ds, dict) else None
if not DS_UID:
    print("❌ Could not find Prometheus datasource. Check /api/datasources", file=sys.stderr)
    sys.exit(1)
print(f"✓ Prometheus datasource uid: {DS_UID}")

# ─── Step 1: Inventory current dashboards ────────────────────────────────────
print("\n── Step 1/3: Inventory dashboards ──")
search = api_json("GET", "/api/search?type=dash-db")
dashboards = [(d["uid"], d["title"]) for d in search] if isinstance(search, list) else []
print(f"  {len(dashboards)} dashboards currently in Grafana")

# ─── Step 2: Delete orphaned dashboards ──────────────────────────────────────
print("\n── Step 2/3: Delete dashboards that reference dropped metrics ──")
# Metrics that survive Prometheus slim: node_*, kube_*, kubelet_*, apiserver_*,
# coredns_*, prometheus_*, up, scrape_*. Everything else is orphaned.
ORPHAN_PATTERNS = (
    "loki_|grafana_|n8n_|traefik_|duckdb_|metabase_|cloudless_app_"
    "|oncall_|home_assistant_|mosquitto_|alert_api_"
)
ORPHAN_RX = re.compile(r'"expr":\s*"[^"]*(' + ORPHAN_PATTERNS + ")")
KEEP_UIDS = {"cluster-overview-2026", "pod-health-2026", "per-node-detail-2026"}

for uid, title in dashboards:
    if uid in KEEP_UIDS:
        continue
    try:
        body = api("GET", f"/api/dashboards/uid/{uid}")
    except Exception:
        continue
    if ORPHAN_RX.search(body):
        print(f"  ✗ deleting: {title} ({uid})")
        api("DELETE", f"/api/dashboards/uid/{uid}")


def inject_datasource(node: object) -> object:
    """Walk the dashboard JSON replacing any datasource ref with the real uid."""
    if isinstance(node, dict):
        if "datasource" in node:
            node["datasource"] = {"type": "prometheus", "uid": DS_UID}
        for value in node.values():
            inject_datasource(value)
    elif isinstance(node, list):
        for item in node:
            inject_datasource(item)
    return node


# ─── Step 3: Import new dashboards ───────────────────────────────────────────
print("\n── Step 3/3: Import the 3 new cluster-health dashboards ──")
for filename in ("cluster-overview.json", "pod-health.json", "per-node-detail.json"):
    dash = json.loads(Path(filename).read_text())
    inject_datasource(dash)
    result = api_json(
        "POST",
        "/api/dashboards/db",
        {"dashboard": dash, "overwrite": True, "folderUid": ""},
    )
    if isinstance(result, dict):
        print(f"  ✓ {result.get('status')}: {result.get('url')}")

print("\n✓ Done. Final state:")
final = api_json("GET", "/api/search?type=dash-db")
for d in final if isinstance(final, list) else []:
    print(f"  - {d.get('title')} ({d.get('uid')})")
