#!/usr/bin/env python3
"""Provision the Cloudflare Access service token for
postiz.cloudless.gr and wire it into the cloudless2 Worker
(production + staging).

Requires:
  CLOUDFLARE_API_TOKEN  — Access:Service Tokens:Edit, Access:Apps and
                          Policies:Edit, Workers Scripts:Edit
  CLOUDFLARE_ACCOUNT_ID — default fb7dc7b69b662480cd5961a4d1913c78

Idempotent: reuses an existing "cloudless-app" service token, and
only appends a policy binding when one doesn't already exist.
Prints the Client Secret ONCE — Cloudflare never shows it again."""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "fb7dc7b69b662480cd5961a4d1913c78")
API = os.environ.get("CLOUDFLARE_API", "https://api.cloudflare.com/client/v4")
APP_DOMAIN = os.environ.get("APP_DOMAIN", "postiz.cloudless.gr")
TOKEN_NAME = os.environ.get("TOKEN_NAME", "cloudless-app")
TOKEN_DURATION = os.environ.get("TOKEN_DURATION", "8760h")
WORKER_PROD = os.environ.get("WORKER_PROD", "cloudless2")
WORKER_STAGING = os.environ.get("WORKER_STAGING", "cloudless-gr-staging")

PICKED = {
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "APP_DOMAIN",
    "TOKEN_NAME",
    "TOKEN_DURATION",
    "WORKER_PROD",
    "WORKER_STAGING",
}


def repo_root() -> Path:
    r = subprocess.run(
        ["git", "-C", str(Path(__file__).resolve().parent), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    return Path(r.stdout.strip()) if r.returncode == 0 else Path(__file__).resolve().parent.parent


if not os.environ.get("CLOUDFLARE_API_TOKEN"):
    ROOT = repo_root()
    for candidate in (ROOT / ".env.local", ROOT / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text().splitlines():
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line)
            if not m or m.group(1) not in PICKED:
                continue
            key = m.group(1)
            value = m.group(2).strip().strip("\"'")
            if not value or value.startswith(("your-", "xxx", "CHANGE", "TODO", "<")):
                continue
            if not os.environ.get(key):
                os.environ[key] = value
                print(f"  ({candidate.name}) picked up {key}", file=sys.stderr)

if not os.environ.get("CLOUDFLARE_API_TOKEN"):
    print(
        "❌ CLOUDFLARE_API_TOKEN not set — mint one at "
        "https://dash.cloudflare.com/profile/api-tokens",
        file=sys.stderr,
    )
    print("   Then either:  export CLOUDFLARE_API_TOKEN=…", file=sys.stderr)
    print("   or add it to  .env.local  in the repo root and re-run.", file=sys.stderr)
    sys.exit(1)

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]


def cf(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": str(e)}]}


print("─── 1/4  Verifying token scope ─────────────────────────────")
v = cf("GET", "/user/tokens/verify").get("result") or {}
print(f"  status: {v.get('status')}  id: {v.get('id')}")

print(f"─── 2/4  Ensuring service token '{TOKEN_NAME}' exists ──────")
tokens = (
    cf("GET", f"/accounts/{ACCOUNT_ID}/access/service_tokens?per_page=1000").get("result") or []
)
existing = next((t["client_id"] for t in tokens if t.get("name") == TOKEN_NAME), None)
secret_file = None
if existing:
    print(f"  reusing existing token client_id={existing}")
    print("  (client_secret is not retrievable — if you don't already have it,")
    print("   delete this token in the dashboard and re-run to mint a fresh pair.)")
    client_id, client_secret = existing, ""
else:
    print(f"  minting a new service token ({TOKEN_DURATION}) …")
    r = cf(
        "POST",
        f"/accounts/{ACCOUNT_ID}/access/service_tokens",
        {"name": TOKEN_NAME, "duration": TOKEN_DURATION},
    )
    client_id = r["result"]["client_id"]
    client_secret = r["result"]["client_secret"]
    print(f"  minted client_id={client_id}")

    # Persist the secret IMMEDIATELY to a mode-600 file — a later
    # failure mustn't leave an orphan token whose secret CF never
    # re-exposes. Deleted after step 4 completes cleanly.
    import tempfile

    fd, secret_file = tempfile.mkstemp(prefix="postiz-cf-secret-", suffix=".env")
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(
            f"# Freshly-minted Cloudflare Access service token "
            f"for {TOKEN_NAME}.\n"
            "# Cloudflare only shows client_secret once — do "
            "not lose this file.\n"
            f"POSTIZ_CF_ACCESS_CLIENT_ID={client_id}\n"
            f"POSTIZ_SERVICE_TOKEN={client_secret}\n"
        )
    print(f"\n  🔐  client_secret saved to: {secret_file}")
    print("      (permissions 0600 — deleted after step 4 succeeds)\n")

print(f"─── 3/4  Attaching token to Access app '{APP_DOMAIN}' ────")
apps = cf("GET", f"/accounts/{ACCOUNT_ID}/access/apps?per_page=1000").get("result") or []
app_uid = next(
    (
        a["uid"]
        for a in apps
        if a.get("domain") == APP_DOMAIN or APP_DOMAIN in (a.get("self_hosted_domains") or [])
    ),
    None,
)

if not app_uid:
    print(f"  no Access application found for {APP_DOMAIN} — creating one …")
    r = cf(
        "POST",
        f"/accounts/{ACCOUNT_ID}/access/apps",
        {
            "name": "Postiz",
            "domain": APP_DOMAIN,
            "type": "self_hosted",
            "session_duration": "24h",
            "app_launcher_visible": False,
            "auto_redirect_to_identity": False,
            "allowed_idps": [],
            "tags": [],
        },
    )
    app_uid = (r.get("result") or {}).get("uid") or (r.get("result") or {}).get("id")
    if not app_uid:
        print("❌ Failed to create Access application. Create manually:", file=sys.stderr)
        print(
            f"   Zero Trust → Access → Applications → Add → Self-hosted → {APP_DOMAIN}",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"  created app uid={app_uid}")
else:
    print(f"  found existing app uid={app_uid}")

policies = cf("GET", f"/accounts/{ACCOUNT_ID}/access/apps/{app_uid}/policies").get("result") or []
already = next(
    (
        p["id"]
        for p in policies
        if any(
            (inc.get("service_token") or {}).get("token_id") == client_id
            for inc in p.get("include") or []
        )
    ),
    None,
)

if already:
    print(f"  policy already binds this service token (policy id={already}) — skipping")
else:
    print(f"  creating Service Auth policy for token {client_id} …")
    r = cf(
        "POST",
        f"/accounts/{ACCOUNT_ID}/access/apps/{app_uid}/policies",
        {
            "name": "cloudless-app service token",
            "decision": "non_identity",
            "include": [{"service_token": {"token_id": client_id}}],
            "precedence": 1,
        },
    )
    print(f"  created policy id={(r.get('result') or {}).get('id')}")

print("─── 4/4  Writing Worker secrets ──────────────────────────")


def put_secret(worker: str, name: str, value: str) -> None:
    if not value:
        print(f"  ⚠ skipping {worker}/{name} — value unavailable (reused existing token)")
        return
    r = cf(
        "PUT",
        f"/accounts/{ACCOUNT_ID}/workers/scripts/{worker}/secrets",
        {"name": name, "text": value, "type": "secret_text"},
    )
    res = r.get("result") or {}
    if res:
        print(f"  {res.get('name')}  →  {res.get('type')}  ✓")
    else:
        print(f"  ⚠ PUT {worker}/{name} failed (script may not be deployed yet)")


for worker in (WORKER_PROD, WORKER_STAGING):
    print(f"  worker={worker}")
    put_secret(worker, "POSTIZ_CF_ACCESS_CLIENT_ID", client_id)
    put_secret(worker, "POSTIZ_SERVICE_TOKEN", client_secret)

print("""
═══════════════════════════════════════════════════════════════════
 Done.  Cloudflare deploys a new Worker version automatically the
 moment secrets change — next request picks up the new bindings.""")
if client_secret:
    print("""
 ⚠ Save these — Cloudflare will not show CLIENT_SECRET again:
   POSTIZ_CF_ACCESS_CLIENT_ID = {client_id}
   POSTIZ_SERVICE_TOKEN       = {client_secret}""")
    if secret_file and Path(secret_file).is_file():
        Path(secret_file).unlink()
        print(f"   (temp file {secret_file} removed)")
print("═══════════════════════════════════════════════════════════════════")
print(f"""
Verify with:
  curl -sSI https://{APP_DOMAIN}/api/public/v1/integrations \\
    -H 'CF-Access-Client-Id: {client_id}' \\
    -H 'CF-Access-Client-Secret: <secret>' | head -5
→ expect HTTP/2 200 or 401 (from Postiz), NOT the CF Access login page.""")
