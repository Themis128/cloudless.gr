# Manual Actions Required - Cloudless.gr

# Generated: 2026-07-19 16:44 UTC

# Last Updated: 2026-07-29 22:50 EEST — aw engines → Claude (ANTHROPIC_API_KEY)

---

## ✅ Agentic workflows use Claude (2026-07-29)

Switched all 9 gh-aw workflows from `engine: copilot` → `engine: claude` using repo secret `ANTHROPIC_API_KEY`.

Fine-grained PAT UI often has no "Account → Copilot Requests" (user-owned PAT only; under Account permissions). Copilot inference was HTTP 401 anyway.

Env secret `COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN` is unused by these workflows now.


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
| EspoCRM ETL → R2 | NodePort `127.0.0.1:30700` (#1397); API user `cloudless-app` + role ACL; `ESPOCRM_API_KEY` in GH + `cloudless-secrets`; run [30485173560](https://github.com/Themis128/cloudless.gr/actions/runs/30485173560) **5/5 entities** |

---

## ⏳ Still operator-only

| Item | Notes |
|------|-------|
| Copilot fine-grained PAT | See section above — refresh env `copilot` secret if agents 401 |
| Rotate after Variable exposure | Stripe / Slack / Notion / Cognito / Google / SES (table above) |
| Optional ads/Sentry/Kuma secrets | `KUMA_PUSH_ETL_ESPOCRM` empty (ping skipped); leave unused empty |
| Cloudflare API token rotation | If MCP CF tools 401 |
| ESP32 Notion DBs | Empty (no hardware data); page reconstruct partial |

---

## 🔧 Verification

1. `gh workflow run etl-espocrm-to-r2.yml` — green; picks `omv`/`build`; writes `lake/espocrm-*/*.parquet`
2. Continuous WAL: `archived_count` advances, `failed_count=0`
3. Daily CronJob `appflowy-walg-basebackup` at `30 2 * * *`
4. `npx wrangler secret list --config wrangler.jsonc` includes SESSION + AGENT

---

## Notes

1. Never `kubectl apply` empty Secret stubs for `appflowy-walg-r2` / `pvc-backup-r2`.
2. `WALG_LOG_LEVEL` must be `NORMAL|DEVEL|ERROR` (not `INFO`).
3. Checklist: `docs/current-source-of-truth-checklist.md`
