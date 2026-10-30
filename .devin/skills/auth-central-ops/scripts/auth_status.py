#!/usr/bin/env python3
"""One report across every Cloudless auth surface: authentik, CF Access,
app logins, platform OAuth, TOTP, API tokens."""
import base64
import json
import subprocess
import urllib.request

SSH = ["ssh", "-i", "~/.ssh/id_rsa_win", "-o", "StrictHostKeyChecking=no",
       "-o", "ConnectTimeout=8", "tbaltzakis@100.74.191.58"]

def omv(c):
    return subprocess.run(SSH + [c], capture_output=True, text=True, timeout=30).stdout.strip()

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
_opener = urllib.request.build_opener(_NoRedirect)

def http(url, tok=None, host=None):
    try:
        r = urllib.request.Request(url)
        if tok: r.add_header("Authorization", f"Bearer {tok}")
        if host: r.add_header("Host", host)
        _opener.open(r, timeout=12)
        return "200"
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return "DOWN"

# ── authentik ──
print("=== authentik (auth.cloudless.gr) ===")
print(omv("sudo kubectl get pods -n authentik --no-headers | awk '{print \"  \"$1,$3}'"))
ak = http("http://192.168.1.128:30910/-/health/ready/")
print(f"  health/ready: {ak}")

# ── CF Access-gated (omv tunnel) ──
print("\n=== CF Access SSO-gated ===")
for h in ["manage","grafana","postiz","espocrm","appflowy","n8n","kuma","docs","meili","webmail"]:
    code = http(f"https://{h}.cloudless.gr/")
    gate = "SSO" if code == "302" else f"({code})"
    print(f"  {h}.cloudless.gr: {gate}")

# ── authentik proxy outposts ──
print("\n=== authentik-gated ===")
key = base64.b64decode(omv("sudo kubectl get secret authentik-secret -n authentik -o jsonpath='{.data.ops-api-token}'")).decode()
provs = json.load(urllib.request.urlopen(urllib.request.Request(
    "http://192.168.1.128:30910/api/v3/providers/proxy/?page_size=50",
    headers={"Authorization": f"Bearer {key}"}), timeout=15)).get("results", [])
for p in provs:
    code = http(p["external_host"])
    print(f"  {p['name']}: {code} -> {p['internal_host']}")

# ── cu130 stack (via win_agent-free check) ──
print("\n=== cu130 stack (local probe) ===")
for name, port in [("social-api",8083),("metabase",3000),("portainer",9000),("grafana",3001),("env-mgr",8080),("jupyter",8888)]:
    code = http(f"http://127.0.0.1:{port}/")
    print(f"  {name}:{port}: {code}")

# ── TOTP/API tokens (social-api env) ──
print("\n=== tokens in social-api env ===")
env = subprocess.run(["docker","exec","social-api","env"], capture_output=True, text=True).stdout
for k in ["TWITTER_TOTP_SECRET","META_TOTP_SECRET","CLOUDFLARE_API_TOKEN","AUTHENTIK_OUTPOST_TOKEN"]:
    found = "SET" if any(l.startswith(k+"=") and len(l.split("=",1)[1])>3 for l in env.splitlines()) else "missing"
    print(f"  {k}: {found}")

print("\nDone.")
