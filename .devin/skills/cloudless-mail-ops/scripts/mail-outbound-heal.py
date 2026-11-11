#!/usr/bin/env python3
"""mail-outbound-heal — detect and repair MAIL_OUTBOUND_TOKEN drift.

The mail-outbound Cloudflare worker authorizes /send by comparing the
Bearer token to its MAIL_OUTBOUND_TOKEN secret. When the secret drifts
from secrets/mail-outbound.json every sender 401s (mail-pipeline-watch
log: "HTTP Error 401: Unauthorized").

This tool:
  1. probes POST /send with an empty JSON body — a VALID token gets 400
     ("to, subject and text|html are required"), an invalid/missing one
     gets 401. No mail is sent either way.
  2. on 401, PUTs the token from mail-outbound.json as the worker's
     MAIL_OUTBOUND_TOKEN secret via the Cloudflare API.
  3. re-probes until the secret propagates (usually <10s).

Auth for the CF API: secrets/cf-workers-deploy-token (needs
Workers Scripts:Edit on the account — the plain CLOUDFLARE_API_TOKEN
in cu130-slim/.env does NOT have it).

usage: python mail-outbound-heal.py [--force]
  --force  resync the secret even when the probe already passes
exit 0 = auth OK (healed or already fine), 1 = still broken
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

KEYS = os.path.join(os.environ.get("APPDATA", ""), "devin", "secrets")
CF_ACCOUNT = "fb7dc7b69b662480cd5961a4d1913c78"
WORKER = "mail-outbound"
SECRET_NAME = "MAIL_OUTBOUND_TOKEN"
PROBE_UA = {"User-Agent": "mail-outbound-heal/1.0", "Content-Type": "application/json"}


def _cfg():
    return json.load(open(os.path.join(KEYS, "mail-outbound.json")))


def _cf_token():
    return open(os.path.join(KEYS, "cf-workers-deploy-token")).read().strip()


def probe(cfg):
    """Return HTTP status of an authenticated-but-invalid /send call."""
    req = urllib.request.Request(
        cfg["url"],
        data=b"{}",
        method="POST",
        headers=dict(PROBE_UA, Authorization="Bearer " + cfg["token"]),
    )
    try:
        urllib.request.urlopen(req, timeout=30)
        return 200
    except urllib.error.HTTPError as e:
        return e.code


def heal(cfg):
    body = json.dumps({"name": SECRET_NAME, "text": cfg["token"], "type": "secret_text"}).encode()
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}"
        f"/workers/scripts/{WORKER}/secrets",
        data=body,
        method="PUT",
        headers={
            "Authorization": "Bearer " + _cf_token(),
            "Content-Type": "application/json",
        },
    )
    res = json.loads(urllib.request.urlopen(req, timeout=30).read())
    if not res.get("success"):
        raise RuntimeError("CF API error: " + json.dumps(res.get("errors")))
    return res["result"]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    force = "--force" in sys.argv
    cfg = _cfg()
    status = probe(cfg)
    out = {"probe_status": status, "healed": False}
    if status != 401 and not force:
        out["ok"] = True
        print(json.dumps(out))
        return 0
    if status == 401:
        out["action"] = "resyncing MAIL_OUTBOUND_TOKEN secret"
    else:
        out["action"] = "forced resync"
    try:
        out["secret_result"] = heal(cfg)
        out["healed"] = True
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)[:400]
        print(json.dumps(out, ensure_ascii=False))
        return 1
    for _ in range(6):
        time.sleep(5)
        status = probe(cfg)
        if status != 401:
            out["probe_status_after"] = status
            out["ok"] = status == 400 or status == 200
            print(json.dumps(out, ensure_ascii=False))
            return 0 if out["ok"] else 1
    out["ok"] = False
    out["error"] = "still 401 after resync"
    print(json.dumps(out, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
