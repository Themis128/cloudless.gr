#!/usr/bin/env python3
"""R21a Meilisearch k3s check — namespace/secret/deploy/svc/PVC
presence, replica health, pod node placement, /health probe, and
PV node affinity.

Env: NS (default search), APP (default meilisearch),
EXPECTED_NODE (default omv)."""

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

NS = os.environ.get("NS", "search")
APP = os.environ.get("APP", "meilisearch")
EXPECTED_NODE = os.environ.get("EXPECTED_NODE", "omv")

c = Check()
print("== R21a Meilisearch k3s check ==")
print(f"Namespace: {NS}")
print(f"Expected node: {EXPECTED_NODE}\n")


def kubectl(*args: str) -> str:
    r = subprocess.run(["kubectl", "-n", NS, *args],
                       capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def kubectl_ok(*args: str) -> bool:
    return subprocess.call(
        ["kubectl", "-n", NS, *args],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL) == 0


c.expect(subprocess.call(["kubectl", "get", "ns", NS],
                         stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL) == 0,
         "namespace exists", f"namespace {NS} missing")
c.expect(kubectl_ok("get", "secret",
                    "meilisearch-master-key"),
         "master key secret exists",
         "secret meilisearch-master-key missing")
c.expect(kubectl_ok("get", "deploy", APP),
         "deployment exists", f"deployment {APP} missing")
c.expect(kubectl_ok("get", "svc", APP),
         "service exists", f"service {APP} missing")
c.expect(kubectl_ok("get", "pvc", "meilisearch-data"),
         "PVC exists", "PVC meilisearch-data missing")

phase = kubectl("get", "pvc", "meilisearch-data",
                "-o", "jsonpath={.status.phase}")
c.expect(phase == "Bound", "PVC is Bound",
         f"PVC phase is {phase or 'unknown'}, expected Bound")

ready = kubectl("get", "deploy", APP, "-o",
                "jsonpath={.status.readyReplicas}")
c.expect(ready == "1", "deployment has 1 ready replica",
         f"deployment readyReplicas is {ready or 0}, "
         "expected 1")

pods = kubectl("get", "pod",
               "-l", "app.kubernetes.io/name=meilisearch",
               "--no-headers")
pod_count = len(pods.splitlines()) if pods else 0
if pod_count == 1:
    c.passed("exactly one Meilisearch pod exists")
else:
    c.warning(f"{pod_count} Meilisearch pods exist; rollout "
              "may still be settling")

pod = kubectl("get", "pod",
              "-l", "app.kubernetes.io/name=meilisearch",
              "-o", "jsonpath={.items[0].metadata.name}")
node = ""
if pod:
    node = kubectl("get", "pod", pod,
                   "-o", "jsonpath={.spec.nodeName}")
if node == EXPECTED_NODE:
    c.passed(f"pod is scheduled on OMV-MAIN / {EXPECTED_NODE}")
elif node:
    c.missing(f"pod is scheduled on {node}, expected "
              f"OMV-MAIN / {EXPECTED_NODE}")
else:
    c.missing("could not determine Meilisearch pod node")

if pod:
    r = subprocess.run(
        ["kubectl", "-n", NS, "exec", pod, "--", "wget",
         "-qO-", "http://127.0.0.1:7700/health"],
        capture_output=True, text=True)
    health = r.stdout.strip()
    c.expect('"status":"available"' in health,
             "health endpoint reports available",
             "health endpoint did not report available: "
             f"{health}")
else:
    c.missing("no Meilisearch pod found")

pv = kubectl("get", "pvc", "meilisearch-data",
             "-o", "jsonpath={.spec.volumeName}")
if pv:
    r = subprocess.run(["kubectl", "get", "pv", pv, "-o",
                        "yaml"], capture_output=True, text=True)
    # show nodeAffinity block only
    lines = r.stdout.splitlines()
    aff = []
    for i, ln in enumerate(lines):
        if "nodeAffinity" in ln:
            aff = lines[i:i + 13]
            break
    aff_text = "\n".join(aff)
    c.expect(EXPECTED_NODE in aff_text,
             f"PV node affinity includes {EXPECTED_NODE}",
             "could not confirm PV node affinity includes "
             f"{EXPECTED_NODE}", kind="warn")
else:
    c.warning("could not determine PV name from PVC")

c.finish()
