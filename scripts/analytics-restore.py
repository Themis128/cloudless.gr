#!/usr/bin/env python3
"""analytics-restore.py — recover OOMKilled or crash-looping analytics
workloads (Metabase and DuckDB API) in the analytics namespace.

Idempotent — safe to re-run. Only patches if the live state needs it.

Env:
  METABASE_MEM_LIMIT (default 1Gi)
  METABASE_JAVA_OPTS (default "-Xmx768m -Xms128m")
  DUCKDB_MEM_LIMIT   (default 1500Mi)
  ANALYTICS_NS       (default analytics)
  KUBECONFIG         (default /etc/rancher/k3s/k3s.yaml)"""

import json
import os
import subprocess
from datetime import datetime, timezone

NS = os.environ.get("ANALYTICS_NS", "analytics")
METABASE_MEM_LIMIT = os.environ.get("METABASE_MEM_LIMIT", "1Gi")
METABASE_JAVA_OPTS = os.environ.get("METABASE_JAVA_OPTS",
                                   "-Xmx768m -Xms128m")
DUCKDB_MEM_LIMIT = os.environ.get("DUCKDB_MEM_LIMIT", "1500Mi")

os.environ.setdefault("KUBECONFIG", "/etc/rancher/k3s/k3s.yaml")


def note(msg: str) -> None:
    print(f"[analytics-restore] {msg}")


def kubectl(*args: str) -> str:
    r = subprocess.run(["kubectl", *args], capture_output=True,
                       text=True)
    return (r.stdout + r.stderr).strip()


def pod_field(app: str, field: str, default: str = "") -> str:
    r = subprocess.run(
        ["kubectl", "-n", NS, "get", "pods", "-l", f"app={app}", "-o",
         f"jsonpath={{.items[0].status.containerStatuses[0].{field}}}"],
        capture_output=True, text=True)
    return r.stdout.strip() or default


def deploy_field(dep: str, path: str, default: str = "") -> str:
    r = subprocess.run(
        ["kubectl", "-n", NS, "get", "deploy", dep, "-o",
         f"jsonpath={{{path}}}"], capture_output=True, text=True)
    return r.stdout.strip() or default


def live_limit(dep: str) -> str:
    return deploy_field(
        dep,
        ".spec.template.spec.containers[0].resources.limits.memory",
        "unknown")


def ready(dep: str) -> str:
    return deploy_field(dep, ".status.readyReplicas", "0")


note(f"=== analytics-restore {datetime.now(timezone.utc):%F %T}Z ===")

# ── Metabase ──
mb_restarts = pod_field("metabase", "restartCount", "0")
mb_exit = pod_field("metabase", "lastState.terminated.reason")
mb_limit = live_limit("metabase")

note(f"Metabase: restarts={mb_restarts} lastExit={mb_exit or 'none'} "
     f"liveLimit={mb_limit}")

mb_n = int(mb_restarts) if mb_restarts.isdigit() else 0
if (mb_exit == "OOMKilled" or mb_n > 3
        or mb_limit in ("400Mi", "600Mi", "unknown")):
    note(f"Metabase needs recovery (OOMKilled or limit≤600Mi) → "
         f"patching to {METABASE_MEM_LIMIT}")
    patch = json.dumps({"spec": {"template": {"spec": {"containers": [{
        "name": "metabase",
        "resources": {"requests": {"memory": "256Mi", "cpu": "100m"},
                      "limits": {"memory": METABASE_MEM_LIMIT,
                                 "cpu": "1"}},
        "env": [{"name": "JAVA_OPTS", "value": METABASE_JAVA_OPTS},
                {"name": "MB_JETTY_MAXTHREADS", "value": "20"}]}]}}}})
    r = subprocess.run(
        ["kubectl", "-n", NS, "patch", "deploy", "metabase",
         "--type=strategic", "-p", patch], capture_output=True)
    note(f"  patched Metabase → {METABASE_MEM_LIMIT} / "
         f"{METABASE_JAVA_OPTS}" if r.returncode == 0
         else "  WARNING: patch failed")
    subprocess.run(["kubectl", "-n", NS, "rollout", "restart",
                    "deploy/metabase"], capture_output=True)
    note("  waiting for Metabase rollout (up to 3 min)...")
    subprocess.run(["kubectl", "-n", NS, "rollout", "status",
                    "deploy/metabase", "--timeout=180s"],
                   capture_output=True)
    note(f"  after rollout: limit={live_limit('metabase')} "
         f"ready={ready('metabase')}")
else:
    note("Metabase OK — no recovery needed")

# ── DuckDB API ──
db_restarts = pod_field("duckdb-api", "restartCount", "0")
db_exit = pod_field("duckdb-api", "lastState.terminated.reason")
db_limit = live_limit("duckdb-api")

note(f"DuckDB API: restarts={db_restarts} "
     f"lastExit={db_exit or 'none'} liveLimit={db_limit}")

n_restarts = int(db_restarts) if db_restarts.isdigit() else 0
if db_exit == "OOMKilled" or n_restarts > 5:
    note(f"DuckDB API OOMKilled → restarting (limit already "
         f"{db_limit})")
    subprocess.run(["kubectl", "-n", NS, "rollout", "restart",
                    "deploy/duckdb-api"], capture_output=True)
    note("  waiting for DuckDB API rollout (up to 2 min)...")
    subprocess.run(["kubectl", "-n", NS, "rollout", "status",
                    "deploy/duckdb-api", "--timeout=120s"],
                   capture_output=True)
    note(f"  after rollout: ready={ready('duckdb-api')}")
else:
    note("DuckDB API OK — no recovery needed")

note("\n=== Final state ===")
print(kubectl("-n", NS, "get", "pods", "-o", "wide"))
note("\n=== DONE ===")
