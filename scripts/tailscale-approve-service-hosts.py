#!/usr/bin/env python3
"""Sync Tailscale Services console with the k3s fabric:
  1) Approve all advertised hosts for every svc:*
  2) Delete orphan VIP Services no longer backed by cluster
     Ingress/ProxyGroup

Expected (operator-managed):
  svc:grafana, svc:meilisearch  — Ingress + ProxyGroup/ingress
  svc:kube                      — ProxyGroup/kube-apiserver

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*),
DRY_RUN=1."""

import json
import os
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET
DRY_RUN = os.environ.get("DRY_RUN", "0").lower() in ("1", "true", "yes")

EXPECTED = {"svc:grafana", "svc:meilisearch", "svc:kube"}

print("== List VIP Services ==")
_, svcs, _ = ts_api.call("GET", f"tailnet/{T}/services")
vip = svcs.get("vipServices") or []
for s in vip:
    print("\t".join([s.get("name", ""),
                     ",".join(s.get("addrs") or []),
                     ",".join(map(str, s.get("ports") or [])),
                     ",".join(s.get("tags") or [])]))

print("\n== Approve hosts for every service ==")
for s in vip:
    svc = s.get("name", "")
    if not svc:
        continue
    enc = urllib.parse.quote(svc, safe="")
    code, hosts, _ = ts_api.call(
        "GET", f"tailnet/{T}/services/{enc}/devices")
    print(f"-- {svc} devices HTTP {code}")
    if code != 200:
        continue
    for h in hosts.get("hosts") or []:
        nid = h.get("nodeId")
        print(f"   host {nid} approval={h.get('approvalLevel')} "
              f"configured={h.get('configured')}")
        if DRY_RUN:
            print("   DRY_RUN skip approve")
            continue
        acode, resp, _ = ts_api.call(
            "POST",
            f"tailnet/{T}/services/{enc}/device/{nid}/approved",
            {"approved": True})
        print(f"   POST approved -> {acode} {json.dumps(resp)}")

print(f"\n== Delete orphan services (not in: {' '.join(sorted(EXPECTED))}) ==")
for s in vip:
    svc = s.get("name", "")
    if not svc:
        continue
    if svc in EXPECTED:
        print(f"KEEP  {svc}")
        continue
    enc = urllib.parse.quote(svc, safe="")
    if DRY_RUN:
        print(f"ORPHAN {svc} (would DELETE)")
        continue
    dcode, resp, _ = ts_api.call(
        "DELETE", f"tailnet/{T}/services/{enc}")
    print(f"DELETE {svc} -> {dcode} {json.dumps(resp)[:200]}")

print("\n== Final service list ==")
_, svcs, _ = ts_api.call("GET", f"tailnet/{T}/services")
for s in svcs.get("vipServices") or []:
    print(s.get("name"))
print("== Done ==")
