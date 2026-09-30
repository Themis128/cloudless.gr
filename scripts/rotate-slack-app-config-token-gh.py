#!/usr/bin/env python3
"""Rotate Slack app-config token using the refresh token in the
repository secret SLACK_APP_CONFIG_REFRESH_TOKEN. Writes the new
refresh + access tokens back to repository secrets via the gh CLI.

Requires:
  - SECRETS_PAT env/repo secret (PAT that can set repo secrets)
  - SLACK_APP_CONFIG_REFRESH_TOKEN env/repo secret (initial seed)
Outputs (Actions): token=<new_access_token>, rotated=true|false"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.parse

REPO = os.environ.get("GITHUB_REPOSITORY", "")
if not REPO:
    sys.exit("GITHUB_REPOSITORY not set; are you running inside "
             "Actions?")

REFRESH_ENV_NAME = "SLACK_APP_CONFIG_REFRESH_TOKEN"
ACCESS_ENV_NAME = "SLACK_APP_CONFIG_TOKEN"


def mask(val: str) -> None:
    if os.environ.get("GITHUB_ACTIONS") and val:
        print(f"::add-mask::{val}")


def gh_output(key: str, val: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"{key}={val}\n")


refresh = os.environ.get(REFRESH_ENV_NAME, "")
if not refresh or refresh == "None":
    print(f"::warning::No refresh token in repo secret "
          f"{REFRESH_ENV_NAME} — skipping rotation.")
    gh_output("rotated", "false")
    sys.exit(0)

mask(refresh)

req = urllib.request.Request(
    "https://slack.com/api/tooling.tokens.rotate",
    data=urllib.parse.urlencode(
        {"refresh_token": refresh}).encode(),
    headers={"Content-Type":
             "application/x-www-form-urlencoded; charset=utf-8"})
resp = json.loads(urllib.request.urlopen(req, timeout=20).read())

if not resp.get("ok"):
    err = resp.get("error", "unknown")
    print(f"::error::Slack tooling.tokens.rotate failed: {err}")
    if err in ("invalid_refresh_token", "token_expired"):
        print("::error::The refresh token has been revoked or "
              "rotated outside this workflow. Reseed via the Slack "
              "app UI.")
    sys.exit(1)

new_access = resp.get("token")
new_refresh = resp.get("refresh_token")
if not new_access or new_access == "null":
    sys.exit("::error::Slack response missing .token field")
mask(new_access)
mask(new_refresh or "")

pat = os.environ.get("SECRETS_PAT", "")
if not pat:
    sys.exit("::error::SECRETS_PAT not provided. Workflow must set "
             "SECRETS_PAT repo secret with a PAT that can set repo "
             "secrets.")

r = subprocess.run(["gh", "auth", "login", "--with-token"],
                   input=pat, text=True, capture_output=True)
if r.returncode != 0:
    sys.exit("::error::Failed to authenticate gh CLI with provided "
             "PAT")

for env_name, val in ((REFRESH_ENV_NAME, new_refresh),
                      (ACCESS_ENV_NAME, new_access)):
    r = subprocess.run(
        ["gh", "secret", "set", env_name, "--body", "-",
         "--repo", REPO], input=val, text=True,
        capture_output=True)
    if r.returncode != 0:
        sys.exit(f"::error::Failed to set {env_name} via gh secret")

print("✓ Slack app-config token rotated and stored in repo "
      "secrets.")
gh_output("token", new_access)
gh_output("rotated", "true")
