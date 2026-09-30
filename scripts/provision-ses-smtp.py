#!/usr/bin/env python3
"""Provision Cloudflare Email / Resend API token and store in Cloudflare.

Replaces the old SES SMTP provisioning. Uses Resend API token (already
available as RESEND_API_KEY in GitHub secrets / Wrangler) and optional
Cloudflare Email for incoming email handling.

Writes to:
  - Wrangler secret: RESEND_API_KEY
  - D1 app_config:   resend_api_key
  - Wrangler secret: CLOUDFLARE_EMAIL_API_TOKEN
  - D1 app_config:   cloudflare_email_api_token
  - Wrangler secret: EMAIL_FROM (verified sender)
  - D1 app_config:   email_from

Idempotent: if tokens already exist, exits early.
Can be run with manual token input or via CI with GITHUB_TOKEN.

Env inputs: RESEND_API_KEY_INPUT, CLOUDFLARE_EMAIL_API_TOKEN_INPUT,
EMAIL_FROM_INPUT, EMAIL_FROM_DEFAULT."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_get, cf_config_set, cf_secret_set, cf_verify_auth  # noqa: E402

FROM_DEFAULT = os.environ.get("EMAIL_FROM_DEFAULT", "noreply@cloudless.gr")

# Check if already provisioned
existing_resend = cf_config_get("RESEND_API_KEY")
existing_from = cf_config_get("EMAIL_FROM")

if existing_resend and existing_resend != "null" and existing_from and existing_from != "null":
    print(
        f"✓ Email credentials already present in Cloudflare (from={existing_from}). Nothing to do."
    )
    sys.exit(0)

manual_resend = os.environ.get("RESEND_API_KEY_INPUT", "")
manual_cf_email = os.environ.get("CLOUDFLARE_EMAIL_API_TOKEN_INPUT", "")
manual_from = os.environ.get("EMAIL_FROM_INPUT", "")


def write(name: str, value: str) -> None:
    print(f"::add-mask::{value}") if value else None
    print(f"Writing {name}... ", end="", flush=True)
    print("Wrangler ok " if cf_secret_set(name, value) == 0 else "Wrangler failed ", end="")
    print("D1 ok" if cf_config_set(name, value) else "D1 failed")


if manual_resend or manual_cf_email:
    print("→ Using manually provided email credentials (skipping auto-provisioning)")
    if cf_verify_auth():
        sys.exit(1)
    if manual_resend:
        write("RESEND_API_KEY", manual_resend)
    if manual_cf_email:
        write("CLOUDFLARE_EMAIL_API_TOKEN", manual_cf_email)
    from_addr = manual_from or FROM_DEFAULT
    write("EMAIL_FROM", from_addr)
    print(f"✓ Email credentials written to Cloudflare (from={from_addr}).")
    sys.exit(0)

# Auto-provisioning path: fetch from GitHub secrets if in CI
if os.environ.get("GITHUB_TOKEN") and os.environ.get("GITHUB_REPOSITORY"):
    print("→ Attempting to fetch RESEND_API_KEY from GitHub secrets...")
    print("  Note: GitHub secret fetch not implemented — use manual input or CI environment")

print("⚠ No manual credentials provided and no CI secret fetch implemented.")
print("Run with RESEND_API_KEY_INPUT and EMAIL_FROM_INPUT environment variables,")
print("or add RESEND_API_KEY and EMAIL_FROM to GitHub secrets and configure CI to inject them.")
sys.exit(1)
