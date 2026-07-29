# Manual Actions Required - Cloudless.gr

# Generated: 2026-07-19 16:44 UTC

# Last Updated: 2026-07-29 22:05 EEST — Wrangler secrets verified; ETL runner JSON fixed

---

## ✅ Cleared (2026-07-29)

| Item                               | Evidence                                                |
| ---------------------------------- | ------------------------------------------------------- |
| GitHub R2 + CF account secrets     | `CF_R2_*`, `CF_ACCOUNT_ID`, `CLOUDFLARE_*` set          |
| Wrangler `SESSION_SECRET`          | present (`wrangler secret list`)                        |
| Wrangler `AGENT_AUTH_TOKEN`        | present                                                 |
| Agentic `[aw] failed` issue spam   | `report-failure-as-issue: false` on 9 workflows (#1386) |
| AppFlowy R16 WAL + daily dump → R2 | live; `failed_count=0`                                  |
| PVC backups → R2                   | smoke dump OK                                           |

---

## ⏳ Operator-only (cannot automate from this session)

### 1. Copilot token for agentic workflows (401)

Scheduled gh-aw agents still fail against Copilot provider `172.30.0.30:10002`.
They no longer open GitHub issues. To restore agents:

```bash
gh secret set COPILOT_GITHUB_TOKEN --repo Themis128/cloudless.gr
# then re-run one agentic workflow to confirm 200 from the Copilot proxy
```

### 2. Optional product / monitoring secrets

| Secret                                                          | Purpose                                       |
| --------------------------------------------------------------- | --------------------------------------------- |
| `GEMINI_API_KEY` (Wrangler)                                     | Gemini fallback (Workers AI works without it) |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` / `NEXT_PUBLIC_META_PIXEL_ID` | Ads                                           |
| `SENTRY_AUTH_TOKEN` / `NEXT_PUBLIC_SENTRY_DSN`                  | Error tracking                                |
| `KUMA_PUSH_ETL_ESPOCRM`                                         | ETL Kuma heartbeat                            |
| Cloudflare API token rotation                                   | if MCP CF tools return 401                    |

### 3. ESP32 Notion DBs

Devices + Telemetry DBs remain empty (no hardware data ever populated).
Partial page reconstruct already done — see ESP32 restore runbook.

---

## 🔧 Verification

1. `gh workflow run etl-espocrm-to-r2.yml` — uses
   `runs-on: ["self-hosted","omv","build"]` when `RUNNER_GENERIC` unset
2. Continuous WAL: `archived_count` advances, `failed_count=0`
3. Daily CronJob `appflowy-walg-basebackup` at `30 2 * * *`
4. `npx wrangler secret list --config wrangler.jsonc` includes SESSION + AGENT

---

## Notes

1. Pi `cloudless-app-config` has `SSM_DISABLED=1`; `getConfig()` only hits AWS SSM when `SSM_ENABLED=1` (LocalStack / legacy).
2. Never `kubectl apply` empty Secret stubs for `appflowy-walg-r2` / `pvc-backup-r2`.
3. `WALG_LOG_LEVEL` must be `NORMAL|DEVEL|ERROR` (not `INFO`).
4. Checklist: `docs/current-source-of-truth-checklist.md`
