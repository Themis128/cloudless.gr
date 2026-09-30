#!/usr/bin/env python3
"""Tailscale services discovery — ACL autoApprovers.services plus probes
of the (undocumented) service endpoints and per-device service fields.

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*)."""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET

print("== ACL autoApprovers.services ==")
acl = ts_api.get(f"tailnet/{T}/acl")
print(json.dumps((acl.get("autoApprovers") or {}).get("services"),
                 indent=2))

print("== probe service endpoints ==")
for path in (f"tailnet/{T}/services", f"tailnet/{T}/vip-services",
             "tailnet/-/services", "tailnet/-/vip-services"):
    code, resp, _ = ts_api.call("GET", path)
    preview = json.dumps(resp)[:300].replace("\n", " ")
    print(f"GET {path} -> {code} {preview}\n")

print("== ingress-0 / kube-0 device JSON keys ==")
devices = ts_api.get(f"tailnet/{T}/devices").get("devices") or []
for d in devices:
    if not re.search(r"ingress-0|kube-0", d.get("hostname", "")):
        continue
    did, host = d["id"], d["hostname"]
    print(f"-- {host} {did}")
    code, detail, _ = ts_api.call("GET", f"device/{did}")
    print(json.dumps(list(detail.keys()), indent=2))
    print(json.dumps({k: detail.get(k) for k in (
        "hostname", "tags", "addresses", "clientConnectivity",
        "advertisedRoutes", "enabledRoutes",
        "blocksIncomingConnections")}, indent=2))
    for sub in ("routes", "services", "vip-services",
                "approved-routes"):
        code, resp, _ = ts_api.call("GET", f"device/{did}/{sub}")
        print(f"  GET device/{did}/{sub} -> {code} "
              f"{json.dumps(resp)[:200]}")
        print()
