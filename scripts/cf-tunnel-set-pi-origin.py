#!/usr/bin/env python3
"""Set remote Cloudflare Tunnel ingress for app hostnames → k3s NodePort 30300.

Creates a short-lived token with Cloudflare Tunnel Write if the primary token
lacks Edit, applies the config, then revokes the temp token.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TUNNEL_WRITE = "c07321b023e944ff818fec44d8203567"
TUNNEL_READ = "efea2ab8357b47888938f101ae5e053f"
DEFAULT_HOSTS = (
    "pi-origin.cloudless.gr",
    "cloudless.gr",
    "manage.cloudless.gr",
)


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    path = REPO / ".env"
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def api(tok: str, method: str, url: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {url} → {e.code}: {err[:500]}") from e


def mint_tunnel_token(base_tok: str, account_id: str) -> tuple[str, str]:
    out = api(
        base_tok,
        "POST",
        "https://api.cloudflare.com/client/v4/user/tokens",
        {
            "name": "cloudless-tunnel-edit-temp",
            "policies": [
                {
                    "effect": "allow",
                    "resources": {f"com.cloudflare.api.account.{account_id}": "*"},
                    "permission_groups": [
                        {"id": TUNNEL_WRITE},
                        {"id": TUNNEL_READ},
                    ],
                }
            ],
        },
    )
    result = out.get("result") or {}
    tid = result.get("id")
    val = result.get("value")
    if not tid or not val:
        raise RuntimeError(f"token create failed: {out}")
    return tid, val


def revoke_token(base_tok: str, token_id: str) -> None:
    try:
        api(base_tok, "DELETE", f"https://api.cloudflare.com/client/v4/user/tokens/{token_id}")
        print(f"revoked temp token {token_id}")
    except Exception as exc:  # noqa: BLE001
        print(f"warn: revoke failed: {exc}", file=sys.stderr)


def main() -> None:
    env = load_env()
    base_tok = os.environ.get("CLOUDFLARE_API_TOKEN") or env.get("CLOUDFLARE_API_TOKEN")
    if not base_tok:
        raise SystemExit("CLOUDFLARE_API_TOKEN required")
    acct = (
        env.get("CLOUDFLARE_ACCOUNT_ID")
        or env.get("CF_ACCOUNT_ID")
        or "fb7dc7b69b662480cd5961a4d1913c78"
    )
    tunnel = env.get("CLUSTER_CLOUDFLARED_TUNNEL_ID") or "e977a490-58c5-4fdb-9155-86832e3e636a"
    origin = os.environ.get("PI_NODEPORT_ORIGIN", "http://192.168.1.128:30300")
    hosts = {
        h.strip()
        for h in os.environ.get("TUNNEL_HOSTS", ",".join(DEFAULT_HOSTS)).split(",")
        if h.strip()
    }

    edit_tok = base_tok
    temp_id: str | None = None
    url = f"https://api.cloudflare.com/client/v4/accounts/{acct}/cfd_tunnel/{tunnel}/configurations"

    # Probe write; mint elevated token if needed
    try:
        data = api(edit_tok, "GET", url)
        cfg = data["result"]["config"]
        for rule in cfg.get("ingress") or []:
            if rule.get("hostname") in hosts:
                rule["service"] = origin
                rule["originRequest"] = {
                    "connectTimeout": 30,
                    "httpHostHeader": rule["hostname"],
                }
                print("set", rule["hostname"], "->", origin)
        api(edit_tok, "PUT", url, {"config": cfg})
    except RuntimeError as exc:
        if (
            "401" not in str(exc)
            and "403" not in str(exc)
            and "Not authorized" not in str(exc)
            and "1001" not in str(exc)
        ):
            raise
        print("primary token lacks Tunnel Edit — minting temp token")
        temp_id, edit_tok = mint_tunnel_token(base_tok, acct)
        data = api(edit_tok, "GET", url)
        cfg = data["result"]["config"]
        for rule in cfg.get("ingress") or []:
            if rule.get("hostname") in hosts:
                rule["service"] = origin
                rule["originRequest"] = {
                    "connectTimeout": 30,
                    "httpHostHeader": rule["hostname"],
                }
                print("set", rule["hostname"], "->", origin)
        out = api(edit_tok, "PUT", url, {"config": cfg})
        print("ok version", (out.get("result") or {}).get("version"))
    else:
        # verify version via GET
        ver = api(edit_tok, "GET", url).get("result", {}).get("version")
        print("ok version", ver)

    if temp_id:
        revoke_token(base_tok, temp_id)


if __name__ == "__main__":
    main()
