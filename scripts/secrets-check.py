#!/usr/bin/env python3
"""secrets-check.py — verify all critical GitHub repo secrets are set.
Posts a checklist to issue #382 so the operator knows what's missing.

Each secret is tested for non-empty value only (never logged)."""

import os
from datetime import datetime, timezone

print(f"[secrets-check] === secrets-check "
      f"{datetime.now(timezone.utc):%F %T}Z ===")


def check(name: str) -> None:
    print(f"{'ok' if os.environ.get(name) else 'missing'}:{name}")


# Core cluster operations
for name in ("TS_AUTHKEY", "KUBECONFIG_B64", "OMV_SSH_KEY",
             # CMS (AppFlowy)
             "APPFLOWY_API_URL", "APPFLOWY_JWT_SECRET",
             # Cloudflare
             "CLOUDFLARE_API_TOKEN", "CF_ACCOUNT_ID",
             "CF_R2_ACCESS_KEY_ID", "CF_R2_SECRET_ACCESS_KEY",
             # Cron auth
             "CRON_SECRET",
             # GitHub
             "GH_PAT", "ADMIN_BOOTSTRAP_PASSWORD"):
    check(name)
