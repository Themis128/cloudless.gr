#!/usr/bin/env python3
"""Move credential-like GitHub Actions Variables into Secrets, then delete the Variables.

GitHub Variables are readable by anyone with repo write access and often appear in
logs. Secrets belong in Actions Secrets (or Wrangler/k8s), not Variables.

Dry-run by default. Pass --apply to mutate the repository.

Never prints secret values.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

REPO = "Themis128/cloudless.gr"

SENSITIVE_RE = re.compile(
    r"(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|WEBHOOK|ACCESS_KEY|"
    r"CLIENT_SECRET|JWT|SMTP_PASSWORD|BEARER|CREDENTIAL)",
    re.I,
)

# Credential-like names the regex may miss
EXTRA_SENSITIVE = {
    "GOOGLE_PRIVATE_KEY",
    "SES_SMTP_PASSWORD",
    "SES_SMTP_USER",
    "STRIPE_PUBLISHABLE_KEY",
    "COGNITO_CLIENT_SECRET",
    "APPFLOWY_JWT_SECRET",
    "MEILI_MASTER_KEY",
    "COMPOSIO_API_KEY",
    "CLOUDFLARE_AI_API_TOKEN",
    "HUBSPOT_ACCESS_TOKEN",
    "NTFY_TOKEN",
    "TIKNEURON_API_KEY",
    "POSTIZ_API_KEY",
    "POSTIZ_ADMIN_PASSWORD",
    "ESPOCRM_API_KEY",
    "ESPOCRM_ADMIN_PASSWORD",
    "ESPOCRM_WEBHOOK_SECRET",
    "MQTT_PASSWORD",
    "NEWSLETTER_SLACK_BOT_TOKEN",
    "NEWSLETTER_SLACK_SIGNING_SECRET",
    "LINKEDIN_REFRESH_TOKEN",
    "SESSION_SECRET",
    "AUTH_SECRET",
    "CRON_SECRET",
    "SYNC_HMAC_SECRET",
    "AI_GENERATE_SECRET",
    "AGENT_AUTH_TOKEN",
}

# Non-secret config allowed to remain as Variables
SAFE_KEEP = {
    "ADMIN_PUSH_VIA_NTFY",
    "ANTHROPIC_CHAT_MODEL",
    "APPFLOWY_API_URL",
    "APPFLOWY_EMAIL",
    "AWS_SES_REGION",
    "CLUSTER_OPS_PAGE_ID",
    "COGNITO_CLIENT_ID",
    "COGNITO_USER_POOL_ID",
    "ECR_LATEST_DIGEST",
    "ESPOCRM_BASE_URL",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_CALENDAR_ID",
    "GOOGLE_CLIENT_EMAIL",
    "GRAFANA_BASE_URL",
    "GSC_SITE_URL",
    "HUBSPOT_PORTAL_ID",
    "KUMA_BASE_URL",
    "KUMA_STATUS_PAGE_SLUG",
    "LINKEDIN_AD_ACCOUNT_ID",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_ORGANIZATION_URN",
    "META_AD_ACCOUNT_ID",
    "META_PAGE_ID",
    "META_PIXEL_ID",
    "MQTT_BROKER_HOST",
    "MQTT_BROKER_PORT",
    "MQTT_USERNAME",
    "N8N_API_URL",
    "N8N_WORKFLOW_LEAD_ENRICH_ID",
    "N8N_WORKFLOW_NEWSLETTER_NURTURE_ID",
    "NEWSLETTER_SLACK_CHANNEL_ID",
    "NEXT_PUBLIC_ALERT_WS_URL",
    "NEXT_PUBLIC_LINKEDIN_PARTNER_ID",
    "NEXT_PUBLIC_META_PIXEL_ID",
    "NEXT_PUBLIC_SENTRY_DSN",
    "NOTION_ANALYTICS_DB_ID",
    "NOTION_BLOG_DB_ID",
    "NOTION_CALENDAR_DB_ID",
    "NOTION_CASE_STUDIES_DB_ID",
    "NOTION_DOCS_DB_ID",
    "NOTION_ESP32_DEVICES_DB_ID",
    "NOTION_ESP32_TELEMETRY_DB_ID",
    "NOTION_FAQS_DB_ID",
    "NOTION_GSC_REPORTS_DB_ID",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_REPORTS_DB_ID",
    "NOTION_SERVICES_DB_ID",
    "NOTION_SUBMISSIONS_DB_ID",
    "NOTION_TASKS_DB_ID",
    "NOTION_TESTIMONIALS_DB_ID",
    "NTFY_BASE_URL",
    "NTFY_TOPIC",
    "POSTIZ_ADMIN_EMAIL",
    "POSTIZ_API_URL",
    "PROMETHEUS_URL",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SES_FROM_EMAIL",
    "SES_TO_EMAIL",
    "SLACK_DEFAULT_CHANNEL",
    "SLACK_OPS_USERS",
    "SLACK_OPS_USER_ID",
    "TIKTOK_APP_ID",
    "TIKTOK_SANDBOX_CLIENT_KEY",
}


def run(cmd: list[str], *, input_text: str | None = None) -> str:
    return subprocess.check_output(cmd, text=True, input=input_text, stderr=subprocess.STDOUT)


def list_secret_names() -> set[str]:
    out = run(
        [
            "gh",
            "secret",
            "list",
            "--repo",
            REPO,
            "--json",
            "name",
            "-q",
            ".[].name",
        ]
    )
    return {line.strip() for line in out.splitlines() if line.strip()}


def list_variables() -> list[dict]:
    raw = run(["gh", "api", f"repos/{REPO}/actions/variables", "--paginate"])
    variables: list[dict] = []
    decoder = json.JSONDecoder()
    idx = 0
    buf = raw.strip()
    while idx < len(buf):
        while idx < len(buf) and buf[idx].isspace():
            idx += 1
        if idx >= len(buf):
            break
        obj, end = decoder.raw_decode(buf, idx)
        variables.extend(obj.get("variables", []))
        idx = end
    return variables


def is_sensitive(name: str) -> bool:
    if name in SAFE_KEEP:
        return False
    if name in EXTRA_SENSITIVE or SENSITIVE_RE.search(name):
        return True
    # Unknown non-config names: treat as sensitive
    if name.endswith("_ID") or name.endswith("_URL") or name.startswith("NEXT_PUBLIC_"):
        return False
    if name.startswith("GH_AW_") or name == "RUNNER_GENERIC":
        return False
    return True


def ensure_secret(name: str, value: str) -> None:
    # Pipe via stdin so the value never appears in argv/ps
    try:
        run(
            ["gh", "secret", "set", name, "--repo", REPO],
            input_text=value,
        )
    except subprocess.CalledProcessError as exc:
        # Common cause: repository Actions secret quota (100) exceeded.
        raise RuntimeError(
            f"Failed to set secret {name}. If the repo already has 100 Actions "
            f"secrets, delete unused ones first (HTTP 400)."
        ) from exc


def delete_variable(name: str) -> None:
    run(["gh", "variable", "delete", name, "--repo", REPO])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Copy missing secrets and delete sensitive variables",
    )
    args = parser.parse_args()

    secrets = list_secret_names()
    variables = list_variables()

    to_delete: list[tuple[str, str]] = []
    keep: list[str] = []
    for var in variables:
        name = var["name"]
        value = var.get("value", "")
        if is_sensitive(name):
            to_delete.append((name, value))
        else:
            keep.append(name)

    need_copy = [(n, v) for n, v in to_delete if n not in secrets]
    already = [n for n, _ in to_delete if n in secrets]

    print(f"variables={len(variables)} secrets={len(secrets)}")
    print(f"keep_as_vars={len(keep)} delete={len(to_delete)}")
    print(f"copy_to_secrets_first={len(need_copy)} already_in_secrets={len(already)}")
    print("KEEP:")
    for n in sorted(keep):
        print(f"  {n}")
    print("COPY_THEN_DELETE:")
    for n, _ in need_copy:
        print(f"  {n}")
    print("DELETE_ONLY:")
    for n in sorted(already):
        print(f"  {n}")

    if not args.apply:
        print("\nDry-run only. Re-run with --apply to mutate.")
        return 0

    copied = 0
    deleted = 0
    failed: list[str] = []
    for name, value in need_copy:
        if not value:
            print(f"SKIP_EMPTY {name}")
            continue
        try:
            ensure_secret(name, value)
            copied += 1
            print(f"SECRET_SET {name}")
        except Exception as exc:  # noqa: BLE001 — continue purge; report names only
            failed.append(name)
            print(f"SECRET_SET_FAIL {name}: {exc}")

    for name, _ in to_delete:
        if name in failed:
            print(f"VAR_KEEP {name} (secret copy failed — fix quota then re-run)")
            continue
        try:
            delete_variable(name)
            deleted += 1
            print(f"VAR_DELETED {name}")
        except subprocess.CalledProcessError:
            print(f"VAR_DELETE_FAIL {name}")

    print(f"\nDone. secrets_created_or_updated={copied} variables_deleted={deleted}")
    if failed:
        print(f"secret_copy_failed={len(failed)}: {', '.join(failed)}")
    print(
        "Rotate high-value credentials that lived in Variables "
        "(Stripe, Slack, Cognito, SES SMTP, private keys, API tokens)."
    )
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        # Never dump command output that might contain secrets
        print(f"Command failed (exit {exc.returncode}): {' '.join(exc.cmd[:4])}…", file=sys.stderr)
        raise SystemExit(1) from exc
