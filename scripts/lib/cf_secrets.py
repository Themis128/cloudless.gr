"""Cloudflare-native secret management helpers — Python port of
cf-secrets.sh.

Replaces AWS SSM with: Wrangler secrets + D1 app_config via /api/config.

Usage:
    from cf_secrets import cf_config_get, cf_secret_set, ...

    cf_secret_get("KEY")          # prints value or empty
    cf_secret_set("KEY", "VALUE") # writes secret via wrangler
    cf_config_get("key")          # reads from D1 app_config
    cf_config_set("key", "value") # writes to D1 app_config
"""

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID",
                               os.environ.get("CF_ACCOUNT_ID", ""))
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_CONFIG_URL = os.environ.get("CONFIG_URL",
                               "http://localhost:8787/api/config")

# Wrangler secret names used in the Worker (matches wrangler.jsonc bindings)
WRANGLER_SECRETS = [
    "ACTIVECAMPAIGN_API_URL",
    "ACTIVECAMPAIGN_API_TOKEN",
    "ACTIVECAMPAIGN_LEAD_AUTOMATION_ID",
    "TIKTOK_ACCESS_TOKEN",
    "TIKTOK_ADVERTISER_ID",
    "X_AD_ACCOUNT_ID",
    "POSTIZ_API_URL",
    "POSTIZ_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_DEFAULT_CHANNEL",
    "SLACK_APP_CONFIG_TOKEN",
    "SLACK_APP_CONFIG_REFRESH_TOKEN",
    "NOTION_API_KEY",
    "NOTION_BLOG_DB_ID",
    "NOTION_DOCS_DB_ID",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_TASKS_DB_ID",
    "NOTION_CALENDAR_DB_ID",
    "NOTION_SUBMISSIONS_DB_ID",
    "NOTION_TESTIMONIALS_DB_ID",
    "NOTION_CASE_STUDIES_DB_ID",
    "NOTION_SERVICES_DB_ID",
    "NOTION_FAQS_DB_ID",
    "GITHUB_TOKEN",
    "GITHUB_DISPATCH_TOKEN",
    "SESSION_SECRET",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
]

# Map secret names to D1 config keys (keys that live in app_config)
SECRET_TO_CONFIG_KEY = {
    "NOTION_API_KEY": "notion_api_key",
    "NOTION_BLOG_DB_ID": "notion_blog_db_id",
    "NOTION_DOCS_DB_ID": "notion_docs_db_id",
    "NOTION_PROJECTS_DB_ID": "notion_projects_db_id",
    "NOTION_TASKS_DB_ID": "notion_tasks_db_id",
    "NOTION_CALENDAR_DB_ID": "notion_calendar_db_id",
    "NOTION_SUBMISSIONS_DB_ID": "notion_submissions_db_id",
    "NOTION_TESTIMONIALS_DB_ID": "notion_testimonials_db_id",
    "NOTION_CASE_STUDIES_DB_ID": "notion_case_studies_db_id",
    "NOTION_SERVICES_DB_ID": "notion_services_db_id",
    "NOTION_FAQS_DB_ID": "notion_faqs_db_id",
    "SLACK_BOT_TOKEN": "slack_bot_token",
    "SLACK_SIGNING_SECRET": "slack_signing_secret",
    "SLACK_DEFAULT_CHANNEL": "slack_default_channel",
    "POSTIZ_API_URL": "postiz_api_url",
    "POSTIZ_API_KEY": "postiz_api_key",
    "ACTIVECAMPAIGN_API_URL": "activecampaign_api_url",
    "ACTIVECAMPAIGN_API_TOKEN": "activecampaign_api_token",
    "ACTIVECAMPAIGN_LEAD_AUTOMATION_ID": "activecampaign_lead_automation_id",
    "TIKTOK_ACCESS_TOKEN": "tiktok_access_token",
    "TIKTOK_ADVERTISER_ID": "tiktok_advertiser_id",
    "X_AD_ACCOUNT_ID": "x_ad_account_id",
    "SESSION_SECRET": "session_secret",
    "RESEND_API_KEY": "resend_api_key",
    "STRIPE_SECRET_KEY": "stripe_secret_key",
    "STRIPE_WEBHOOK_SECRET": "stripe_webhook_secret",
}


def cf_has_wrangler() -> bool:
    return shutil.which("wrangler") is not None


def cf_secret_get(key: str) -> str:
    """Get a secret via Wrangler (only works for deployed workers)."""
    if cf_has_wrangler() and CF_ACCOUNT_ID:
        r = subprocess.run(
            ["wrangler", "secret", "list", "--env", "production"],
            capture_output=True, text=True)
        if any(line.strip() == key for line in r.stdout.splitlines()):
            r = subprocess.run(
                ["wrangler", "secret", "get", key, "--env", "production"],
                capture_output=True, text=True)
            return r.stdout.strip()
    return ""


def cf_secret_set(key: str, value: str) -> int:
    """Set a secret via Wrangler. Returns 0 on success."""
    if cf_has_wrangler() and CF_ACCOUNT_ID and CF_API_TOKEN:
        return subprocess.run(
            ["wrangler", "secret", "put", key, "--env", "production"],
            input=value.encode(), capture_output=True).returncode
    print("ERROR: wrangler not available or CF credentials missing",
          file=sys.stderr)
    return 1


def _config_key(key: str) -> str:
    return SECRET_TO_CONFIG_KEY.get(key, key.lower())


def cf_config_get(key: str) -> str:
    """Get config from D1 app_config via /api/config endpoint."""
    try:
        with urllib.request.urlopen(
                f"{CF_CONFIG_URL}?key={_config_key(key)}",
                timeout=15) as r:
            return json.loads(r.read()).get("value") or ""
    except Exception:
        return ""


def cf_config_set(key: str, value: str) -> bool:
    """Set config in D1 app_config via /api/config endpoint."""
    req = urllib.request.Request(
        CF_CONFIG_URL,
        data=json.dumps({"key": _config_key(key), "value": value}).encode(),
        headers={"Content-Type": "application/json"}, method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return bool(json.loads(r.read()).get("success"))
    except Exception:
        return False


def cf_exists(key: str) -> bool:
    val = cf_config_get(key)
    return bool(val) and val != "null"


def cf_status() -> None:
    print("Cloudflare secrets / D1 config status:")
    for key in WRANGLER_SECRETS:
        print(f"  [{'set' if cf_exists(key) else 'MISSING':7s}] {key}")


def cf_verify_auth() -> int:
    if not cf_has_wrangler():
        print("ERROR: wrangler CLI not found. "
              "Install with: npm install -g wrangler", file=sys.stderr)
        return 1
    if not CF_ACCOUNT_ID:
        print("ERROR: CLOUDFLARE_ACCOUNT_ID not set", file=sys.stderr)
        return 1
    if not CF_API_TOKEN:
        print("ERROR: CLOUDFLARE_API_TOKEN not set", file=sys.stderr)
        return 1
    return 0
