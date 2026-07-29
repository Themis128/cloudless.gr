# Manual Actions Required - Cloudless.gr

# Generated: 2026-07-19 16:44 UTC

# Last Updated: 2026-07-29 22:05 EEST — purged sensitive GH Variables; Copilot auth next

---

## 🔴 Copilot agentic workflows — mint fine-grained PAT (operator)

Personal repo `Themis128/cloudless.gr` needs a **fine-grained PAT** for Copilot inference.
OAuth tokens (`gho_…` from `gh auth`) are rejected. Current `COPILOT_GITHUB_TOKEN` (set 2026-07-18) is returning HTTP 401.

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
- `sync-secrets-to-vars.yml` archived → `.github/workflows.archived/sync-secrets-to-vars.yml.disabled` (it was copying secrets into Variables for Claude cloud sessions).
- Repo hit the **100 Actions secrets** cap during migration; freed slots by removing unused `HUBSPOT_ACCESS_TOKEN`, `COMPOSIO_API_KEY`, `SLACK_APP_ID`.

Re-run anytime:

```bash
python3 scripts/purge-sensitive-gh-variables.py          # dry-run
python3 scripts/purge-sensitive-gh-variables.py --apply  # mutate
```

### Rotate after Variable exposure (recommended)

Values lived as Variables (API-readable). Prioritize rotation:

| Priority | Credentials |
|----------|-------------|
| 🔴 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `COGNITO_CLIENT_SECRET`, `GOOGLE_PRIVATE_KEY`, `SES_SMTP_*` |
| 🔴 | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_WEBHOOK_URL`, `NOTION_API_KEY` |
| 🟠 | `CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, Meta/LinkedIn/X tokens |
| 🟡 | EspoCRM / AppFlowy / Postiz / N8N / MQTT passwords |

---

## ✅ Agentic workflow failure issues (cleared 2026-07-29)

Closed ~28 open `[aw] … failed` issues + #1313.  
`safe-outputs.report-failure-as-issue: false` on all 9 agentic workflows (PR #1386).

---

## ✅ GitHub secrets (verified 2026-07-29)

| Secret | Status | Purpose |
|--------|--------|---------|
| `CLOUDFLARE_API_TOKEN` | ✅ | Deploy, SST, CF APIs |
| `CF_ACCOUNT_ID` | ✅ | Deploy, ETL (`fb7dc7b69b662480cd5961a4d1913c78`) |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Same account id (alias) |
| `CLOUDFLARE_ZONE_ID` | ✅ | Custom domains |
| `CF_R2_ACCESS_KEY_ID` | ✅ | R2 S3 API (ETL + backups) |
| `CF_R2_SECRET_ACCESS_KEY` | ✅ | R2 S3 API |

Cluster: `pvc-backup-r2` (appflowy/espocrm/postiz/n8n) + `appflowy-walg-r2` live.
Smoke: AppFlowy PVC dump + continuous WAL + daily `pg_dump` CronJob → `datalake-bucket`.

---

## ⏳ Still needs operator (Wrangler / optional)

### Wrangler secrets (Workers runtime)

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc
# optional Gemini fallback:
npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc
```

| Secret | Priority | Notes |
|--------|----------|-------|
| `SESSION_SECRET` | 🔴 | 32+ bytes; session signing |
| `AGENT_AUTH_TOKEN` | 🔴 | Agent endpoints |
| `GEMINI_API_KEY` | 🟡 | Workers AI works without it |

### Optional product features

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | LinkedIn ads |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta ads |
| `SENTRY_AUTH_TOKEN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking |
| `KUMA_PUSH_ETL_ESPOCRM` | ETL monitoring |

---

## 🔧 Verification

1. `gh workflow run etl-espocrm-to-r2.yml` — should no longer fail on missing R2 keys
2. `gh workflow run cloudflare-deploy.yml`
3. Continuous WAL: `archived_count` advances, `failed_count=0` on AppFlowy postgres
4. Daily CronJob `appflowy-walg-basebackup` at `30 2 * * *`
5. After Copilot PAT: `gh aw run activity-report`

---

## 📝 Google Calendar (optional)

Not required for core chat. To enable booking, set Wrangler secrets
`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, or non-secret
keys via D1 `app_config` / admin Settings. Keep `GOOGLE_PRIVATE_KEY` in Wrangler.

---

## 🔗 Links

- [GitHub Secrets](https://github.com/Themis128/cloudless.gr/settings/secrets/actions)
- [R2 credentials workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/create-r2-credentials.yml)
- [ETL workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/etl-espocrm-to-r2.yml)
- Checklist: `docs/current-source-of-truth-checklist.md`

---

## Notes

1. Prefer D1 `app_config` + Wrangler/k8s secrets over AWS SSM (legacy Lambda path only).
2. Never `kubectl apply` empty Secret stubs for `appflowy-walg-r2` / `pvc-backup-r2`.
3. `WALG_LOG_LEVEL` must be `NORMAL|DEVEL|ERROR` (not `INFO`).
4. Cloudflare token rotation remains an operator SKIPPED item if MCP CF tools 401.
5. Actions Secrets hard cap is **100** per repo — prune unused before adding more.
6. Do **not** store credentials in Actions Variables.
