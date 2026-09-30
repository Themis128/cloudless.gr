#!/usr/bin/env python3
"""One-shot helper to store a GitHub PAT into Cloudflare
(Wrangler secret + D1 config)
  - Wrangler secret: GITHUB_DISPATCH_TOKEN (primary) + GITHUB_TOKEN (legacy)
  - D1 app_config:   github_dispatch_token + github_token

How to mint the PAT:
  https://github.com/settings/personal-access-tokens/new
  - Token name        : cloudless-dispatch
  - Resource owner    : Themis128
  - Repository access : Only select repositories -> cloudless.gr
  - Repository perms  : Actions = Read and write, Contents = Read-only,
                        Metadata = Read-only

Copy the token (starts with `github_pat_...`), then run:
  python3 scripts/store-github-dispatch-token.py

Reads the token from stdin once (no echo), verifies it against the GitHub
/user endpoint, then writes both Cloudflare secrets and D1 config."""

import getpass
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_set, cf_secret_set, cf_verify_auth  # noqa: E402


def gh_probe(path: str, token: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


if cf_verify_auth():
    sys.exit(1)

if sys.stdin.isatty():
    token = getpass.getpass("Paste GitHub PAT (input hidden): ")
else:
    token = sys.stdin.read().strip()

if not token:
    print("ERROR: empty token.", file=sys.stderr)
    sys.exit(1)
if not (token.startswith("github_pat_") or token.startswith("ghp_")):
    print("WARN: token prefix is not github_pat_ or ghp_ — continuing anyway.", file=sys.stderr)

print("Verifying token against api.github.com/user ... ", end="", flush=True)
code, body = gh_probe("/user", token)
if code != 200:
    print(f"FAILED (HTTP {code})")
    print(body, file=sys.stderr)
    sys.exit(1)
print(f"ok (login: {body.get('login', '?')})")

print("Verifying repo access for Themis128/cloudless.gr ... ", end="", flush=True)
code, _ = gh_probe("/repos/Themis128/cloudless.gr/actions/workflows", token)
if code != 200:
    print(
        f"FAILED (HTTP {code}) — token has /user access but cannot "
        "read workflows. Check repo + Actions permissions.",
        file=sys.stderr,
    )
    sys.exit(1)
print("ok")

for name in ("GITHUB_DISPATCH_TOKEN", "GITHUB_TOKEN"):
    print(f"Writing {name} to Cloudflare... ", end="", flush=True)
    print("Wrangler ok " if cf_secret_set(name, token) == 0 else "Wrangler failed ", end="")
    print("D1 ok" if cf_config_set(name, token) else "D1 failed")

print("""
Done. The Worker picks up secrets at deploy; D1 config is live immediately.
Manual test once active:
   /cloudless-draft rerun     (in any Slack channel where the bot is)""")
