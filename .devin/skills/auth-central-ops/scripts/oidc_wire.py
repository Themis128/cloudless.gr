#!/usr/bin/env python3
"""Wire an app into authentik OIDC — creates the provider + prints the app's
oauth config to paste in. Usage: oidc_wire.py <app> where app is grafana,
portainer, metabase, n8n, filebrowser, espocrm."""
import base64
import json
import subprocess
import sys
import urllib.request

AK = "http://192.168.1.128:30910"
SSH = ["ssh", "-i", "~/.ssh/id_rsa_win", "-o", "StrictHostKeyChecking=no", "tbaltzakis@100.74.191.58"]

def omv(c):
    return subprocess.run(SSH + [c], capture_output=True, text=True, timeout=30).stdout.strip()

key = base64.b64decode(omv("sudo kubectl get secret authentik-secret -n authentik -o jsonpath='{.data.ops-api-token}'")).decode()
H = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}

def api(m, p, b=None):
    r = urllib.request.Request(AK + p, headers=H, method=m)
    if b: r.data = json.dumps(b).encode()
    try: return json.load(urllib.request.urlopen(r, timeout=20))
    except urllib.error.HTTPError as e:
        print(p, e.code, e.read()[:150]); return {}

app = sys.argv[1] if len(sys.argv) > 1 else None
if not app:
    print("usage: oidc_wire.py <grafana|portainer|metabase|n8n|filebrowser|espocrm>")
    sys.exit(0)

fl = api("GET", "/api/v3/flows/instances/?designation=authorization&search=provider")["results"][0]["pk"]
inv = api("GET", "/api/v3/flows/instances/?designation=invalidation&search=provider")["results"][0]["pk"]
import secrets
sec = secrets.token_hex(20)
slug = f"{app}-oidc"
p = api("POST", "/api/v3/providers/oauth2/", {
    "name": f"{app} OIDC", "authorization_flow": fl, "invalidation_flow": inv,
    "client_id": f"{app}_client", "client_secret": sec, "client_type": "confidential",
    "redirect_uris": f"https://{app}.cloudless.gr/*", "sub_mode": "hashed_user_id",
    "include_claims_in_id_token": True, "issuer_mode": "per_provider",
    "property_mappings": [], "signing_key": None})
if not p.get("pk"):
    sys.exit(1)
api("POST", "/api/v3/core/applications/", {"name": app, "slug": slug, "provider": p["pk"]})
meta = api("GET", f"/api/v3/providers/oauth2/{p['pk']}/")
print(f"=== {app} OIDC provider created ===")
print("auth URL:", f"https://auth.cloudless.gr/application/o/{slug}/authorize/")
print("token URL:", f"https://auth.cloudless.gr/application/o/{slug}/token/")
print("userinfo:", f"https://auth.cloudless.gr/application/o/{slug}/userinfo/")
print("client_id:", p["client_id"]); print("client_secret:", sec)

CFG = {
 "grafana": f"\nGF_AUTH_GENERIC_OAUTH_ENABLED=true\nGF_AUTH_GENERIC_OAUTH_NAME=authentik\nGF_AUTH_GENERIC_OAUTH_CLIENT_ID={p['client_id']}\nGF_AUTH_GENERIC_OAUTH_CLIENT_SECRET={sec}\nGF_AUTH_GENERIC_OAUTH_AUTH_URL=https://auth.cloudless.gr/application/o/{slug}/authorize/\nGF_AUTH_GENERIC_OAUTH_TOKEN_URL=https://auth.cloudless.gr/application/o/{slug}/token/\nGF_AUTH_GENERIC_OAUTH_API_URL=https://auth.cloudless.gr/application/o/{slug}/userinfo/\n",
 "metabase": f"\nMB_OIDC_CLIENT_ID={p['client_id']}\nMB_OIDC_CLIENT_SECRET={sec}\nMB_OIDC_AUTH_URL=https://auth.cloudless.gr/application/o/{slug}/authorize/\nMB_OIDC_TOKEN_URL=https://auth.cloudless.gr/application/o/{slug}/token/\nMB_OIDC_USERINFO_URL=https://auth.cloudless.gr/application/o/{slug}/userinfo/\n",
 "portainer": f"\nPortainer UI → Settings → Authentication → OAuth → custom provider\n  auth_url https://auth.cloudless.gr/application/o/{slug}/authorize/\n  token_url https://auth.cloudless.gr/application/o/{slug}/token/\n  client_id {p['client_id']}  client_secret {sec}\n",
 "n8n": f"\nN8N_OIDC_ENABLED=true\nN8N_OIDC_ISSUER=https://auth.cloudless.gr/application/o/{slug}/\nN8N_OIDC_CLIENT_ID={p['client_id']}\nN8N_OIDC_CLIENT_SECRET={sec}\n",
 "filebrowser": f"\nFileBrowser → Settings → Authentication → OIDC\n  issuer https://auth.cloudless.gr/application/o/{slug}/  client {p['client_id']}  secret {sec}\n",
 "espocrm": f"\nEspoCRM → Administration → Authentication → OIDC\n  issuer https://auth.cloudless.gr/application/o/{slug}/  client {p['client_id']}  secret {sec}\n",
}
print(CFG.get(app, "(paste the URLs above into the app's oauth settings)"))
