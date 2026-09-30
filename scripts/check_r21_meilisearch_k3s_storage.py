#!/usr/bin/env python3
"""R21I Meilisearch k3s storage check — validates the manifest
defines/uses a PVC pinned to the dedicated OMV-MAIN SSD.

Usage: python3 scripts/check_r21_meilisearch_k3s_storage.py \
    [manifest]   (default k8s/search/meilisearch.yaml)"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

manifest = Path(sys.argv[1] if len(sys.argv) > 1 else "k8s/search/meilisearch.yaml")

c = Check()
print("== R21I Meilisearch k3s storage check ==")
print(f"Manifest: {manifest}\n")

if not c.expect(
    c.exists(manifest), "Meilisearch manifest exists", f"Meilisearch manifest missing: {manifest}"
):
    c.finish()

c.expect(
    c.contains_re(
        manifest,
        r"kind:\s*PersistentVolumeClaim|persistentVolumeClaim"
        r"|claimName:",
    ),
    "Manifest defines or uses persistent volume claim",
    "Manifest does not define/use a PVC",
)
c.expect(
    c.contains_re(manifest, r"meili|meilisearch"),
    "Manifest references Meilisearch",
    "Manifest does not reference Meilisearch",
)
c.expect(
    c.contains_re(manifest, r"/meili_data|MEILI_DB_PATH|data\.ms|/data"),
    "Manifest references Meilisearch data path",
    "Could not confirm Meilisearch data path",
    kind="warn",
)
c.expect(
    c.contains(manifest, "cloudless.gr/storage-node: OMV-MAIN"),
    "Manifest labels storage node as OMV-MAIN",
    "Manifest missing cloudless.gr/storage-node: OMV-MAIN",
)
c.expect(
    c.contains(manifest, "cloudless.gr/storage-tier: dedicated-ssd"),
    "Manifest labels storage tier as dedicated SSD",
    "Manifest missing dedicated SSD storage label",
)
c.expect(
    c.contains(manifest, "dedicated 120GB SSD on OMV-MAIN"),
    "Manifest documents the 120GB SSD storage requirement",
    "Manifest missing 120GB SSD storage annotation",
)
c.expect(
    c.contains_re(manifest, r"nodeSelector|nodeAffinity|affinity|kubernetes.io/hostname"),
    "Manifest constrains storage/workload placement",
    "No node placement constraint found",
    kind="warn",
)

if c.contains_re(manifest, r"emptyDir:"):
    c.missing("Manifest uses emptyDir for Meilisearch data")
else:
    c.passed("Manifest does not use emptyDir for Meilisearch data")

c.finish()
