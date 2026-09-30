#!/usr/bin/env python3
"""Sync .env → k8s secret cloudless/cloudless-secrets (no values printed)."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ENV_PATH = REPO / ".env"
OMV = os.environ.get("C1C_OMV_SSH", "tbaltzakis@192.168.1.128")
PROXY = os.environ.get("C1C_SSH_PROXY", "tbaltzakis@192.168.1.130")

SECRET_KEYS = [
    "AUTH_SECRET",
    "SESSION_SECRET",
    "CRON_SECRET",
    "ADMIN_ALERT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NOTION_API_KEY",
    "NOTION_WEBHOOK_SECRET",
    "NOTION_BLOG_DB_ID",
    "NOTION_DOCS_DB_ID",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_TASKS_DB_ID",
    "NOTION_SUBMISSIONS_DB_ID",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_WEBHOOK_URL",
    "ESPOCRM_BASE_URL",
    "ESPOCRM_API_KEY",
    "ESPOCRM_WEBHOOK_SECRET",
    "POSTIZ_API_URL",
    "POSTIZ_API_KEY",
    "POSTIZ_WEBHOOK_SECRET",
    "N8N_API_URL",
    "N8N_API_KEY",
    "N8N_WORKFLOW_LEAD_ENRICH_ID",
    "N8N_WORKFLOW_NEWSLETTER_NURTURE_ID",
    "APPFLOWY_API_URL",
    "APPFLOWY_JWT_SECRET",
    "APPFLOWY_EMAIL",
    "APPFLOWY_PASSWORD",
    "MEILI_HOST",
    "MEILI_MASTER_KEY",
    "MEILI_SEARCH_KEY",
    "MEILI_ADMIN_KEY",
    "NTFY_BASE_URL",
    "NTFY_TOKEN",
    "NTFY_TOPIC",
    "ANTHROPIC_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CF_ACCOUNT_ID",
    "CF_ACCESS_TEAM_DOMAIN",
    "CF_ACCESS_AUD",
]

DEFAULTS = {
    "ESPOCRM_BASE_URL": "https://espocrm.cloudless.gr",
    "POSTIZ_API_URL": "https://postiz.cloudless.gr",
    "N8N_API_URL": "https://n8n.cloudless.gr",
    "APPFLOWY_API_URL": "https://appflowy.cloudless.gr",
    "MEILI_HOST": "https://meili.cloudless.gr",
    "NTFY_BASE_URL": "https://ntfy.cloudless.gr",
    "CF_ACCESS_TEAM_DOMAIN": "cloudless-gr.cloudflareaccess.com",
    "CLOUDFLARE_ACCOUNT_ID": "fb7dc7b69b662480cd5961a4d1913c78",
}


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k] = v
    return out


def main() -> None:
    env = load_env(ENV_PATH)
    data: dict[str, str] = {}
    for k in SECRET_KEYS:
        if env.get(k):
            data[k] = env[k]
        elif k in DEFAULTS:
            data[k] = DEFAULTS[k]
    if "CLOUDFLARE_ACCOUNT_ID" not in data and env.get("CF_ACCOUNT_ID"):
        data["CLOUDFLARE_ACCOUNT_ID"] = env["CF_ACCOUNT_ID"]
    if "CF_ACCOUNT_ID" not in data and data.get("CLOUDFLARE_ACCOUNT_ID"):
        data["CF_ACCOUNT_ID"] = data["CLOUDFLARE_ACCOUNT_ID"]
    if "MEILI_ADMIN_KEY" not in data and data.get("MEILI_MASTER_KEY"):
        data["MEILI_ADMIN_KEY"] = data["MEILI_MASTER_KEY"]
    if "MEILI_SEARCH_KEY" not in data and data.get("MEILI_MASTER_KEY"):
        data["MEILI_SEARCH_KEY"] = data["MEILI_MASTER_KEY"]
    if "ADMIN_ALERT_SECRET" not in data and data.get("SESSION_SECRET"):
        data["ADMIN_ALERT_SECRET"] = data["SESSION_SECRET"]
    if not data.get("SESSION_SECRET") and not data.get("AUTH_SECRET"):
        raise SystemExit("need SESSION_SECRET or AUTH_SECRET")

    body = "\n".join(f"{k}={v}" for k, v in sorted(data.items())) + "\n"
    ssh = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        f"ProxyJump={PROXY}",
        OMV,
    ]
    subprocess.run(
        [*ssh, "sudo -n kubectl create namespace cloudless"], check=False, capture_output=True
    )
    subprocess.run(
        [*ssh, "sudo -n kubectl -n cloudless delete secret cloudless-secrets --ignore-not-found"],
        check=False,
        capture_output=True,
    )
    p = subprocess.run(
        [
            *ssh,
            "sudo -n kubectl -n cloudless create secret generic cloudless-secrets --from-env-file=/dev/stdin",
        ],
        input=body,
        text=True,
        capture_output=True,
    )
    if p.returncode != 0:
        raise SystemExit((p.stderr or p.stdout)[:500])
    print(f"synced cloudless/cloudless-secrets keys={len(data)}")


if __name__ == "__main__":
    main()
