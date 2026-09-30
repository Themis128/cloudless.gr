#!/usr/bin/env python3
"""prometheus-tune.py — stop PrometheusRuleFailures on the small omv
cluster.

The kube-prometheus-stack apiserver SLO recording rules
(kube-apiserver-burnrate.rules etc.) run multi-day rate() over
high-cardinality series — on a Pi they exceed rule evaluation timeout →
"expanding series: context deadline exceeded" → PrometheusRuleFailures.

These SLO/burnrate rules are for large-scale dashboards this homelab
doesn't use. Deleting the containing PrometheusRule objects is
idempotent and reversible (helm upgrade recreates them; the durable fix
is Helm values kubeApiserverBurnrate/Availability/Slos: false).

Also strips KubeMemoryOvercommit / KubeCPUOvercommit from the
kubernetes-resources group — permanently true on the asymmetric 2-node
cluster (omv 8GiB vs omv-ha ~1GiB), no actionable fix.

Requires kubectl with delete on prometheusrules in PROM_NS.

Usage: python3 scripts/prometheus-tune.py"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

PROM_NS = os.environ.get("PROM_NS", "monitoring")
HEAVY_GROUPS = ["kube-apiserver-burnrate.rules",
                "kube-apiserver-availability.rules",
                "kube-apiserver-slos"]
STRIP_ALERTS = ["KubeMemoryOvercommit", "KubeCPUOvercommit"]


def log(msg: str) -> None:
    print(f"[prom-tune] {msg}")


def kubectl(*args: str, stdin: str = "") -> tuple[int, str]:
    r = subprocess.run(["kubectl", *args], input=stdin,
                       capture_output=True, text=True, timeout=120)
    return r.returncode, r.stdout + r.stderr


if not shutil.which("kubectl"):
    print("error: kubectl not found")
    sys.exit(1)

log(f"whoami: {kubectl('auth', 'whoami')[1].strip()}")

rc, out = kubectl("-n", PROM_NS, "get", "prometheusrule", "-o", "json")
rules = json.loads(out).get("items", []) if rc == 0 else []

deleted = 0
for grp in HEAVY_GROUPS:
    crs = sorted({r["metadata"]["name"] for r in rules
                  if any(g.get("name") == grp
                         for g in (r.get("spec", {})
                                   .get("groups") or []))})
    if not crs:
        log(f"group '{grp}': no PrometheusRule found (already "
            "disabled?)")
        continue
    for cr in crs:
        log(f"deleting PrometheusRule '{cr}' (contains heavy group "
            f"'{grp}')")
        rc, _ = kubectl("-n", PROM_NS, "delete", "prometheusrule", cr,
                        "--ignore-not-found")
        if rc == 0:
            deleted += 1
log(f"deleted {deleted} PrometheusRule object(s).")

# ── Strip intrinsic overcommit alerts ──
res_crs = sorted({
    r["metadata"]["name"] for r in rules
    if any(rule.get("alert") in STRIP_ALERTS
           for g in (r.get("spec", {}).get("groups") or [])
           for rule in (g.get("rules") or []))})

if not res_crs:
    log(f"overcommit: no PrometheusRule contains "
        f"{' '.join(STRIP_ALERTS)} (already stripped?)")
else:
    for cr in res_crs:
        log(f"stripping {' '.join(STRIP_ALERTS)} from PrometheusRule "
            f"'{cr}'")
        rc, out = kubectl("-n", PROM_NS, "get", "prometheusrule", cr,
                          "-o", "json")
        if rc != 0:
            log(f"  WARNING: could not fetch '{cr}'")
            continue
        obj = json.loads(out)
        for g in obj.get("spec", {}).get("groups", []):
            g["rules"] = [r for r in (g.get("rules") or [])
                          if r.get("alert") not in STRIP_ALERTS]
        patch = json.dumps({"spec": {"groups":
                                     obj["spec"]["groups"]}})
        rc, out = kubectl("-n", PROM_NS, "patch", "prometheusrule", cr,
                          "--type=merge", f"--patch={patch}")
        log(f"  {'✓ patched' if rc == 0 else 'WARNING: patch failed'} "
            f"'{cr}'")

# Report remaining failures
time.sleep(20)
log("Remaining rules with health != ok:")
pod = f"promq-{os.getpid()}"
with tempfile.NamedTemporaryFile(mode="w", suffix=".json",
                                 delete=False) as f:
    out_file = f.name
rc = subprocess.call(
    ["kubectl", "-n", PROM_NS, "run", pod,
     "--image=curlimages/curl:8.11.1", "--restart=Never", "--rm", "-i",
     "--quiet", "--command", "--", "curl", "-sS", "--max-time", "12",
     f"http://prometheus-operated.{PROM_NS}.svc:9090/api/v1/rules"],
    stdout=open(out_file, "w"), stderr=subprocess.DEVNULL)
try:
    data = json.load(open(out_file))
    bad = [f"[{g['name']}] {r.get('name')}: "
           f"{r.get('lastError', '')}"
           for g in data.get("data", {}).get("groups", [])
           for r in g.get("rules", [])
           if r.get("health") != "ok" or r.get("lastError")]
    print("\n".join(bad) if bad else "  ✓ all rules healthy")
except Exception:
    log("  (could not re-fetch /api/v1/rules)")
finally:
    os.unlink(out_file)

# ── Bump Prometheus memory limit to 750Mi ──
log("Patching Prometheus StatefulSet memory limit to 750Mi...")
rc, out = kubectl("-n", PROM_NS, "get", "sts", "-l",
                  "app.kubernetes.io/name=prometheus", "-o",
                  "jsonpath={.items[0].metadata.name}")
sts = out.strip()
if sts:
    rc, out = kubectl(
        "-n", PROM_NS, "get", "sts", sts, "-o",
        "jsonpath={.spec.template.spec.containers"
        "[?(@.name==\"prometheus\")].resources.limits.memory}")
    cur = out.strip()
    log(f"  current limit: {cur or 'unknown'}")
    if cur == "750Mi":
        log("  already 750Mi — skipping patch")
    else:
        patch = json.dumps({"spec": {"template": {"spec": {
            "containers": [{"name": "prometheus", "resources": {
                "limits": {"memory": "750Mi"},
                "requests": {"memory": "512Mi"}}}]}}}})
        rc, _ = kubectl("-n", PROM_NS, "patch", "sts", sts,
                        "--type=strategic", f"--patch={patch}")
        log("  patched → 750Mi limit / 512Mi request" if rc == 0
            else "  WARNING: StatefulSet patch failed")
        kubectl("-n", PROM_NS, "rollout", "status", f"sts/{sts}",
                "--timeout=3m")
        rc, out = kubectl(
            "-n", PROM_NS, "get", "sts", sts, "-o",
            "jsonpath={.spec.template.spec.containers"
            "[?(@.name==\"prometheus\")].resources.limits.memory}")
        log(f"  confirmed new limit: {out.strip() or 'unknown'}")
else:
    log("  WARNING: no Prometheus StatefulSet found (label "
        "app.kubernetes.io/name=prometheus)")
