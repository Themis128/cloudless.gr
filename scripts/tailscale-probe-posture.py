#!/usr/bin/env python3
"""Tailscale posture probe — settings, ACL nodeAttrs/postures, and
tagged-device overview. FIX_ATTESTATION=1 strips hardware-attestation
nodeAttrs (container-friendly fabric).

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*)."""

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET

print("== settings ==")
print(json.dumps(ts_api.get(f"tailnet/{T}/settings"), indent=2))

code, acl, hdrs = ts_api.call("GET", f"tailnet/{T}/acl")
print("== nodeAttrs / postures / ssh (keys) ==")
print(json.dumps(list(acl.keys()), indent=2))
print("== nodeAttrs ==")
print(json.dumps(acl.get("nodeAttrs"), indent=2))
print("== postures ==")
print(json.dumps(acl.get("postures"), indent=2))
print("== raw grep attestation ==")
raw = json.dumps(acl)
for line in raw.replace(",", "\n").splitlines():
    if re.search(r"attest|posture|tpm|hardware", line, re.I):
        print(f"  {line.strip()}")

print("== tagged devices ==")
for d in ts_api.get(f"tailnet/{T}/devices").get("devices") or []:
    host = d.get("hostname", "")
    if re.search(
        r"kube-0|ingress-0|operator|subnet-router|github-omv|"
        r"omv-ha|office",
        host,
    ):
        print(
            "\t".join(
                [host, ",".join(d.get("tags") or []), d.get("clientVersion", ""), d.get("os", "")]
            )
        )

if os.environ.get("FIX_ATTESTATION", "0").lower() in ("1", "true"):
    print("== FIX: strip hardwareAttestation from nodeAttrs ==")
    attrs = acl.get("nodeAttrs") or []
    new = []
    for a in attrs:
        attr = a.get("attr") or []
        if any(
            x in ("hardwareAttestation", "hardware-attestation", "tpm")
            or "attest" in str(x).lower()
            for x in attr
        ):
            print("removing nodeAttr", json.dumps(a))
            continue
        new.append(a)
    acl["nodeAttrs"] = new
    print(f"nodeAttrs count {len(attrs)} -> {len(new)}")

    etag = next((v for k, v in hdrs.items() if k.lower() == "etag"), "")
    headers = {"If-Match": etag} if etag else {}
    code, resp, _ = ts_api.call("POST", f"tailnet/{T}/acl", acl, headers=headers)
    print(f"POST ACL HTTP {code}")
    print(json.dumps(resp.get("nodeAttrs"), indent=2))
    if code != 200:
        sys.exit(1)
