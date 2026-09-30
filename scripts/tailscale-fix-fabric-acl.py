#!/usr/bin/env python3
"""Fix fabric ACL tagOwners + approve Connector subnet routes.

Adds tag:k8s-operator / tag:k8s ownership, autoApprovers for k8s pod +
service CIDRs and svc:*, then approves 10.42.0.0/16 + 10.43.0.0/16 on
every k3s-subnet-router device.

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET

print("== GET ACL ==")
code, acl, hdrs = ts_api.call("GET", f"tailnet/{T}/acl")
etag = next((v for k, v in hdrs.items() if k.lower() == "etag"), "")
print(f"ETag={etag}")
print(json.dumps({k: acl.get(k) for k in ("tagOwners", "autoApprovers")}, indent=2))

print("== Fix tagOwners ==")
owners = acl.setdefault("tagOwners", {})
for tag, add in (("tag:k8s-operator", "autogroup:admin"), ("tag:k8s", "tag:k8s-operator")):
    owners[tag] = list(dict.fromkeys((owners.get(tag) or []) + [add]))
aa = acl.setdefault("autoApprovers", {})
routes = aa.setdefault("routes", {})
for cidr in ("10.42.0.0/16", "10.43.0.0/16"):
    routes[cidr] = list(dict.fromkeys((routes.get(cidr) or []) + ["tag:k8s"]))
svcs = aa.setdefault("services", {})
for key in ("svc:*", "tag:k8s"):
    svcs[key] = list(dict.fromkeys((svcs.get(key) or []) + ["tag:k8s"]))
print("tagOwners", json.dumps(owners))
print("autoApprovers", json.dumps(aa))

headers = {"If-Match": etag} if etag else {}
code, resp, _ = ts_api.call("POST", f"tailnet/{T}/acl", acl, headers=headers)
print(f"POST ACL HTTP {code}")
print(
    json.dumps({k: resp.get(k) for k in ("tagOwners", "autoApprovers")}, indent=2)
    if resp
    else "(empty)"
)
if code != 200:
    sys.exit(1)

print("== Approve subnet routes on k3s-subnet-router-* ==")
devices = ts_api.get(f"tailnet/{T}/devices").get("devices") or []
for d in devices:
    host = d.get("hostname", "")
    if not host.split(".")[0].startswith("k3s-subnet-router"):
        continue
    print(json.dumps([d["id"], host, d.get("enabledRoutes"), d.get("advertisedRoutes")]))
for d in devices:
    host = d.get("hostname", "")
    if not host.split(".")[0].startswith("k3s-subnet-router"):
        continue
    print(f"Approving routes on {host} ({d['id']})")
    _, resp, _ = ts_api.call(
        "POST", f"device/{d['id']}/routes", {"routes": ["10.42.0.0/16", "10.43.0.0/16"]}
    )
    print(json.dumps(resp, indent=2))

print("== Done ==")
