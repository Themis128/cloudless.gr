#!/usr/bin/env python3
"""Tailscale Admin API: merge fabric ACL + delete stale k8s proxy
devices.

Auth: TS_API_KEY (tskey-api-…) OR TS_CLIENT_ID + TS_CLIENT_SECRET.
Docs: https://tailscale.com/docs/reference/api

Env:
  DRY_RUN=1   — print ACL diff + stale list, no writes
  ACL_ONLY=1  — skip device cleanup
  ACL_PATCH   — policy file (default
                infrastructure/tailscale/acl-policy.example.json)"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

TAILNET = ts_api.TAILNET
ROOT = Path(__file__).resolve().parent.parent
ACL_PATCH = Path(os.environ.get(
    "ACL_PATCH",
    ROOT / "infrastructure/tailscale/acl-policy.example.json"))
DRY_RUN = os.environ.get("DRY_RUN", "0").lower() in ("1", "true", "yes")
ACL_ONLY = os.environ.get("ACL_ONLY", "0").lower() in ("1", "true")

KEEP_RE = re.compile(
    r"^(office(-[123])?|github-omv|omv-ha|cloudless-k3s-operator)$")
STALE_RE = re.compile(
    r"^(monitoring-proxies-[0-9]+|monitoring-proxy-[0-9]+|appflowy|"
    r"cloudless-app|cloudless-manager|grafana|meilisearch|n8n|postgres|"
    r"redis|sync-webhook|k3s-subnet-router(-[0-9]+)?|"
    r"tailscale-operator(-[0-9]+)?)$")

if not (ts_api.TS_API_KEY or
        (ts_api.CLIENT_ID and ts_api.CLIENT_SECRET)):
    print("Set TS_API_KEY or TS_CLIENT_ID+TS_CLIENT_SECRET",
          file=sys.stderr)
    sys.exit(2)

print(f"==> Authenticated for tailnet {TAILNET}")

print("==> GET current ACL")
code, cur, hdrs = ts_api.call("GET", f"tailnet/{TAILNET}/acl")
if code != 200:
    print(f"GET ACL failed HTTP {code}: {cur}", file=sys.stderr)
    sys.exit(1)
etag = next((v for k, v in hdrs.items() if k.lower() == "etag"), "")
print(f"    ETag: {etag or 'none'}")

print("==> Live ACL summary (grants)")
for g in cur.get("grants") or cur.get("acls") or []:
    print(f"  grant src={g.get('src')} dst={g.get('dst')} "
          f"ip={g.get('ip') or g.get('ports') or g.get('proto')}")
print("  tagOwners:", json.dumps(cur.get("tagOwners") or {},
                                 sort_keys=True))

print(f"==> Merge fabric ACL patch from {ACL_PATCH}")
patch = json.loads(ACL_PATCH.read_text())


def deep_merge_dict(a, b):
    out = dict(a or {})
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge_dict(out[k], v)
        else:
            out[k] = v
    return out


for key in ("tagOwners", "autoApprovers"):
    if key in patch:
        cur[key] = deep_merge_dict(cur.get(key, {}), patch[key])

if "grants" in patch:
    existing = cur.get("grants") or cur.get("Grants") or []
    key = "grants" if "grants" in cur or "Grants" not in cur \
        else "Grants"

    def grant_key(g):
        return (tuple(sorted(g.get("src") or [])),
                tuple(sorted(g.get("dst") or [])))

    by = {grant_key(g): g for g in existing}
    for g in patch["grants"]:
        by[grant_key(g)] = g
    cur[key] = list(by.values())
    if key == "grants" and "Grants" in cur:
        del cur["Grants"]
    print("grants:", len(cur[key]))

if "ssh" in patch:
    cur["ssh"] = patch["ssh"]
    print("ssh rules:", len(cur["ssh"]))

if "nodeAttrs" in patch:
    cur_attrs = cur.setdefault("nodeAttrs", [])
    star = next((a for a in cur_attrs
                 if a.get("target") in (["*"], "*")), None)
    if star is None:
        star = {"target": ["*"], "app": {}}
        cur_attrs.append(star)
    app = star.setdefault("app", {})
    key = "tailscale.com/app-connectors"
    existing = {c.get("name"): c for c in (app.get(key) or [])
                if c.get("name")}
    for conn in (patch["nodeAttrs"][0].get("app", {}).get(key, [])
                 if patch["nodeAttrs"] else []):
        name = conn.get("name")
        if name:
            existing[name] = conn
    app[key] = list(existing.values())
    print("app-connectors:", ", ".join(sorted(existing)))

print("merged keys:", ", ".join(sorted(cur.keys())))

if DRY_RUN:
    print("==> DRY_RUN=1 — merged ACL (not posted):")
    print(json.dumps(cur, indent=2, sort_keys=True))
else:
    print("==> POST merged ACL")
    headers = {"If-Match": etag} if etag else {}
    code, resp, _ = ts_api.call("POST", f"tailnet/{TAILNET}/acl", cur,
                                headers=headers)
    if code != 200:
        print(f"POST ACL failed HTTP {code}: "
              f"{json.dumps(resp)[:800]}", file=sys.stderr)
        sys.exit(1)
    print("    ACL updated")

if ACL_ONLY:
    print("==> ACL_ONLY=1 — skipping device cleanup")
    print("==> Done")
    sys.exit(0)

print("==> List devices")
code, data, _ = ts_api.call("GET", f"tailnet/{TAILNET}/devices")
if code != 200:
    print(f"GET devices failed HTTP {code}: {data}", file=sys.stderr)
    sys.exit(1)

devices = data.get("devices") or []
now = datetime.now(timezone.utc)


def is_offline(d):
    if d.get("offline") or d.get("expired"):
        return True
    last = d.get("lastSeen")
    if not last:
        return False
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
        return (now - last_dt).total_seconds() > 86400
    except ValueError:
        return False


to_delete = []
offline_kept = []
for d in devices:
    short = (d.get("hostname") or d.get("name") or "").split(".")[0]
    tags = d.get("tags") or []
    last = d.get("lastSeen") or ""
    offline = is_offline(d)

    if KEEP_RE.match(short):
        print(f"KEEP  {short}  tags={tags}")
        if offline:
            print(f"      WARNING: Device {short} is offline! "
                  "Reconnect before removing from keep list.")
            offline_kept.append((short, d.get("id")))
        continue
    if STALE_RE.match(short):
        to_delete.append(d)
        print(f"STALE {short}  id={d.get('id')}  tags={tags}  "
              f"lastSeen={last}{' (OFFLINE)' if offline else ''}")
        continue
    if "tag:k8s" in tags and short not in (
            "ingress-0", "ingress-1", "kube-0", "kube-1",
            "k3s-cidrs-0", "k3s-cidrs-1"):
        if ("proxy" in short or "monitoring" in short
                or short in {"appflowy", "n8n", "grafana",
                             "meilisearch", "postgres", "redis",
                             "sync-webhook", "cloudless-app",
                             "cloudless-manager"}):
            to_delete.append(d)
            print(f"STALE {short}  id={d.get('id')}  "
                  "(tag:k8s leftover)")

if offline_kept:
    print("\n!!! OFFLINE DEVICES (may need reconnection):")
    for short, dev_id in offline_kept:
        print(f"    - {short} ({dev_id})")

print(f"\nWill delete {len(to_delete)} stale device(s)")
if DRY_RUN:
    print("DRY_RUN=1 — skipping DELETE")
else:
    for d in to_delete:
        did = d.get("id")
        short = (d.get("hostname") or d.get("name")
                 or "").split(".")[0]
        code, resp, _ = ts_api.call("DELETE", f"device/{did}")
        if code in (200, 204):
            print(f"DELETED {short} ({did}) HTTP {code}")
        else:
            print(f"FAIL delete {short} ({did}): HTTP {code} {resp}",
                  file=sys.stderr)
            sys.exit(1)
print("==> Done")
