# Manual Actions Required - Cloudless.gr

# Generated: 2026-07-19 16:44 UTC

# Last Updated: 2026-07-29 22:10 EEST — merge: Copilot PAT + Wrangler/ETL/SSM status

---

## 🔴 Copilot agentic workflows — mint fine-grained PAT (operator)

Personal repo `Themis128/cloudless.gr` needs a **fine-grained PAT** for Copilot inference.
OAuth tokens (`gho_…` from `gh auth`) are rejected. Current `COPILOT_GITHUB_TOKEN` (set 2026-07-18) returns HTTP 401.

1. Create a fine-grained PAT: https://github.com/settings/personal-access-tokens/new  
   (see [gh-aw auth docs](https://github.github.com/gh-aw/reference/auth/))
2. Resource owner = **your user** (`Themis128`), not an org.
3. Account permission: **Copilot Requests = Read** (required).
4. Store it:

```bash
gh aw secrets set COPILOT_GITHUB_TOKEN --repo Themis128/cloudless.gr
# paste the fine-grained PAT (github_pat_…)
gh aw run activity-report --repo Themis128/cloudless.gr
```

Workflows also declare `permissions.copilot-requests: write` (uses `GITHUB_TOKEN` when org billing supports it). On this personal repo the PAT is still required until that path works.

---

## ✅ Sensitive GitHub Variables purged (2026-07-29)

~57 credential-like **Actions Variables** were moved into **Actions Secrets** (or deleted when already present) via `scripts/purge-sensitive-gh-variables.py`.

- Non-secret config (URLs, DB IDs, public client IDs) remains as Variables.
- `sync-secrets-to-vars.yml` archived → `.github/workflows.archived/sync-secrets-to-vars.yml.disabled`.
- Repo hit the **100 Actions secrets** cap; freed slots by removing unused `HUBSPOT_ACCESS_TOKEN`, `COMPOSIO_API_KEY`, `SLACK_APP_ID`.

```bash
python3 scripts/purge-sensitive-gh-variables.py          # dry-run
python3 scripts/purge-sensitive-gh-variables.py --apply  # mutate
```

### Rotate after Variable exposure (recommended)

| Priority | Credentials |
|----------|-------------|
| 🔴 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `COGNITO_CLIENT_SECRET`, `GOOGLE_PRIVATE_KEY`, `SES_SMTP_*` |
| 🔴 | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_WEBHOOK_URL`, `NOTION_API_KEY` |
| 🟠 | `CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, Meta/LinkedIn/X tokens |
| 🟡 | EspoCRM / AppFlowy / Postiz / N8N / MQTT passwords |

---

## ✅ Cleared (2026-07-29)

| Item | Evidence |
|------|----------|
| GitHub R2 + CF account secrets | `CF_R2_*`, `CF_ACCOUNT_ID`, `CLOUDFLARE_*` set |
| Wrangler `SESSION_SECRET` | present (`wrangler secret list`) |
| Wrangler `AGENT_AUTH_TOKEN` | present |
| Agentic `[aw] failed` issue spam | `report-failure-as-issue: false` (#1386) |
| AppFlowy R16 WAL + daily dump → R2 | live; `failed_count=0` |
| PVC backups → R2 | smoke dump OK |
| SSM default path retired | Pi `SSM_DISABLED=1`; code needs `SSM_ENABLED=1` for AWS SSM |
| ETL runner label bug | `runs-on` default is JSON array `["self-hosted","omv","build"]` |

---

## ⏳ Still operator-only

| Item | Notes |
|------|-------|
| Copilot fine-grained PAT | See section above |
| Optional ads/Sentry/Kuma secrets | Leave empty if unused |
| Cloudflare API token rotation | If MCP CF tools 401 |
| ESP32 Notion DBs | Empty (no hardware data); page reconstruct partial |

---

## 🔧 Verification

1. `gh workflow run etl-espocrm-to-r2.yml` — should pick `omv-build` (not queue forever)
2. Continuous WAL: `archived_count` advances, `failed_count=0`
3. Daily CronJob `appflowy-walg-basebackup` at `30 2 * * *`
4. `npx wrangler secret list --config wrangler.jsonc` includes SESSION + AGENT

---

## Notes

1. Never `kubectl apply` empty Secret stubs for `appflowy-walg-r2` / `pvc-backup-r2`.
2. `WALG_LOG_LEVEL` must be `NORMAL|DEVEL|ERROR` (not `INFO`).
3. Checklist: `docs/current-source-of-truth-checklist.md`
