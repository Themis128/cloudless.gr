#!/usr/bin/env python3
"""Rotate the Slack app-configuration token using the long-lived refresh
token. Designed to be called from inside slack-manifest-apply.yml as a
pre-step so the manifest API call always has a fresh ~12h access token.

Reads:
  D1 app_config: slack_app_config_refresh_token

Writes (atomic — on Slack API success):
  Wrangler secret: SLACK_APP_CONFIG_TOKEN
  D1 app_config:   slack_app_config_token
  Wrangler secret: SLACK_APP_CONFIG_REFRESH_TOKEN
  D1 app_config:   slack_app_config_refresh_token

Outputs to GITHUB_OUTPUT (when run in a workflow):
  token=<new_access_token>      — masked, available to subsequent steps
  rotated=true|false            — false on graceful no-op

Exit codes:
  0 — success, or graceful skip (no refresh token present yet)
  1 — Slack API rejected the refresh token (revoked or rotated
      elsewhere); a human must reseed via
      scripts/seed-slack-app-config-tokens.py

Slack endpoint: POST https://slack.com/api/tooling.tokens.rotate
Docs: https://api.slack.com/methods/tooling.tokens.rotate"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import (cf_config_get, cf_config_set, cf_secret_set,  # noqa: E402
                        cf_verify_auth)

GH_OUTPUT = os.environ.get("GITHUB_OUTPUT", "")


def emit_output(key: str, value: str) -> None:
    if GH_OUTPUT:
        with open(GH_OUTPUT, "a") as f:
            f.write(f"{key}={value}\n")


def mask(value: str) -> None:
    # ::add-mask:: hides the value from GH Actions logs. No-op outside CI.
    if os.environ.get("GITHUB_ACTIONS") and value:
        print(f"::add-mask::{value}")


refresh = cf_config_get("SLACK_APP_CONFIG_REFRESH_TOKEN")

if not refresh or refresh == "null":
    print("::warning::No refresh token in D1 config "
          "(slack_app_config_refresh_token) — skipping rotation.")
    print("  Bootstrap with: python3 "
          "scripts/seed-slack-app-config-tokens.py")
    emit_output("rotated", "false")
    sys.exit(0)
mask(refresh)

# Per docs.slack.dev/reference/methods/tooling.tokens.rotate the refresh
# token is passed as a form argument, NOT as a Bearer Authorization header.
req = urllib.request.Request(
    "https://slack.com/api/tooling.tokens.rotate",
    data=urllib.parse.urlencode({"refresh_token": refresh}).encode(),
    headers={"Content-Type":
             "application/x-www-form-urlencoded; charset=utf-8"},
    method="POST")
try:
    resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
except Exception as e:
    print(f"::error::Slack tooling.tokens.rotate call failed: {e}")
    sys.exit(1)

if not resp.get("ok"):
    err = resp.get("error", "unknown")
    print(f"::error::Slack tooling.tokens.rotate failed: {err}")
    if err in ("invalid_refresh_token", "token_expired"):
        print("::error::The refresh token has been revoked or rotated "
              "outside this workflow.")
        print("::error::Reseed both tokens at https://api.slack.com/apps "
              "→ Your App → Basic Information")
        print("::error::then run: python3 "
              "scripts/seed-slack-app-config-tokens.py")
    sys.exit(1)

new_access = resp.get("token", "")
new_refresh = resp.get("refresh_token", "")
if not new_access or new_access == "null":
    print("::error::Slack response missing .token field")
    sys.exit(1)
mask(new_access)
mask(new_refresh)

# Persist refresh FIRST — if the run dies between writes, the next run
# can still recover because the refresh token in D1 matches what Slack
# now expects.
if cf_verify_auth():
    sys.exit(1)

print("Writing new refresh token... ", end="", flush=True)
print("D1 ok " if cf_config_set("SLACK_APP_CONFIG_REFRESH_TOKEN",
                              new_refresh) else "D1 failed ", end="")
print("Wrangler ok" if cf_secret_set("SLACK_APP_CONFIG_REFRESH_TOKEN",
                                   new_refresh) == 0 else "Wrangler failed")

print("Writing new access token... ", end="", flush=True)
print("D1 ok " if cf_config_set("SLACK_APP_CONFIG_TOKEN",
                              new_access) else "D1 failed ", end="")
print("Wrangler ok" if cf_secret_set("SLACK_APP_CONFIG_TOKEN",
                                   new_access) == 0 else "Wrangler failed")

print("✓ Slack app-config token rotated. New access token good for ~12h.")

emit_output("token", new_access)
emit_output("rotated", "true")
