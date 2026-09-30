#!/usr/bin/env python3
"""Enable MagicDNS + HTTPS Certificates via Tailscale Admin API.

Docs: PATCH /api/v2/tailnet/{tailnet}/settings {"httpsEnabled": true}

Env: TAILSCALE_TAILNET, TS_CLIENT_ID/SECRET (or TAILSCALE_OAUTH_*)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ts_api  # noqa: E402

T = ts_api.TAILNET

print("== GET settings (before) ==")
s = ts_api.get(f"tailnet/{T}/settings")
print(
    json.dumps(
        {k: s.get(k) for k in ("httpsEnabled", "devicesApprovalOn", "devicesAutoUpdatesOn")},
        indent=2,
    )
)

print("== POST MagicDNS ==")
_, resp, _ = ts_api.call("POST", f"tailnet/{T}/dns/preferences", {"magicDNS": True})
print(json.dumps(resp, indent=2))

print("== PATCH httpsEnabled=true ==")
code, resp, _ = ts_api.call("PATCH", f"tailnet/{T}/settings", {"httpsEnabled": True})
print(f"HTTP {code}")
print(json.dumps(resp, indent=2) if resp else "(empty body)")
if code not in (200, 204):
    sys.exit(1)

print("== GET settings (after) ==")
s = ts_api.get(f"tailnet/{T}/settings")
print(json.dumps({"httpsEnabled": s.get("httpsEnabled")}, indent=2))
print("== Done ==")
