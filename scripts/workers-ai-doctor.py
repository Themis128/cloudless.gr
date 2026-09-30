#!/usr/bin/env python3
"""Workers AI doctor — verifies the full /api/admin/ai/generate chain.

Checks (each skipped gracefully when its credential isn't available):
  1. Cloudflare token validity + Workers AI scope (needs
     CLOUDFLARE_API_TOKEN) — runs a real 1-token inference.
  2. Production Lambda env carries CLOUDFLARE_ACCOUNT_ID/
     CLOUDFLARE_API_TOKEN (needs AWS credentials).
  3. Live endpoint is deployed and auth-gated: unauthenticated POST must
     return 401.

Usage:
  CLOUDFLARE_API_TOKEN=... python3 scripts/workers-ai-doctor.py

Exit code: 0 when every check that COULD run passed; 1 otherwise."""

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "fb7dc7b69b662480cd5961a4d1913c78")
LAMBDA_FN = os.environ.get(
    "LAMBDA_FN", "cloudless-production-CloudlessSiteServerUseast1Function-ddkafukh"
)
SITE = os.environ.get("SITE", "https://cloudless.gr")
FAIL = 0


def http(
    url: str, method: str = "GET", token: str = "", body=None, timeout: int = 20
) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method=method,
    )
    try:
        return (urllib.request.urlopen(req, timeout=timeout).status, "")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return 0, str(e)


token = os.environ.get("CLOUDFLARE_API_TOKEN", "")

# 1. Token validity + Workers AI scope
if token:
    print("== 1. Cloudflare token")
    code, text = http(
        "https://api.cloudflare.com/client/v4/user/tokens/verify", token=token, timeout=15
    )
    if '"status":"active"' in text or code == 200:
        print("   token: active")
    else:
        print(f"   token: INVALID — {text}")
        FAIL = 1

    code, text = http(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/"
        "ai/run/@cf/meta/llama-3.1-8b-instruct-fast",
        method="POST",
        token=token,
        timeout=30,
        body={"messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
    )
    if code == 200:
        print("   Workers AI scope: OK (inference HTTP 200)")
    else:
        print(f"   Workers AI scope: MISSING/BLOCKED (HTTP {code})")
        print(f"   body: {text[:300]}")
        print(
            "   fix: dash.cloudflare.com → API Tokens → edit token → "
            "add Account → Workers AI → Read+Run"
        )
        FAIL = 1
else:
    print("== 1. Cloudflare token — SKIPPED (CLOUDFLARE_API_TOKEN not set)")

# 2. Lambda env wiring
aws = shutil.which("aws")
aws_ok = (
    aws and subprocess.run([aws, "sts", "get-caller-identity"], capture_output=True).returncode == 0
)
if aws_ok:
    print("== 2. Lambda env")
    r = subprocess.run(
        [
            aws,
            "lambda",
            "get-function-configuration",
            "--function-name",
            LAMBDA_FN,
            "--region",
            "us-east-1",
            "--query",
            "Environment.Variables.{ID:CLOUDFLARE_ACCOUNT_ID,TOK:CLOUDFLARE_API_TOKEN}",
            "--output",
            "text",
        ],
        capture_output=True,
        text=True,
    )
    fields = r.stdout.split()
    id_val = fields[0] if fields else ""
    tok_val = fields[1] if len(fields) > 1 else ""
    if id_val and id_val != "None":
        print("   CLOUDFLARE_ACCOUNT_ID: present")
    else:
        print("   CLOUDFLARE_ACCOUNT_ID: MISSING — redeploy after setting the repo secret")
        FAIL = 1
    if tok_val and tok_val != "None":
        print("   CLOUDFLARE_API_TOKEN: present")
    else:
        print(
            "   CLOUDFLARE_API_TOKEN: MISSING — add repo secret "
            "CLOUDFLARE_API_TOKEN, then gh workflow run deploy.yml"
        )
        FAIL = 1
else:
    print("== 2. Lambda env — SKIPPED (no AWS credentials)")

# 3. Live endpoint deployed + auth-gated
print("== 3. Live endpoint")
code, _ = http(f"{SITE}/api/admin/ai/generate", method="POST", body={"prompt": "ping"}, timeout=20)
if code in (401, 403):
    print(f"   unauth POST → {code} (auth gate OK, route deployed)")
elif code == 404:
    print("   unauth POST → 404 — route NOT deployed yet (wait for deploy.yml)")
    FAIL = 1
else:
    print(f"   unauth POST → {code} (unexpected)")
    FAIL = 1

print()
print(
    "WORKERS AI DOCTOR: all runnable checks passed ✓"
    if not FAIL
    else "WORKERS AI DOCTOR: issues found ✗"
)
sys.exit(FAIL)
