"""Shared Tailscale Admin API helper.

Mirrors the OAuth-token prelude common to scripts/tailscale-*.sh:
client-credentials grant against https://api.tailscale.com/api/v2.

Env:
  TAILSCALE_TAILNET (default tail4ecae1.ts.net)
  TS_CLIENT_ID / TAILSCALE_OAUTH_CLIENT_ID
  TS_CLIENT_SECRET / TAILSCALE_OAUTH_CLIENT_SECRET / TAILSCALE_OAUTH_SECRET
"""

import base64
import json
import os
import urllib.error
import urllib.request

API = os.environ.get("TAILSCALE_API_BASE", "https://api.tailscale.com/api/v2")
TAILNET = os.environ.get("TAILSCALE_TAILNET", "tail4ecae1.ts.net")

TS_API_KEY = os.environ.get("TS_API_KEY", "")
CLIENT_ID = os.environ.get("TS_CLIENT_ID") or os.environ.get("TAILSCALE_OAUTH_CLIENT_ID", "")
CLIENT_SECRET = (
    os.environ.get("TS_CLIENT_SECRET")
    or os.environ.get("TAILSCALE_OAUTH_CLIENT_SECRET")
    or os.environ.get("TAILSCALE_OAUTH_SECRET", "")
)

_token: str | None = None


def auth_header() -> str:
    """'Authorization: ...' value — basic for TS_API_KEY, bearer OAuth."""
    if TS_API_KEY:
        return "Basic " + base64.b64encode(f"{TS_API_KEY}:".encode()).decode()
    return f"Bearer {access_token()}"


def access_token() -> str:
    global _token
    if _token:
        return _token
    creds = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    req = urllib.request.Request(
        f"{API}/oauth/token",
        data=b"grant_type=client_credentials",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    _token = json.loads(urllib.request.urlopen(req, timeout=30).read())["access_token"]
    return _token


def call(method: str, path: str, body=None, headers: dict | None = None) -> tuple[int, dict, dict]:
    """Returns (http_code, parsed_json_or_empty, response_headers)."""
    req = urllib.request.Request(
        f"{API}/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": auth_header(),
            "Content-Type": "application/json",
            "Accept": "application/json",
            **(headers or {}),
        },
        method=method,
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        raw = r.read()
        hdrs = dict(r.headers.items())
    except urllib.error.HTTPError as e:
        raw = e.read()
        hdrs = dict(e.headers.items())
        try:
            return e.code, json.loads(raw), hdrs
        except Exception:
            return e.code, {}, hdrs
    except Exception as e:
        return 0, {"error": str(e)}, {}
    try:
        return r.status, json.loads(raw), hdrs
    except Exception:
        return r.status, {}, hdrs


def get(path: str) -> dict:
    return call("GET", path)[1]
