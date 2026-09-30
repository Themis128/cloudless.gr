#!/usr/bin/env python3
"""secret-completeness-check.py — Check for missing secrets/env vars across all services.

Port of secret-completeness-check.sh.
Usage: python3 tools/secret-completeness-check.py

Checks:
  1. Kubernetes secrets referenced by pods but missing
  2. Cloudless-app logs for missing env var warnings
  3. Known required secrets per service
  4. Slack signing secrets (NEWSLETTER_SLACK_SIGNING_SECRET, SLACK_SIGNING_SECRET)
  5. D1/Cloudflare API connectivity (EAI_AGAIN DNS errors)
"""

import json
import re
import shutil
import subprocess
import urllib.request
from datetime import UTC, datetime

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"

ISSUES = 0
WARNINGS = 0


def issue(text: str) -> None:
    global ISSUES
    ISSUES += 1
    print(f"{RED}✗{NC} {text}")


def warn(text: str) -> None:
    global WARNINGS
    WARNINGS += 1
    print(f"{YELLOW}⚠{NC} {text}")


def ok(text: str) -> None:
    print(f"{GREEN}✓{NC} {text}")


def kubectl(*args: str) -> str:
    try:
        r = subprocess.run(
            ["kubectl", *args], capture_output=True, text=True, timeout=60, check=False
        )
        return r.stdout or ""
    except Exception:
        return ""


def kubectl_json(*args: str) -> dict:
    try:
        return json.loads(kubectl(*args))
    except json.JSONDecodeError:
        return {}


def http_get(url: str, timeout: int) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "secret-check"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception:
        return "{}"


def grep(lines: list[str], pattern: str, invert: str | None = None) -> list[str]:
    rx = re.compile(pattern, re.IGNORECASE)
    skip = re.compile(invert) if invert else None
    return [line for line in lines if rx.search(line) and not (skip and skip.search(line))]


ts = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
print(f"{CYAN}╔══════════════════════════════════════════════════════════════╗{NC}")
print(f"{CYAN}║  Secret Completeness Check — {ts}{NC}")
print(f"{CYAN}╚══════════════════════════════════════════════════════════════╝{NC}")

# ─── 1. Check for missing Kubernetes secrets ───
print(f"\n{CYAN}── 1. Kubernetes Secret References ──{NC}")
pods = kubectl_json("get", "pods", "--all-namespaces", "-o", "json")
refs: set[tuple[str, str, str, str]] = set()
for pod in pods.get("items", []):
    meta = pod.get("metadata", {})
    ns, name = meta.get("namespace", ""), meta.get("name", "")
    for vol in pod.get("spec", {}).get("volumes") or []:
        secret = vol.get("secret", {}).get("secretName")
        if secret:
            refs.add((ns, name, secret, ""))
    for container in pod.get("spec", {}).get("containers") or []:
        for env in container.get("env") or []:
            ref = env.get("valueFrom", {}).get("secretKeyRef")
            if ref and ref.get("name"):
                refs.add((ns, name, ref["name"], " in env"))

for ns, pod, secret, kind in sorted(refs):
    if not kubectl("get", "secret", "-n", ns, secret, "-o", "name").strip():
        issue(f"{ns}/{pod} references secret '{secret}'{kind} — NOT FOUND")

ok("Secret reference check complete")

# ─── 2. Cloudless-app log analysis for missing env vars ───
print(f"\n{CYAN}── 2. Cloudless-App Log Analysis ──{NC}")
# Discover the cloudless-app pod dynamically rather than pinning a replica hash.
app_pods = kubectl_json(
    "get",
    "pods",
    "-n",
    "cloudless",
    "-l",
    "app=cloudless-app",
    "-o",
    "json",
)
pod_names = [
    p.get("metadata", {}).get("name", "")
    for p in app_pods.get("items", [])
    if p.get("metadata", {}).get("name")
]
cloudless_logs = (
    kubectl("logs", "-n", "cloudless", pod_names[0], "--tail=200")
    if pod_names
    else ""
)
log_lines = cloudless_logs.splitlines()

dns_errors = grep(log_lines, r"EAI_AGAIN|getaddrinfo|ENOTFOUND")[:5]
if dns_errors:
    issue("DNS resolution failures found in cloudless-app logs:\n" + "\n".join(dns_errors))
else:
    ok("No DNS resolution errors in recent logs")

missing = grep(log_lines, r"not set|not configured|missing", invert=r"node_modules")[:10]
if missing:
    warn("Missing config warnings in cloudless-app logs:\n" + "\n".join(missing))
else:
    ok("No missing config warnings in recent logs")

slack_fails = grep(log_lines, r"Signature verification failed|Missing x-slack")[:5]
if slack_fails:
    warn(
        "Slack signature verification failures detected:\n"
        + "\n".join(slack_fails)
        + "\n  → Likely from e2e tests or health checks without proper Slack headers"
    )
else:
    ok("No Slack signature verification failures")

newsletter_warn = grep(log_lines, r"NEWSLETTER_SLACK_SIGNING_SECRET")[:3]
if newsletter_warn:
    warn("NEWSLETTER_SLACK_SIGNING_SECRET not set — newsletter Slack requests will be rejected")
else:
    ok("No NEWSLETTER_SLACK_SIGNING_SECRET warnings")

d1_errors = grep(log_lines, r"D1.*failed|D1.*error|fetch failed")[:5]
if d1_errors:
    warn(
        "D1 connection issues detected:\n"
        + "\n".join(d1_errors)
        + "\n  → May be transient DNS failures (EAI_AGAIN) when resolving api.cloudflare.com"
    )
else:
    ok("No D1 connection errors in recent logs")

# ─── 3. Known required secrets per service ───
print(f"\n{CYAN}── 3. Service-Specific Secret Checks ──{NC}")

print(f"\n{CYAN}Postiz:{NC}")
postiz_data = kubectl("get", "secret", "-n", "postiz", "postiz-secrets", "-o", "json")
try:
    postiz_keys = list(json.loads(postiz_data).get("data", {}).keys())
except json.JSONDecodeError:
    postiz_keys = []
if postiz_keys:
    for key in ("POSTGRES_PASSWORD", "JWT_SECRET"):
        if key in postiz_keys:
            print(f"  {GREEN}✓{NC} {key} is set")
        else:
            issue(f"  {key} is MISSING".replace("  ", " "))
else:
    issue("  postiz-secrets not found")

print(f"\n{CYAN}Cloudless-App (via /api/config):{NC}")
try:
    config_resp = json.loads(http_get("https://cloudless.gr/api/config", 10) or "{}")
except json.JSONDecodeError:
    config_resp = {}
config = config_resp.get("config", {})
for key, value in list(config.items())[:20]:
    print(f"  {key}: {value}")

auth_provider = config.get("AUTH_PROVIDER") or config_resp.get("authProvider") or "unknown"
if auth_provider == "d1":
    print(f"  {GREEN}✓{NC} AUTH_PROVIDER=d1 (correct)")
else:
    warn(f"AUTH_PROVIDER={auth_provider} (expected 'd1')")

# ─── 4. Check Wrangler secrets (if wrangler available) ───
print(f"\n{CYAN}── 4. Wrangler Secrets (if available) ──{NC}")
if shutil.which("npx"):
    print("Checking wrangler secrets list...")
    r = subprocess.run(
        ["npx", "wrangler", "secret", "list", "--config", "wrangler.jsonc"],
        capture_output=True,
        text=True,
        check=False,
    )
    listing = (r.stdout or "").splitlines()[:20]
    print("\n".join(listing) if listing else "  (wrangler not configured or not authenticated)")
else:
    print(f"{YELLOW}⚠{NC} npx not available — skip wrangler secret check")

# ─── 5. Summary of known required integrations ───
print(f"\n{CYAN}── 5. Integration Status Summary ──{NC}")
print("Current-era integrations (AppFlowy replaced Notion, EspoCRM replaced HubSpot):")
print("")
print("| Integration     | Env vars                                   | Status |")
print("|-----------------|--------------------------------------------|--------|")

for key in (
    "SLACK_WEBHOOK_URL",
    "ESPOCRM_API_KEY",
    "APPFLOWY_API_TOKEN",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_CALENDAR_ID",
):
    val = config.get(key)
    if val:
        print(f"  {GREEN}✓{NC} {key} = {str(val)[:20]}...")
    else:
        warn(f"{key} = not set")

# ─── Summary ───
print(f"\n{CYAN}═══════════════════════════════════════════════════════════════{NC}")
print(f"{CYAN}  Summary: {RED}{ISSUES} issues{NC}, {YELLOW}{WARNINGS} warnings{NC}")
print(f"{CYAN}═══════════════════════════════════════════════════════════════{NC}")
