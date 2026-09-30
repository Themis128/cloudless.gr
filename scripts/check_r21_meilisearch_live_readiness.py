#!/usr/bin/env python3
"""R21J Meilisearch live k3s readiness check — read-only."""

import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

c = Check()
print("== R21J Meilisearch live k3s readiness check ==")
print("Mode: read-only\n")


def kubectl(*args: str) -> tuple[bool, str]:
    r = subprocess.run(["kubectl", *args], capture_output=True, text=True)
    return r.returncode == 0, r.stdout.strip()


if not shutil.which("kubectl"):
    c.missing("kubectl is not installed or not on PATH")
    sys.exit(c.summary() or 1)

c.passed("kubectl is available")

ok, _ = kubectl("version", "--client")
c.expect(ok, "kubectl client is usable", "kubectl client is not usable")

ok, _ = kubectl("cluster-info")
if not ok:
    c.missing("kubectl cannot reach the current cluster")
    sys.exit(c.summary() or 1)
c.passed("kubectl can reach the current cluster")

ok, _ = kubectl("get", "storageclass", "local-path")
c.expect(ok, "local-path storage class exists", "local-path storage class is missing")

ok, nodes = kubectl("get", "nodes", "-o", "name")
c.expect(
    bool(re.search(r"(^|/)omv$|omv-main|OMV-MAIN", nodes, re.M)),
    "OMV node appears in cluster node list",
    "Could not find OMV/OMV-MAIN node in cluster node list",
)

ok, _ = kubectl("get", "namespace", "search")
if ok:
    c.passed("search namespace already exists")
else:
    c.warning("search namespace does not exist yet; manifest will create it")

ok, _ = kubectl("-n", "search", "get", "secret", "meilisearch-master-key")
if ok:
    c.passed("meilisearch-master-key secret exists")
else:
    c.warning("meilisearch-master-key secret is missing; create it before applying deployment")

ok, _ = kubectl("-n", "search", "get", "pvc", "meilisearch-data")
if ok:
    c.passed("meilisearch-data PVC already exists")
    print(kubectl("-n", "search", "get", "pvc", "meilisearch-data")[1])
    _, phase = kubectl(
        "-n", "search", "get", "pvc", "meilisearch-data", "-o", "jsonpath={.status.phase}"
    )
    c.expect(
        phase == "Bound",
        "meilisearch-data PVC is Bound",
        f"meilisearch-data PVC is not Bound: {phase}",
    )
else:
    c.warning("meilisearch-data PVC does not exist yet; manifest will create it")

ok, _ = kubectl(
    "-n", "search", "get", "pod", "-l", "app.kubernetes.io/name=meilisearch", "-o", "wide"
)
if ok:
    c.passed("Meilisearch pod selector is queryable")
    print(
        kubectl(
            "-n", "search", "get", "pod", "-l", "app.kubernetes.io/name=meilisearch", "-o", "wide"
        )[1]
    )
    _, pod_nodes = kubectl(
        "-n",
        "search",
        "get",
        "pod",
        "-l",
        "app.kubernetes.io/name=meilisearch",
        "-o",
        'jsonpath={range .items[*]}{.spec.nodeName}{"\\n"}{end}',
    )
    c.expect(
        bool(re.search(r"^omv$|omv-main|OMV-MAIN", pod_nodes, re.M)),
        "Meilisearch pod is scheduled on OMV node",
        f"Meilisearch pod is not scheduled on OMV node: {pod_nodes}",
    )
else:
    c.warning("No Meilisearch pod found yet")

c.finish()
