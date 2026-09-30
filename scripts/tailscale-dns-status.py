#!/usr/bin/env python3
"""Tailscale DNS status — nameservers, preferences, search paths,
ACL autoApprovers, plus MagicDNS enable + optional HTTPS enable.

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*).
ENABLE_HTTPS=1 patches httpsEnabled=true."""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

for title, path in (("nameservers", "dns/nameservers"),
                    ("preferences", "dns/preferences"),
                    ("searchpaths", "dns/searchpaths")):
    print(f"== {title} ==")
    print(json.dumps(ts_api.get(f"tailnet/{ts_api.TAILNET}/{path}"),
                     indent=2))

print("== ACL autoApprovers ==")
acl = ts_api.get(f"tailnet/{ts_api.TAILNET}/acl")
print(json.dumps({k: acl.get(k) for k in ("tagOwners", "autoApprovers")},
                 indent=2))

print("== enable MagicDNS (POST preferences) ==")
_, resp, _ = ts_api.call(
    "POST", f"tailnet/{ts_api.TAILNET}/dns/preferences",
    {"magicDNS": True})
print(json.dumps(resp, indent=2))

print("== GET /settings (httpsEnabled) ==")
settings = ts_api.get(f"tailnet/{ts_api.TAILNET}/settings")
print(json.dumps({"httpsEnabled": settings.get("httpsEnabled")},
                 indent=2))

if os.environ.get("ENABLE_HTTPS", "0").lower() in ("1", "true", "yes"):
    print("== PATCH httpsEnabled=true ==")
    _, resp, _ = ts_api.call(
        "PATCH", f"tailnet/{ts_api.TAILNET}/settings",
        {"httpsEnabled": True})
    print(json.dumps(resp, indent=2))
    settings = ts_api.get(f"tailnet/{ts_api.TAILNET}/settings")
    print(json.dumps({"httpsEnabled": settings.get("httpsEnabled")},
                     indent=2))
