#!/usr/bin/env python3
"""Tag every Tailscale device according to the cloudless fabric taxonomy.

Tags (must exist in infrastructure/tailscale/acl-policy.example.json):
  tag:pi            — physical Pi hosts (SSH / deploy)
  tag:k8s           — k3s fabric proxies (ingress, kube-apiserver,
                      subnet routers)
  tag:k8s-operator  — Tailscale Kubernetes operator
  tag:app-connector — Tailscale Apps connectors (SaaS DNS breakout)

User workstations (office*) stay UNTAGGED so autogroup:self / member
identity applies.

Usage:
  python3 scripts/tailscale-retag-fleet.py            # apply
  DRY_RUN=1 python3 scripts/tailscale-retag-fleet.py  # print plan only
  LIST_ONLY=1 python3 scripts/tailscale-retag-fleet.py

Auth: TS_API_KEY OR TS_CLIENT_ID + TS_CLIENT_SECRET (OAuth)."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET
DRY_RUN = os.environ.get("DRY_RUN", "0").lower() in ("1", "true", "yes")
LIST_ONLY = os.environ.get("LIST_ONLY", "0").lower() in (
    "1", "true", "yes")

print(f"==> Devices on {T}")
devices = ts_api.get(f"tailnet/{T}/devices").get("devices") or []


def short_name(d):
    return (d.get("name") or d.get("hostname") or "").split(".")[0]


def desired_tags(short: str):
    """Return list of tags, None to leave unchanged, [] to clear."""
    s = short.lower()

    # User / operator workstations — must stay untagged
    if s in {"office", "office-1", "office-2", "office-3"} or \
            s.startswith("office-"):
        return []

    # Physical Pis
    if s in {"github-omv", "omv", "omv-main"}:
        # github-omv historically ran Apps connector; keep both so SaaS
        # DNS breakout and classic SSH grants (tag:pi) both work.
        return ["tag:pi", "tag:app-connector"]
    if s in {"omv-ha", "omv-2"}:
        return ["tag:pi"]

    # Tailscale Kubernetes operator
    if s.startswith("tailscale-operator") or \
            s == "cloudless-k3s-operator":
        return ["tag:k8s-operator"]

    # Fabric: ingress / kube-apiserver ProxyGroups + Connector subnet
    # routers
    if (s.startswith("ingress-") or s.startswith("kube-")
            or s.startswith("k3s-subnet-router")
            or s.startswith("k3s-cidrs-")
            or s.startswith("ts-k3s-cidrs")
            or s.startswith("monitoring-prox")):
        return ["tag:k8s"]

    # Fly / dedicated Apps connector VMs
    if s.startswith("cloudless-fly-proxy") or \
            s.startswith("app-connector"):
        return ["tag:app-connector"]

    # Unknown — report, do not change
    return None


print(f"{'hostname':32} {'current':40} {'desired':40} action")
print("-" * 120)

changes = 0
unknown = []
for d in sorted(devices, key=lambda x: short_name(x).lower()):
    short = short_name(d)
    cur = list(d.get("tags") or [])
    want = desired_tags(short)
    cur_s = ",".join(cur) if cur else "(none)"
    if want is None:
        print(f"{short:32} {cur_s:40} {'(unknown — skip)':40} SKIP")
        unknown.append(short)
        continue
    want_s = ",".join(want) if want else "(none/clear)"
    if set(cur) == set(want):
        print(f"{short:32} {cur_s:40} {want_s:40} OK")
        continue
    action = "CLEAR" if want == [] else "SET"
    print(f"{short:32} {cur_s:40} {want_s:40} {action}")
    changes += 1
    if LIST_ONLY or DRY_RUN:
        continue
    code, resp, _ = ts_api.call("POST", f"device/{d['id']}/tags",
                                {"tags": want})
    if code in (200, 204):
        print(f"  → HTTP {code}")
    else:
        print(f"  → FAIL HTTP {code} {resp}", file=sys.stderr)
        if want != []:
            sys.exit(1)

print()
print(f"pending_changes={changes} unknown={len(unknown)} "
      f"dry_run={DRY_RUN} list_only={LIST_ONLY}")
if unknown:
    print("UNKNOWN (left unchanged):", ", ".join(unknown))
print("==> Done")
